import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../config/database.js";
import { authLimiter } from "../middleware/rateLimiter.js";
import { z } from "zod";

const router = Router();

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  orgName: z.string().min(1),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// POST /api/v1/auth/register
router.post("/register", authLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, orgName } = RegisterSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: "Email already registered" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const org = await prisma.organization.create({ data: { name: orgName } });
    const user = await prisma.user.create({
      data: { email, passwordHash, organizationId: org.id, role: "OWNER" },
    });

    const token = signToken(user.id, org.id, user.role);
    res.status(201).json({ token, userId: user.id, organizationId: org.id, role: user.role });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/login
router.post("/login", authLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = LoginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const token = signToken(user.id, user.organizationId, user.role);
    res.json({ token, userId: user.id, organizationId: user.organizationId, role: user.role });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/auth/me
router.get("/me", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthenticated" });
      return;
    }
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { id: true, email: true, role: true, organizationId: true, createdAt: true },
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

function signToken(userId: string, organizationId: string, role: string): string {
  return jwt.sign(
    { userId, organizationId, role },
    process.env.JWT_SECRET!,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" } as jwt.SignOptions
  );
}

export default router;
