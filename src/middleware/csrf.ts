import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function verifyCsrfToken(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const token = typeof req.body?._csrf === "string" ? req.body._csrf : req.get("x-csrf-token");
  if (!token || token !== req.session.csrfToken) {
    res.status(403).send("Invalid CSRF token");
    return;
  }

  next();
}

export function attachCsrfToken(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomUUID();
  }

  res.locals.csrfToken = req.session.csrfToken;
  next();
}
