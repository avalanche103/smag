import dotenv from "dotenv";
import path from "node:path";

dotenv.config();

const rootDir = path.resolve(__dirname, "..", "..");

export const env = {
  port: Number(process.env.PORT ?? 3000),
  sessionSecret: process.env.SESSION_SECRET ?? "change-me",
  adminLogin: process.env.ADMIN_LOGIN ?? "admin",
  adminPassword: process.env.ADMIN_PASSWORD ?? "admin12345",
  siteUrl: process.env.SITE_URL ?? "http://localhost:3000",
  analyticsId: process.env.ANALYTICS_ID ?? "",
  mailTo: process.env.MAIL_TO ?? "editor@example.com",
  rootDir,
  dataDir: path.join(rootDir, "data"),
  contentFile: path.join(rootDir, "data", "content.json"),
  uploadsDir: path.join(rootDir, "data", "uploads"),
  coversDir: path.join(rootDir, "data", "uploads", "covers"),
  invoicesDir: path.join(rootDir, "data", "uploads", "invoices"),
  listsDir: path.join(rootDir, "data", "uploads", "lists")
};
