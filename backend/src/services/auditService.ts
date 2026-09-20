import { prisma } from "../config/database.js";

export const auditService = {
  async logAction(
    organizationId: string,
    actorUserId: string | undefined,
    action: string,
    metadata?: object
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action,
          metadata: metadata as object ?? {},
        },
      });
    } catch (err) {
      // Audit logging must never crash the main request
      console.error("[AuditService] Failed to log action:", err);
    }
  },

  async getLogs(organizationId: string, limit = 100, offset = 0) {
    return prisma.auditLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });
  },
};
