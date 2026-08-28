import fs from "node:fs";
import path from "node:path";
import { env } from "../config/env";
import { processCoverImage } from "../utils/imageProcessing";

async function main(): Promise<void> {
  const files = fs.readdirSync(env.coversDir).filter((name) => !name.endsWith("-thumb.webp"));
  let processed = 0;

  for (const filename of files) {
    const sourcePath = path.join(env.coversDir, filename);
    if (!fs.statSync(sourcePath).isFile()) {
      continue;
    }

    const ext = path.extname(filename).toLowerCase();
    if (![".jpg", ".jpeg", ".png", ".webp"].includes(ext)) {
      continue;
    }

    await processCoverImage(sourcePath, filename);
    processed += 1;
    console.log(`Processed ${filename}`);
  }

  console.log(`Done. Recompressed ${processed} cover(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
