/**
 * Attach X-Request-Id to every request; forward to upstream.
 */
import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

export interface RequestWithId extends Request {
  requestId?: string;
}

export function requestIdMiddleware(
  req: RequestWithId,
  res: Response,
  next: NextFunction
): void {
  const incoming = (req.headers["x-request-id"] as string) || "";
  req.requestId = incoming.trim() || randomUUID();
  res.setHeader("X-Request-Id", req.requestId);
  next();
}
