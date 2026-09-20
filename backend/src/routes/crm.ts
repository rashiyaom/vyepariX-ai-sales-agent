import { Router, Request, Response, NextFunction } from "express";
import { crmSyncService } from "../services/crmSyncService.js";
import { requireRole } from "../middleware/rbac.js";
import { z } from "zod";

const router = Router();

const ConnectSchema = z.object({
  provider: z.enum(["hubspot", "salesforce", "zoho"]),
  credentials: z.record(z.string()),
});

// POST /api/v1/crm/connect
router.post(
  "/connect",
  requireRole(["OWNER", "SALES_MANAGER"]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { provider, credentials } = ConnectSchema.parse(req.body);
      const connection = await crmSyncService.connect(req.organizationId!, provider, credentials);
      res.json({ message: `Connected to ${provider}`, connectionId: connection.id });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/crm/sync
router.post("/sync", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await crmSyncService.syncInterestedLeads(req.organizationId!);
    res.json({ message: "CRM sync complete", ...result });
  } catch (err) {
    next(err);
  }
});

export default router;
