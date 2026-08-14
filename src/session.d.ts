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
    listImport?: {
      year: number;
      sourceName: string;
      entries: Array<{
        section: string;
        title: string;
        author: string;
        issueNumber: number;
        warning?: string;
      }>;
      warnings: string[];
    };
  }
}
