import { prisma } from "../config/database.js";
import { WebSocket } from "ws";
import nodemailer from "nodemailer";

// In-memory org → WS set (org-scoped telemetry rooms)
const orgSockets = new Map<string, Set<WebSocket>>();

export const notificationService = {
  /** Register a WebSocket for an org's real-time updates */
  registerSocket(organizationId: string, ws: WebSocket): void {
    if (!orgSockets.has(organizationId)) orgSockets.set(organizationId, new Set());
    orgSockets.get(organizationId)!.add(ws);
    ws.on("close", () => {
      orgSockets.get(organizationId)?.delete(ws);
    });
  },

  /** Push a real-time event to all org sockets */
  push(organizationId: string, event: object): void {
    const sockets = orgSockets.get(organizationId);
    if (!sockets) return;
    const payload = JSON.stringify(event);
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  },

  /** Send an in-app notification (stored in DB) — polled or pushed via WS */
  async sendInApp(
    organizationId: string,
    message: string,
    metadata?: object
  ): Promise<void> {
    await prisma.auditLog.create({
      data: {
        organizationId,
        action: "NOTIFICATION",
        metadata: { message, ...metadata },
      },
    });
    notificationService.push(organizationId, { type: "NOTIFICATION", message, metadata });
  },

  /** Send an email notification */
  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: Number(process.env.SMTP_PORT) || 587,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      await transporter.sendMail({
        from: process.env.SMTP_FROM || "noreply@vyaperix.com",
        to,
        subject,
        html,
      });
    } catch (err) {
      console.error("[NotificationService] Email send failed:", err);
    }
  },

  async notifyInterestedProspect(organizationId: string, leadId: string, leadName: string): Promise<void> {
    await notificationService.sendInApp(
      organizationId,
      `🔥 Interested prospect: ${leadName}`,
      { leadId, type: "interested_prospect" }
    );
  },

  async notifyCampaignComplete(organizationId: string, campaignId: string, campaignName: string): Promise<void> {
    await notificationService.sendInApp(
      organizationId,
      `✅ Campaign complete: ${campaignName}`,
      { campaignId, type: "campaign_complete" }
    );
  },

  async notifyUsageWarning(organizationId: string, used: number, cap: number): Promise<void> {
    await notificationService.sendInApp(
      organizationId,
      `⚠️ Voice usage at ${Math.round((used / cap) * 100)}% of cap (${used}/${cap} minutes)`,
      { type: "usage_warning", used, cap }
    );
  },
};
