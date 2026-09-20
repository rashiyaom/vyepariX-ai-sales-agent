import { Router, Request, Response, NextFunction } from "express";
import { analyticsService } from "../services/analyticsService.js";

const router = Router();

// GET /api/v1/intelligence/insights
router.get("/insights", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const insights = await analyticsService.getInsights(req.organizationId!);
    res.json(insights);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/intelligence/campaigns/:id/metrics
router.get("/campaigns/:id/metrics", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = typeof req.params.id === "string" ? req.params.id : "";
    const metrics = await analyticsService.getCampaignMetrics(id, req.organizationId!);
    if (!metrics) {
      res.status(404).json({ error: "Campaign not found" });
      return;
    }
    res.json(metrics);
  } catch (err) {
    next(err);
  }
});

export default router;
