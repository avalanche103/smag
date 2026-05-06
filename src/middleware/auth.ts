import type { NextFunction, Request, Response } from "express";

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.adminId) {
    res.redirect("/admin/login");
    return;
  }
  next();
}
