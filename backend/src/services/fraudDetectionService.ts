import { prisma } from "../config/database.js";
import { redis } from "../config/redis.js";
import { Queue, Worker } from "bullmq";

const FRAUD_QUEUE = "fraud-detection";

export const fraudQueue = new Queue(FRAUD_QUEUE, {
  connection: redis,
  defaultJobOptions: { removeOnComplete: 50, removeOnFail: 50 },
});

export const fraudDetectionService = {
  /** Schedule a fraud scan to run in the background */
  async scheduleScan(organizationId: string): Promise<void> {
    await fraudQueue.add(
      "scan",
      { organizationId },
      { jobId: `fraud-scan-${organizationId}-${Date.now()}` }
    );
  },

  async getFlags(organizationId: string) {
    return prisma.fraudFlag.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });
  },

  async resolveFlag(flagId: string): Promise<void> {
    await prisma.fraudFlag.update({
      where: { id: flagId },
      data: { resolved: true },
    });
  },
};

/** BullMQ Worker — runs fraud checks */
export function startFraudWorker(): void {
  const worker = new Worker(
    FRAUD_QUEUE,
    async (job) => {
      const { organizationId } = job.data as { organizationId: string };
      await runFraudScan(organizationId);
    },
    { connection: redis, concurrency: 5 }
  );

  worker.on("failed", (job, err) => {
    console.error(`[FraudWorker] Job ${job?.id} failed:`, err);
  });
}

async function runFraudScan(organizationId: string): Promise<void> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // 1. Call volume anomaly: >200 calls in 1 hour
  const recentCallCount = await prisma.call.count({
    where: {
      campaign: { organizationId },
      startedAt: { gte: oneHourAgo },
    },
  });
  if (recentCallCount > 200) {
    await prisma.fraudFlag.create({
      data: {
        organizationId,
        type: "call_volume_anomaly",
        details: { callsInLastHour: recentCallCount, threshold: 200 },
      },
    });
    console.warn(`[FraudDetection] Call volume anomaly for org ${organizationId}: ${recentCallCount} calls/hr`);
  }

  // 2. DNC violations: check recent audit logs for blocked calls that were re-attempted
  const dncViolations = await prisma.auditLog.count({
    where: {
      organizationId,
      action: { contains: "DNC_SKIP" },
      createdAt: { gte: oneDayAgo },
    },
  });
  if (dncViolations > 10) {
    await prisma.fraudFlag.create({
      data: {
        organizationId,
        type: "dnc_violation",
        details: { dncSkipsLast24h: dncViolations, threshold: 10 },
      },
    });
  }
}
