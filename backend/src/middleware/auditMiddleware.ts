import { Request, Response, NextFunction } from "express";
import { auditService } from "../services/auditService.js";

const MUTATING_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);
const SKIP_PATHS = new Set(["/api/v1/billing/webhook"]); // Stripe webhook — raw body needed, skip audit here

export function auditMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!MUTATING_METHODS.has(req.method) || SKIP_PATHS.has(req.path)) {
    next();
    return;
  }

  const orgId = req.organizationId;
  const userId = req.user?.userId;
  if (!orgId) {
    next();
    return;
  }

  // Fire-and-forget — don't block the request
  auditService
    .logAction(orgId, userId, `${req.method} ${req.path}`, {
      body: sanitizeBody(req.body),
      query: req.query,
    })
    .catch((err) => console.error("[AuditMiddleware] Failed to log:", err));

  next();
}

function sanitizeBody(body: Record<string, unknown>): Record<string, unknown> {
  const REDACT = new Set(["password", "passwordHash", "token", "credentials"]);
  if (!body || typeof body !== "object") return {};
  return Object.fromEntries(
    Object.entries(body).map(([k, v]) => [k, REDACT.has(k) ? "[REDACTED]" : v])
  );
}
