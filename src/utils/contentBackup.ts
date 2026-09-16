import fs from "node:fs";
import path from "node:path";
import { env } from "../config/env";

export const MUTATION_KEEP = 30;
export const DAILY_KEEP = 14;
export const PRE_DEPLOY_KEEP = 10;

function backupRoot(): string {
  return path.join(env.dataDir, "backups");
}

function mutationsDir(): string {
  return path.join(backupRoot(), "mutations");
}

function stampNow(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function sortedByMtimeDesc(entries: string[]): string[] {
  return entries
    .map((entryPath) => ({
      entryPath,
      mtime: fs.statSync(entryPath).mtimeMs
    }))
    .sort((a, b) => b.mtime - a.mtime)
    .map((item) => item.entryPath);
}

function removePath(target: string): void {
  fs.rmSync(target, { recursive: true, force: true });
}

export function pruneOldest(paths: string[], keep: number): void {
  const ordered = sortedByMtimeDesc(paths);
  for (const stale of ordered.slice(keep)) {
    removePath(stale);
  }
}

/** Snapshot content.json before a write. Keeps the last MUTATION_KEEP copies. */
export function snapshotContentBeforeWrite(): void {
  if (!fs.existsSync(env.contentFile)) {
    return;
  }

  const dir = mutationsDir();
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, `content-${stampNow()}.json`);
  fs.copyFileSync(env.contentFile, target);

  const files = fs
    .readdirSync(dir)
    .filter((name) => name.startsWith("content-") && name.endsWith(".json"))
    .map((name) => path.join(dir, name));
  pruneOldest(files, MUTATION_KEEP);
}

export function createDailyBackup(): string {
  const stamp = stampNow();
  const dir = path.join(backupRoot(), stamp);
  fs.mkdirSync(dir, { recursive: true });

  if (fs.existsSync(env.contentFile)) {
    fs.copyFileSync(env.contentFile, path.join(dir, "content.json"));
  }

  if (fs.existsSync(env.uploadsDir)) {
    fs.cpSync(env.uploadsDir, path.join(dir, "uploads"), { recursive: true });
  }

  pruneBackupRetention();
  return dir;
}

/** Prune daily folders, pre-deploy folders, and mutation snapshots. */
export function pruneBackupRetention(): void {
  const root = backupRoot();
  if (!fs.existsSync(root)) {
    return;
  }

  const children = fs.readdirSync(root, { withFileTypes: true });
  const dailyDirs: string[] = [];
  const preDeployDirs: string[] = [];

  for (const child of children) {
    const full = path.join(root, child.name);
    if (!child.isDirectory()) {
      continue;
    }
    if (child.name === "mutations") {
      continue;
    }
    if (child.name.startsWith("pre-deploy-")) {
      preDeployDirs.push(full);
      continue;
    }
    dailyDirs.push(full);
  }

  pruneOldest(dailyDirs, DAILY_KEEP);
  pruneOldest(preDeployDirs, PRE_DEPLOY_KEEP);

  const mutDir = mutationsDir();
  if (fs.existsSync(mutDir)) {
    const files = fs
      .readdirSync(mutDir)
      .filter((name) => name.startsWith("content-") && name.endsWith(".json"))
      .map((name) => path.join(mutDir, name));
    pruneOldest(files, MUTATION_KEEP);
  }
}
