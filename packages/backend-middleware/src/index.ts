/**
 * Shared Express middleware for HyperAgent backend services.
 * Propagates x-request-id for trace correlation.
 */

import type { Request, Response, NextFunction } from "express";

export const REQUEST_ID_HEADER = "x-request-id";

export interface RequestWithId extends Request {
  requestId?: string;
}

/**
 * Injects x-request-id from headers into req.requestId for downstream use.
 * Logs in non-production when id is present.
 */
export function requestIdMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const id = (req.headers[REQUEST_ID_HEADER] as string)?.trim() || "";
  (req as RequestWithId).requestId = id;
  if (id && process.env.NODE_ENV !== "production") {
    console.log(`[${process.env.npm_package_name || "service"}] requestId=${id} path=${req.path}`);
  }
  next();
}
