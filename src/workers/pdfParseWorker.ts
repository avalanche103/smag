import { parentPort, workerData } from "node:worker_threads";
import { parsePublishedListPdf } from "../utils/publishedListPdf";

if (!parentPort) {
  throw new Error("pdfParseWorker must be run as a worker thread");
}

parsePublishedListPdf(workerData.filePath as string)
  .then((result) => {
    parentPort!.postMessage({ ok: true, result });
  })
  .catch((error: unknown) => {
    parentPort!.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
  });
