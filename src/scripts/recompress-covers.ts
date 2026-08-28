import fs from "node:fs";
import path from "node:path";
import { env } from "../config/env";
import { readStore, writeStore } from "../db";
import { processCoverImage } from "../utils/imageProcessing";

async function main(): Promise<void> {
  const files = fs
    .readdirSync(env.coversDir)
    .filter((name) => /\.(jpe?g|png|webp)$/i.test(name) && !name.includes("-thumb."));

  let processed = 0;
  const pathUpdates = new Map<string, string>();

  for (const filename of files) {
    const sourcePath = path.join(env.coversDir, filename);
    if (!fs.statSync(sourcePath).isFile()) {
      continue;
    }

    const result = await processCoverImage(sourcePath, filename);
    const oldPublic = `/uploads/covers/${filename}`;
    pathUpdates.set(oldPublic, result.publicPath);
    processed += 1;
    console.log(`Processed ${filename} -> ${path.basename(result.publicPath)}`);
  }

  if (pathUpdates.size) {
    const store = readStore();
    let updatedIssues = 0;

    for (const issue of store.issues) {
      const nextPath = pathUpdates.get(issue.coverImage);
      if (nextPath && nextPath !== issue.coverImage) {
        issue.coverImage = nextPath;
        updatedIssues += 1;
      }
    }

    if (updatedIssues) {
      writeStore(store);
      console.log(`Updated cover paths for ${updatedIssues} issue(s) in content.json`);
    }
  }

  console.log(`Done. Recompressed ${processed} cover(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
