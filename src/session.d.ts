import "express-session";

declare module "express-session" {
  interface SessionData {
    adminId?: number;
    adminLogin?: string;
    adminRole?: "admin" | "user";
    csrfToken?: string;
    contactCaptcha?: {
      answer: number;
      issuedAt: number;
    };
    flash?: {
      type: "success" | "error";
      message: string;
    };
    importPreviewId?: string;
  }
}
