import { Request, Response, NextFunction } from "express";
import { redis } from "../config/redis.js";

interface RateLimitOptions {
  windowSeconds: number;
  maxRequests: number;
}

function makeKey(req: Request, prefix: string): string {
  const orgId = req.organizationId || "anon";
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0] || req.socket.remoteAddress || "unknown";
  return `rl:${prefix}:${orgId}:${ip}`;
}

function rateLimiter(prefix: string, opts: RateLimitOptions) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (redis.status !== "ready") {
      // Redis unavailable — fail open immediately
      next();
      return;
    }
    const key = makeKey(req, prefix);
    try {
      const current = await redis.incr(key);
      if (current === 1) {
        await redis.expire(key, opts.windowSeconds);
      }
      if (current > opts.maxRequests) {
        res.status(429).json({
          error: "Rate limit exceeded",
          retryAfter: opts.windowSeconds,
        });
        return;
      }
    } catch (err) {
      // Fail-open on Redis unavailability — log but don't block
      console.error("[RateLimiter] Redis error:", err);
    }
    next();
  };
}

// General API: 200 req/min per org+IP
export const generalLimiter = rateLimiter("general", { windowSeconds: 60, maxRequests: 200 });

// Cost-bearing ops: stricter limits
export const discoveryLimiter = rateLimiter("discovery", { windowSeconds: 60, maxRequests: 10 });
export const voiceAgentLimiter = rateLimiter("voice", { windowSeconds: 60, maxRequests: 20 });
export const uploadLimiter = rateLimiter("upload", { windowSeconds: 60, maxRequests: 30 });

// Auth endpoints — per IP only (no org yet)
export const authLimiter = rateLimiter("auth", { windowSeconds: 60, maxRequests: 15 });
