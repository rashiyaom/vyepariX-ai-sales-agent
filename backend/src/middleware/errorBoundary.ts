import { Request, Response, NextFunction } from "express";

interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

export function errorBoundary(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode ?? 500;
  const isProd = process.env.NODE_ENV === "production";

  // Always log full detail server-side
  console.error("[ErrorBoundary]", {
    message: err.message,
    code: err.code,
    stack: err.stack,
    status: statusCode,
  });

  // Never leak stack traces to clients in production
  res.status(statusCode).json({
    error: err.message || "Internal Server Error",
    code: err.code,
    ...(isProd ? {} : { stack: err.stack }),
  });
}

/** Helper — create a typed error with a status code */
export function createError(message: string, statusCode: number, code?: string): AppError {
  const err = new Error(message) as AppError;
  err.statusCode = statusCode;
  err.code = code;
  return err;
}
