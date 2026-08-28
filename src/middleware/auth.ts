import type { NextFunction, Request, Response } from "express";
import { getAdminById } from "../services/contentService";
import type { AdminRole } from "../types";

function syncSessionAdmin(req: Request): boolean {
  if (!req.session.adminId) {
    return false;
  }

  const admin = getAdminById(req.session.adminId);
  if (!admin) {
    delete req.session.adminId;
    delete req.session.adminLogin;
    delete req.session.adminRole;
    return false;
  }

  req.session.adminLogin = admin.login;
  req.session.adminRole = admin.role;
  return true;
}

export function getSessionRole(req: Request): AdminRole | undefined {
  return req.session.adminRole;
}

export function isFullAdmin(req: Request): boolean {
  return req.session.adminRole === "admin";
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!syncSessionAdmin(req)) {
    res.redirect("/admin/login");
    return;
  }

  next();
}

export function requireFullAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!syncSessionAdmin(req)) {
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
