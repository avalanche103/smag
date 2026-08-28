import path from "node:path";
import { Worker } from "node:worker_threads";
import { env } from "../config/env";
import type { PublishedListParseResult } from "./publishedListPdf";

const PARSE_TIMEOUT_MS = 30_000;

export function parsePublishedListPdfInWorker(filePath: string): Promise<PublishedListParseResult> {
  return new Promise((resolve, reject) => {
    const workerPath = env.isProduction
      ? path.join(__dirname, "..", "workers", "pdfParseWorker.js")
      : path.join(env.rootDir, "src", "workers", "pdfParseWorker.ts");
    const worker = new Worker(workerPath, {
      workerData: { filePath },
      execArgv: env.isProduction ? [] : ["-r", "ts-node/register", "--transpile-only"]
    });
    const timer = setTimeout(() => {
      worker.terminate().catch(() => undefined);
      reject(new Error("PDF parsing timed out"));
    }, PARSE_TIMEOUT_MS);

    worker.once("message", (message: { ok: boolean; result?: PublishedListParseResult; error?: string }) => {
      clearTimeout(timer);
      if (message.ok && message.result) {
        resolve(message.result);
        return;
      }
      reject(new Error(message.error ?? "PDF parsing failed"));
    });

    worker.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}
