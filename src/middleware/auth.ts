import type { NextFunction, Request, Response } from "express";
import type { AdminRole } from "../types";

export function getSessionRole(req: Request): AdminRole | undefined {
  return req.session.adminRole;
}

export function isFullAdmin(req: Request): boolean {
  return req.session.adminRole === "admin";
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.adminId || !req.session.adminLogin) {
    res.redirect("/admin/login");
    return;
  }

  next();
}

export function requireFullAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.adminId || !req.session.adminLogin) {
    res.redirect("/admin/login");
    return;
  }

  if (!isFullAdmin(req)) {
    req.session.flash = { type: "error", message: "Недостаточно прав для этого раздела." };
    res.redirect("/admin/issues");
    return;
  }

  next();
}

/** @deprecated Use requireAuth */
export const requireAdmin = requireAuth;
