import dotenv from "dotenv";
import path from "node:path";

dotenv.config();

const rootDir = process.cwd();
const projectDataDir = path.join(rootDir, "data");
const runtimeDataDir = process.env.VERCEL ? path.join("/tmp", "smag-data") : projectDataDir;

export const env = {
  port: Number(process.env.PORT ?? 3000),
  sessionSecret: process.env.SESSION_SECRET ?? "change-me",
  adminLogin: process.env.ADMIN_LOGIN ?? "admin",
  adminPassword: process.env.ADMIN_PASSWORD ?? "admin12345",
  siteUrl: process.env.SITE_URL ?? "http://localhost:3000",
  analyticsId: process.env.ANALYTICS_ID ?? "",
  mailTo: process.env.MAIL_TO ?? "editor@example.com",
  mailFrom: process.env.MAIL_FROM ?? process.env.SMTP_USER ?? "",
  smtpHost: process.env.SMTP_HOST ?? "",
  smtpPort: Number(process.env.SMTP_PORT ?? 465),
  smtpSecure: (process.env.SMTP_SECURE ?? "true") === "true",
  smtpUser: process.env.SMTP_USER ?? "",
  smtpPass: process.env.SMTP_PASS ?? "",
  rootDir,
  isVercel: Boolean(process.env.VERCEL),
  projectDataDir,
  dataDir: runtimeDataDir,
  seedContentFile: path.join(projectDataDir, "content.json"),
  contentFile: path.join(runtimeDataDir, "content.json"),
  uploadsDir: path.join(projectDataDir, "uploads"),
  coversDir: path.join(projectDataDir, "uploads", "covers"),
  invoicesDir: path.join(projectDataDir, "uploads", "invoices"),
  listsDir: path.join(projectDataDir, "uploads", "lists")
};
