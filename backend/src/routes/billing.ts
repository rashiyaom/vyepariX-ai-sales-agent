import { Router, Request, Response, NextFunction } from "express";
import { billingService } from "../services/billingService.js";
import { requireRole } from "../middleware/rbac.js";
import { z } from "zod";

const router = Router();

// GET /api/v1/billing/subscription
router.get("/subscription", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sub = await billingService.getSubscription(req.organizationId!);
    res.json(sub ?? { status: "no_subscription", plan: null });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/billing/checkout
router.post(
  "/checkout",
  requireRole(["OWNER"]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { plan, successUrl, cancelUrl } = z.object({
        plan: z.enum(["starter", "growth", "enterprise"]),
        successUrl: z.string().url(),
        cancelUrl: z.string().url(),
      }).parse(req.body);

      const result = await billingService.createCheckout(req.organizationId!, plan, successUrl, cancelUrl);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/billing/webhook  — Stripe webhook (raw body required, no JWT)
router.post(
  "/webhook",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const signature = req.headers["stripe-signature"] as string;
      if (!signature) {
        res.status(400).json({ error: "Missing stripe-signature header" });
        return;
      }
      await billingService.handleStripeWebhook(req.body as Buffer, signature);
      res.sendStatus(200);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
