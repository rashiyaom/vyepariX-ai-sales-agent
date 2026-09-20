import { prisma } from "../config/database.js";
import { redis } from "../config/redis.js";
import { Queue, Worker } from "bullmq";
import { hashPhone, decrypt } from "../config/encryption.js";
import { billingService } from "./billingService.js";
import { auditService } from "./auditService.js";

const CALL_QUEUE = "campaign-calls";

export const callQueue = new Queue(CALL_QUEUE, {
  connection: redis,
  defaultJobOptions: { removeOnComplete: 200, removeOnFail: 100 },
});

export const campaignScheduler = {
  /** Load all QUALIFIED leads for a campaign and schedule calls */
  async scheduleCampaign(campaignId: string): Promise<{ scheduled: number; skippedDnc: number }> {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        leads: {
          where: { status: { in: ["QUALIFIED", "NEW", "ENRICHED"] } },
        },
        organization: true,
      },
    });
    if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

    // Check billing cap before scheduling
    const canCall = await billingService.canMakeCall(campaign.organizationId);
    if (!canCall) {
      throw new Error("Voice minute cap reached — upgrade subscription to continue");
    }

    let scheduled = 0;
    let skippedDnc = 0;

    for (const lead of campaign.leads) {
      if (!lead.phoneEncrypted) continue;

      // Server-side DNC check — MANDATORY, never trust client
      const phone = decrypt(lead.phoneEncrypted);
      const phoneHash = hashPhone(phone);
      const isDnc = await prisma.dncEntry.findUnique({ where: { phoneNumber: phoneHash } });

      if (isDnc) {
        skippedDnc++;
        await auditService.logAction(campaign.organizationId, undefined, "DNC_SKIP", {
          leadId: lead.id,
          campaignId,
          reason: isDnc.reason ?? "DNC list",
        });
        continue;
      }

      // Calculate delay: schedule within calling hours in lead's timezone
      const delayMs = calculateCallDelay(
        lead.timezone ?? "Asia/Kolkata",
        campaign.callingHoursStart,
        campaign.callingHoursEnd
      );

      await callQueue.add(
        "place-call",
        {
          leadId: lead.id,
          campaignId,
          organizationId: campaign.organizationId,
          attemptNumber: 1,
          languages: campaign.languages,
        },
        {
          delay: delayMs,
          jobId: `call-${lead.id}-campaign-${campaignId}-attempt-1`,
          attempts: campaign.maxRetries,
          backoff: { type: "fixed", delay: campaign.retrySpacingHrs * 60 * 60 * 1000 },
        }
      );

      scheduled++;
    }

    // Update campaign status
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "SCHEDULED" },
    });

    console.log(`[CampaignScheduler] Campaign ${campaignId}: ${scheduled} calls scheduled, ${skippedDnc} DNC skipped`);
    return { scheduled, skippedDnc };
  },
};

/**
 * Calculate ms delay until the next valid calling window.
 * Returns 0 if currently within calling hours, else ms until next window opens.
 */
function calculateCallDelay(
  timezone: string,
  startTime: string, // "09:00"
  endTime: string    // "18:00"
): number {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    });

    const parts = formatter.formatToParts(now);
    const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0");
    const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0");
    const currentMinutes = hour * 60 + minute;

    const [startH, startM] = startTime.split(":").map(Number);
    const [endH, endM] = endTime.split(":").map(Number);
    const startMinutes = (startH ?? 9) * 60 + (startM ?? 0);
    const endMinutes = (endH ?? 18) * 60 + (endM ?? 0);

    if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
      return 0; // Within calling hours — call now
    }

    // After calling hours — delay until next day's start
    if (currentMinutes >= endMinutes) {
      const msUntilMidnight = (24 * 60 - currentMinutes) * 60 * 1000;
      const msFromMidnightToStart = startMinutes * 60 * 1000;
      return msUntilMidnight + msFromMidnightToStart;
    }

    // Before calling hours today — delay until start
    return (startMinutes - currentMinutes) * 60 * 1000;
  } catch {
    return 0; // Invalid timezone — call now rather than never
  }
}

/** BullMQ Worker for actually placing calls */
export function startCallWorker(): void {
  const worker = new Worker(
    CALL_QUEUE,
    async (job) => {
      const { leadId, campaignId, organizationId, attemptNumber, languages } = job.data as {
        leadId: string;
        campaignId: string;
        organizationId: string;
        attemptNumber: number;
        languages: string[];
      };

      // Import voiceAgentService dynamically to avoid circular deps
      const { voiceAgentService } = await import("./voiceAgentService.js");
      await voiceAgentService.placeOutboundCall({ leadId, campaignId, organizationId, attemptNumber, languages });
    },
    { connection: redis, concurrency: 10 }
  );

  worker.on("failed", (job, err) => {
    console.error(`[CallWorker] Job ${job?.id} failed:`, err);
  });
}
