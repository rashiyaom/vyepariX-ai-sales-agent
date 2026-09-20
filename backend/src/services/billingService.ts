import Stripe from "stripe";
import { prisma } from "../config/database.js";
import { notificationService } from "./notificationService.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "stripe_placeholder_dev_mode");

const PLANS: Record<string, { voiceMinutesCap: number; price: string }> = {
  starter: { voiceMinutesCap: 500, price: "price_starter" },
  growth: { voiceMinutesCap: 2000, price: "price_growth" },
  enterprise: { voiceMinutesCap: 10000, price: "price_enterprise" },
};

export const billingService = {
  async getSubscription(organizationId: string) {
    return prisma.subscription.findUnique({ where: { organizationId } });
  },

  async createCheckout(organizationId: string, plan: string, successUrl: string, cancelUrl: string) {
    const planConfig = PLANS[plan];
    if (!planConfig) throw new Error(`Unknown plan: ${plan}`);

    let sub = await prisma.subscription.findUnique({ where: { organizationId } });

    // Create or retrieve Stripe customer
    let customerId = sub?.stripeCustomerId;
    if (!customerId) {
      const org = await prisma.organization.findUnique({ where: { id: organizationId } });
      const customer = await stripe.customers.create({ name: org?.name, metadata: { organizationId } });
      customerId = customer.id;
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: planConfig.price, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { organizationId, plan },
    });

    return { checkoutUrl: session.url };
  },

  async handleStripeWebhook(rawBody: Buffer, signature: string): Promise<void> {
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET || ""
      );
    } catch (err) {
      throw new Error(`Stripe webhook signature verification failed: ${err}`);
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const { organizationId, plan } = session.metadata ?? {};
        if (!organizationId || !plan) break;
        const planConfig = PLANS[plan];
        await prisma.subscription.upsert({
          where: { organizationId },
          create: {
            organizationId,
            plan,
            status: "active",
            voiceMinutesCap: planConfig?.voiceMinutesCap,
            stripeCustomerId: session.customer as string,
            stripeSubId: session.subscription as string,
          },
          update: {
            plan,
            status: "active",
            voiceMinutesCap: planConfig?.voiceMinutesCap,
            stripeCustomerId: session.customer as string,
            stripeSubId: session.subscription as string,
          },
        });
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        await prisma.subscription.updateMany({
          where: { stripeSubId: sub.id },
          data: {
            status: sub.status,
            renewsAt: new Date(sub.current_period_end * 1000),
          },
        });
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await prisma.subscription.updateMany({
          where: { stripeSubId: sub.id },
          data: { status: "canceled" },
        });
        break;
      }
    }
  },

  /** Record voice minutes after a call ends — cap enforcement */
  async recordVoiceMinutes(organizationId: string, minutes: number): Promise<void> {
    const sub = await prisma.subscription.findUnique({ where: { organizationId } });
    if (!sub) return;

    const newUsed = sub.voiceMinutesUsed + minutes;
    await prisma.subscription.update({
      where: { organizationId },
      data: { voiceMinutesUsed: newUsed },
    });

    // Warn at 80% cap
    if (sub.voiceMinutesCap && newUsed >= sub.voiceMinutesCap * 0.8 && newUsed < sub.voiceMinutesCap) {
      await notificationService.notifyUsageWarning(organizationId, newUsed, sub.voiceMinutesCap);
    }
  },

  /** Returns true if the org is within their voice minute allowance */
  async canMakeCall(organizationId: string): Promise<boolean> {
    const sub = await prisma.subscription.findUnique({ where: { organizationId } });
    if (!sub || sub.status !== "active") return false;
    if (!sub.voiceMinutesCap) return true; // unlimited
    return sub.voiceMinutesUsed < sub.voiceMinutesCap;
  },
};
