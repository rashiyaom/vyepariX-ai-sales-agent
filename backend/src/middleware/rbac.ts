import { Request, Response, NextFunction } from "express";

type AllowedRole = "OWNER" | "SALES_MANAGER" | "SALES_REP" | "PLATFORM_ADMIN";

const ROLE_HIERARCHY: Record<AllowedRole, number> = {
  PLATFORM_ADMIN: 4,
  OWNER: 3,
  SALES_MANAGER: 2,
  SALES_REP: 1,
};

/**
 * requireRole(['OWNER', 'SALES_MANAGER'])
 * Passes if req.user.role has at least the minimum rank among the listed roles.
 */
export function requireRole(allowedRoles: AllowedRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userRole = req.user?.role as AllowedRole | undefined;
    if (!userRole) {
      res.status(401).json({ error: "Unauthenticated" });
      return;
    }
    if (!allowedRoles.includes(userRole) && userRole !== "PLATFORM_ADMIN") {
      res.status(403).json({ error: `Insufficient permissions. Required: ${allowedRoles.join(" | ")}` });
      return;
    }
    next();
  };
}
