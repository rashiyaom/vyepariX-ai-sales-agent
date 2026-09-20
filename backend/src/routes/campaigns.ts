import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../config/database.js";
import { campaignScheduler } from "../services/campaignScheduler.js";
import { requireRole } from "../middleware/rbac.js";
import { z } from "zod";

const router = Router();

const CreateCampaignSchema = z.object({
  name: z.string().min(1),
  goal: z.string().min(1),
  languages: z.array(z.string()).min(1),
  callingHoursStart: z.string().regex(/^\d{2}:\d{2}$/),
  callingHoursEnd: z.string().regex(/^\d{2}:\d{2}$/),
  timezonePolicy: z.string().default("lead-local-timezone"),
  maxRetries: z.number().int().min(0).max(10).default(3),
  retrySpacingHrs: z.number().int().min(1).max(72).default(24),
  leadIds: z.array(z.string()).optional(),
});

// POST /api/v1/campaigns
router.post(
  "/",
  requireRole(["OWNER", "SALES_MANAGER"]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { leadIds, ...data } = CreateCampaignSchema.parse(req.body);

      const campaign = await prisma.campaign.create({
        data: {
          ...data,
          organizationId: req.organizationId!,
          ...(leadIds?.length && {
            leads: { connect: leadIds.map((id) => ({ id })) },
          }),
        },
      });
      res.status(201).json(campaign);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/campaigns
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const campaigns = await prisma.campaign.findMany({
      where: { organizationId: req.organizationId! },
      include: { _count: { select: { leads: true, calls: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(campaigns);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/campaigns/:id
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const campaignId = typeof req.params.id === "string" ? req.params.id : "";
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId: req.organizationId! },
      include: {
        _count: { select: { leads: true, calls: true } },
        calls: { orderBy: { startedAt: "desc" }, take: 20, select: { id: true, status: true, sentiment: true, startedAt: true } },
      },
    });
    if (!campaign) {
      res.status(404).json({ error: "Campaign not found" });
      return;
    }
    res.json(campaign);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/campaigns/:id
router.patch(
  "/:id",
  requireRole(["OWNER", "SALES_MANAGER"]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const PatchSchema = z.object({
        name: z.string().optional(),
        goal: z.string().optional(),
        status: z.enum(["DRAFT", "SCHEDULED", "RUNNING", "PAUSED", "COMPLETED"]).optional(),
        maxRetries: z.number().int().optional(),
        retrySpacingHrs: z.number().int().optional(),
      });
      const data = PatchSchema.parse(req.body);

      // If launching (RUNNING) — schedule calls
      const campaignId = typeof req.params.id === "string" ? req.params.id : "";
      if (data.status === "RUNNING") {
        const result = await campaignScheduler.scheduleCampaign(campaignId);
        res.json({ message: "Campaign launched", ...result });
        return;
      }

      const id = typeof req.params.id === "string" ? req.params.id : "";
      const campaign = await prisma.campaign.updateMany({
        where: { id, organizationId: req.organizationId! },
        data,
      });
      if (campaign.count === 0) {
        res.status(404).json({ error: "Campaign not found" });
        return;
      }
      res.json({ message: "Campaign updated" });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
