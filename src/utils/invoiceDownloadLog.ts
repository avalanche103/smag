import fs from "node:fs";
import path from "node:path";
import { env } from "../config/env";

export type InvoiceKey = "invoice1" | "invoice2";

export interface InvoiceDownloadEntry {
  at: string;
  invoiceKey: InvoiceKey;
  label: string;
  filename: string;
  ip: string;
  ua: string;
}

export interface InvoiceDownloadTotals {
  invoice1: number;
  invoice2: number;
  total: number;
}

export interface InvoiceDownloadStats {
  today: InvoiceDownloadTotals;
  last7Days: InvoiceDownloadTotals;
  allTime: InvoiceDownloadTotals;
  labels: { invoice1: string; invoice2: string };
}

export const INVOICE_STATS_TIME_ZONE = "Europe/Minsk";

const logFile = path.join(env.dataDir, "invoice-downloads.jsonl");

function emptyTotals(): InvoiceDownloadTotals {
  return { invoice1: 0, invoice2: 0, total: 0 };
}

function addToTotals(totals: InvoiceDownloadTotals, key: InvoiceKey): void {
  totals[key] += 1;
  totals.total += 1;
}

export function getClientIp(req: {
  ip?: string;
  headers: Record<string, unknown>;
  socket?: { remoteAddress?: string };
}): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0]?.trim() || "";
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return String(forwarded[0]).split(",")[0]?.trim() || "";
  }
  return (req.ip || req.socket?.remoteAddress || "").replace(/^::ffff:/, "");
}

export function recordInvoiceDownload(entry: Omit<InvoiceDownloadEntry, "at"> & { at?: string }): void {
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  const line =
    JSON.stringify({
      at: entry.at || new Date().toISOString(),
      invoiceKey: entry.invoiceKey,
      label: entry.label,
      filename: entry.filename,
      ip: entry.ip || "",
      ua: entry.ua || ""
    } satisfies InvoiceDownloadEntry) + "\n";
  fs.appendFileSync(logFile, line, "utf-8");
}

export function readInvoiceDownloads(): InvoiceDownloadEntry[] {
  if (!fs.existsSync(logFile)) {
    return [];
  }

  const lines = fs.readFileSync(logFile, "utf-8").split(/\r?\n/);
  const entries: InvoiceDownloadEntry[] = [];
  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }
    try {
      const parsed = JSON.parse(line) as InvoiceDownloadEntry;
      if (parsed.invoiceKey === "invoice1" || parsed.invoiceKey === "invoice2") {
        entries.push(parsed);
      }
    } catch {
      // skip broken lines
    }
  }
  return entries;
}

/** Calendar YYYY-MM-DD in Europe/Minsk for an Instant. */
export function minskDateYmd(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: INVOICE_STATS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function minskTimeHm(iso: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: INVOICE_STATS_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(iso));
}

function entryDateYmd(entry: InvoiceDownloadEntry): string {
  return minskDateYmd(new Date(entry.at));
}

export function summarizeInvoiceDownloads(labels?: { invoice1?: string; invoice2?: string }): InvoiceDownloadStats {
  const todayYmd = minskDateYmd();
  const today = emptyTotals();
  const last7Days = emptyTotals();
  const allTime = emptyTotals();

  const weekAgo = new Date();
  weekAgo.setUTCDate(weekAgo.getUTCDate() - 6);
  const weekStartYmd = minskDateYmd(weekAgo);

  for (const entry of readInvoiceDownloads()) {
    addToTotals(allTime, entry.invoiceKey);
    const ymd = entryDateYmd(entry);
    if (ymd === todayYmd) {
      addToTotals(today, entry.invoiceKey);
    }
    if (ymd >= weekStartYmd && ymd <= todayYmd) {
      addToTotals(last7Days, entry.invoiceKey);
    }
  }

  return {
    today,
    last7Days,
    allTime,
    labels: {
      invoice1: labels?.invoice1 || "Счёт 1",
      invoice2: labels?.invoice2 || "Счёт 2"
    }
  };
}

export function readDayEntries(dateYmd: string): InvoiceDownloadEntry[] {
  return readInvoiceDownloads().filter((entry) => entryDateYmd(entry) === dateYmd);
}

export function totalsForEntries(entries: InvoiceDownloadEntry[]): InvoiceDownloadTotals {
  const totals = emptyTotals();
  for (const entry of entries) {
    addToTotals(totals, entry.invoiceKey);
  }
  return totals;
}
