import "dotenv/config";
﻿import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { URL } from "node:url";
import dotenv from "dotenv";

dotenv.config();

// â”€â”€â”€ Config & Services â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
import { prisma } from "./config/database.js";
import { notificationService } from "./services/notificationService.js";
import { startDiscoveryWorker } from "./services/discoveryEngine.js";
import { startCallWorker } from "./services/campaignScheduler.js";
import { startFraudWorker } from "./services/fraudDetectionService.js";

// â”€â”€â”€ Middleware â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
import { authJwt } from "./middleware/authJwt.js";
import { generalLimiter } from "./middleware/rateLimiter.js";
import { errorBoundary } from "./middleware/errorBoundary.js";
import { auditMiddleware } from "./middleware/auditMiddleware.js";

// â”€â”€â”€ Routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
import authRoutes from "./routes/auth.js";
import businessProfileRoutes from "./routes/businessProfile.js";
import leadsRoutes from "./routes/leads.js";
import intelligenceRoutes from "./routes/intelligence.js";
import campaignsRoutes from "./routes/campaigns.js";
import voiceAgentRoutes from "./routes/voiceAgents.js";
import crmRoutes from "./routes/crm.js";
import billingRoutes from "./routes/billing.js";
import auditRoutes from "./routes/audit.js";

// â”€â”€â”€ App Setup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:8080";

import { knowledgeBasesRouter } from "./routes/knowledgeBases.js";
import { chatRouter } from "./routes/chat.js";

// Security
app.use(helmet());
app.use(
  cors({
    origin: [CLIENT_ORIGIN, "http://localhost:3000", "http://localhost:8080"],
    credentials: true,
  })
);
app.use(morgan("dev"));
app.use(generalLimiter);

// Body parsing
// Stripe webhook needs raw buffer â€” mount before json middleware
app.use("/api/v1/billing/webhook", express.raw({ type: "application/json" }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// â”€â”€â”€ Health & Info â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get("/api/v1/health", (_req, res) => {
  res.status(200).json({
    status: "online",
    service: "VYAPERI X AI Sales Agent Platform API",
    version: "2.0.0",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

app.get("/api/v1", (_req, res) => {
  res.status(200).json({
    name: "VYAPERI X API Engine v2",
    modules: [
      "Auth & Org Scoping",
      "Business Understanding (Groq LLM)",
      "Lead Discovery Radar (40+ channels)",
      "Lead Upload (CSV/Excel â€” Calling Only mode)",
      "Enrichment Engine (Apollo.io + Groq fallback)",
      "AI ICP Qualification Engine",
      "Campaign Scheduler (BullMQ + DNC enforcement)",
      "Multilingual AI Voice Fleet (Sarvam + ElevenLabs + Groq)",
      "Real-time Telemetry (WebSocket /ws/voice-telemetry)",
      "CRM Sync (HubSpot / Salesforce)",
      "Billing (Stripe + Razorpay)",
      "Audit & Fraud Detection",
    ],
    docs: "/BACKEND_GUIDE.md",
  });
});

// â”€â”€â”€ Public Routes (no JWT) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/billing/webhook", billingRoutes); // Stripe webhook â€” no JWT
app.use("/api/v1/voice", voiceAgentRoutes); // Twilio webhooks â€” no JWT on /twiml and /status

// â”€â”€â”€ Auth Middleware for all protected routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use("/api/v1", authJwt);
app.use("/api/v1", auditMiddleware);

// â”€â”€â”€ Protected Routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use("/api/v1/business-profile", businessProfileRoutes);
app.use("/api/v1/leads", leadsRoutes);
app.use("/api/v1/intelligence", intelligenceRoutes);
app.use("/api/v1/campaigns", campaignsRoutes);
app.use("/api/v1/voice-agents", voiceAgentRoutes);
app.use("/api/v1/calls", voiceAgentRoutes);
app.use("/api/v1/crm", crmRoutes);
app.use("/api/v1/billing", billingRoutes);
app.use("/api/v1", auditRoutes);


// ═══════ RAG — Knowledge Base & Chat ═══════
app.use("/api/v1/knowledge-bases", knowledgeBasesRouter);
app.use("/api/v1/chat", chatRouter);

// â”€â”€â”€ Error Boundary (must be last) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use(errorBoundary);

// â”€â”€â”€ HTTP + WebSocket Server â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const httpServer = createServer(app);

// Voice Telemetry WebSocket â€” consumed by dashboard.simulation and dashboard.inspector
const wss = new WebSocketServer({ server: httpServer, path: "/ws/voice-telemetry" });

wss.on("connection", async (ws, req) => {
  // Authenticate via JWT query param: ws://host/ws/voice-telemetry?token=<jwt>
  const url = new URL(req.url || "", `http://${req.headers.host}`);
  const token = url.searchParams.get("token");
  let organizationId: string | null = null;

  if (token) {
    try {
      // Use static import (already imported at top-level via authJwt which imports jsonwebtoken)
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const jwt = (await import("jsonwebtoken")).default;
      const payload = jwt.verify(token, process.env.JWT_SECRET || "") as {
        organizationId: string;
      };
      organizationId = payload.organizationId;
    } catch {
      ws.close(1008, "Invalid token");
      return;
    }
  }

  console.log(`[WebSocket] Client connected${organizationId ? ` (org: ${organizationId})` : " (unauthenticated)"}`);

  // Register for org-scoped real-time push
  if (organizationId) {
    notificationService.registerSocket(organizationId, ws);
  }

  ws.send(
    JSON.stringify({
      type: "TELEMETRY_CONNECTED",
      message: "Connected to VYAPERI X Real-time Telemetry Stream",
      timestamp: new Date().toISOString(),
      authenticated: !!organizationId,
    })
  );

  ws.on("message", (data) => {
    try {
      const payload = JSON.parse(data.toString());
      console.log("[WebSocket Received]:", payload);
    } catch {
      console.warn("[WebSocket] Received non-JSON frame");
    }
  });

  ws.on("close", () => {
    console.log("[WebSocket] Client disconnected");
  });

  ws.on("error", (err) => {
    console.error("[WebSocket] Error:", err);
  });
});

// â”€â”€â”€ Start Background Workers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function startWorkers(): void {
  try {
    startDiscoveryWorker();
    startCallWorker();
    startFraudWorker();
    console.log("âœ… Background workers started (Discovery, Calls, Fraud Detection)");
  } catch (err) {
    console.warn("âš ï¸  Workers not started (Redis unavailable):", err);
  }
}

// â”€â”€â”€ Boot â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
httpServer.listen(PORT, async () => {
  console.log(`\nðŸš€ VYAPERI X AI Backend Server running at http://localhost:${PORT}`);
  console.log(`ðŸ“¡ WebSocket Telemetry endpoint: ws://localhost:${PORT}/ws/voice-telemetry`);
  console.log(`ðŸ“‹ API Root: http://localhost:${PORT}/api/v1\n`);

  // Verify DB connection
  try {
    await prisma.$connect();
    console.log("âœ… PostgreSQL connected");
  } catch (err) {
    console.error("âŒ PostgreSQL connection failed â€” run: npx prisma migrate dev", err);
  }

  startWorkers();
});

// â”€â”€â”€ Graceful Shutdown â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
process.on("SIGTERM", async () => {
  console.log("\n[Server] SIGTERM received â€” shutting down gracefully...");
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("\n[Server] SIGINT received â€” shutting down...");
  await prisma.$disconnect();
  process.exit(0);
});

