import { Router, Request, Response, NextFunction } from "express";
import { auditService } from "../services/auditService.js";
import { fraudDetectionService } from "../services/fraudDetectionService.js";
import { requireRole } from "../middleware/rbac.js";
import { prisma } from "../config/database.js";

const router = Router();

// GET /api/v1/audit-logs
router.get("/audit-logs", requireRole(["OWNER", "SALES_MANAGER"]), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const logs = await auditService.getLogs(req.organizationId!, limit, (page - 1) * limit);
    res.json({ data: logs, page, limit });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/fraud-flags
router.get("/fraud-flags", requireRole(["OWNER"]), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const flags = await fraudDetectionService.getFlags(req.organizationId!);
    res.json(flags);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/fraud-flags/:id/resolve
router.patch("/fraud-flags/:id/resolve", requireRole(["OWNER"]), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = typeof req.params.id === "string" ? req.params.id : "";
    await fraudDetectionService.resolveFlag(id);
    res.json({ message: "Flag resolved" });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/dnc  — Add a number to the DNC list
router.post("/dnc", requireRole(["OWNER", "SALES_MANAGER"]), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone, reason } = req.body as { phone: string; reason?: string };
    if (!phone) {
      res.status(400).json({ error: "phone is required" });
      return;
    }
    const { hashPhone } = await import("../config/encryption.js");
    await prisma.dncEntry.create({
      data: { phoneNumber: hashPhone(phone), reason },
    });
    res.status(201).json({ message: "Number added to DNC list" });
  } catch (err) {
    next(err);
  }
});

export default router;
