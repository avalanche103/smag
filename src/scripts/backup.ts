import fs from "node:fs";
import path from "node:path";
import { env } from "../config/env";

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.join(env.dataDir, "backups", timestamp);
fs.mkdirSync(backupDir, { recursive: true });

fs.copyFileSync(env.contentFile, path.join(backupDir, "content.json"));
if (fs.existsSync(env.uploadsDir)) {
  fs.cpSync(env.uploadsDir, path.join(backupDir, "uploads"), { recursive: true });
}

console.log(`Backup created at ${backupDir}`);
