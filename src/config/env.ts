import dotenv from "dotenv";
import path from "node:path";

dotenv.config();

function readEnv(name: string, fallback = ""): string {
  return (process.env[name] ?? fallback).trim();
}

const rootDir = process.cwd();
const projectDataDir = path.join(rootDir, "data");
const runtimeDataDir = process.env.VERCEL ? path.join("/tmp", "smag-data") : projectDataDir;
const isProduction = process.env.NODE_ENV === "production";
const sessionSecret = process.env.SESSION_SECRET ?? "change-me";

if (isProduction && sessionSecret === "change-me") {
  throw new Error("SESSION_SECRET must be set to a strong random value in production.");
}

export const env = {
  port: Number(process.env.PORT ?? 3000),
  isProduction,
  sessionSecret,
  adminLogin: process.env.ADMIN_LOGIN ?? "admin",
  adminPassword: process.env.ADMIN_PASSWORD ?? "admin",
  adminUserLogin: process.env.ADMIN_USER_LOGIN ?? "user",
  adminUserPassword: process.env.ADMIN_USER_PASSWORD ?? "user",
  siteUrl: process.env.SITE_URL ?? "http://localhost:3000",
  analyticsId: process.env.ANALYTICS_ID ?? "",
  mailTo: readEnv("MAIL_TO", "prof.dialogi@yandex.by"),
  mailFrom: readEnv("MAIL_FROM") || readEnv("SMTP_USER", "prof.dialogi@yandex.by"),
  smtpHost: readEnv("SMTP_HOST"),
  smtpPort: Number(process.env.SMTP_PORT ?? 465),
  smtpSecure: (process.env.SMTP_SECURE ?? "true") === "true",
  smtpUser: readEnv("SMTP_USER"),
  smtpPass: readEnv("SMTP_PASS").replace(/\s+/g, ""),
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
