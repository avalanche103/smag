import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { env } from "../config/env";

export interface StoredListImport {
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
}

const importDir = path.join(env.dataDir, "import-previews");

function ensureDir(): void {
  fs.mkdirSync(importDir, { recursive: true });
}

export function saveImportPreview(data: StoredListImport): string {
  ensureDir();
  const id = crypto.randomUUID();
  fs.writeFileSync(path.join(importDir, `${id}.json`), JSON.stringify(data), "utf-8");
  return id;
}

export function readImportPreview(id: string): StoredListImport | null {
  const filePath = path.join(importDir, `${id}.json`);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as StoredListImport;
}

export function deleteImportPreview(id: string): void {
  const filePath = path.join(importDir, `${id}.json`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}
