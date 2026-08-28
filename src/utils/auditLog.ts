import fs from "node:fs";
import path from "node:path";
import { env } from "../config/env";

export interface AuditEntry {
  at: string;
  adminLogin: string;
  action: string;
  details?: string;
}

const auditFile = path.join(env.dataDir, "audit.log");

export function writeAuditLog(entry: Omit<AuditEntry, "at">): void {
  fs.mkdirSync(path.dirname(auditFile), { recursive: true });
  const line = JSON.stringify({ ...entry, at: new Date().toISOString() }) + "\n";
  fs.appendFileSync(auditFile, line, "utf-8");
}
