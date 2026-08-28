import path from "node:path";
import { ensureDataFile } from "../src/db";
import { applyArchivePublishedMaterialsImport, listPublishedMaterialsForPage } from "../src/services/contentService";
import { parsePublishedListPdf } from "../src/utils/publishedListPdf";

async function main() {
  ensureDataFile();

  const files = [
    "Stroitelstvo_06-2024.pdf",
    "Stroitelstvo_06-2025.pdf",
    "Stroitelstvo_11-2024.pdf",
    "Stroitelstvo_12-2025.pdf",
    "Перечень_06_2026.pdf"
  ];

  let totalAdded = 0;
  let totalSkipped = 0;

  for (const file of files) {
    const filePath = path.join(process.cwd(), file);
    const parsed = await parsePublishedListPdf(filePath);
    const result = applyArchivePublishedMaterialsImport(parsed.year, parsed.entries);
    console.log(
      `${file}: year=${parsed.year} parsed=${parsed.entries.length} added=${result.added} skipped=${result.skipped}`
    );
    totalAdded += result.added;
    totalSkipped += result.skipped;
  }

  console.log(`Total added=${totalAdded} skipped=${totalSkipped}`);
  console.log(`Published materials on page=${listPublishedMaterialsForPage().length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
