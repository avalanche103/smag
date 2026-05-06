import "express-session";

declare module "express-session" {
  interface SessionData {
    adminId?: number;
    adminLogin?: string;
    csrfToken?: string;
    flash?: {
      type: "success" | "error";
      message: string;
    };
  }
}
