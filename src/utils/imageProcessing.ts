import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { env } from "../config/env";

const FULL_MAX_WIDTH = 1200;
const THUMB_MAX_WIDTH = 400;

export async function processCoverImage(sourcePath: string, filename: string): Promise<{ fullPath: string; thumbPath: string; publicPath: string }> {
  const ext = path.extname(filename).toLowerCase();
  const baseName = path.basename(filename, ext);
  const fullFilename = `${baseName}.webp`;
  const thumbFilename = `${baseName}-thumb.webp`;
  const fullDiskPath = path.join(env.coversDir, fullFilename);
  const thumbDiskPath = path.join(env.coversDir, thumbFilename);

  await sharp(sourcePath)
    .rotate()
    .resize({ width: FULL_MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(fullDiskPath);

  await sharp(sourcePath)
    .rotate()
    .resize({ width: THUMB_MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(thumbDiskPath);

  if (path.resolve(sourcePath) !== path.resolve(fullDiskPath)) {
    await fs.unlink(sourcePath).catch(() => undefined);
  }

  return {
    fullPath: fullDiskPath,
    thumbPath: thumbDiskPath,
    publicPath: `/uploads/covers/${fullFilename}`
  };
}

export function getCoverThumbPath(coverImage: string): string {
  if (!coverImage.startsWith("/uploads/covers/")) {
    return coverImage;
  }
  const filename = path.basename(coverImage);
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  if (base.endsWith("-thumb")) {
    return coverImage;
  }
  return `/uploads/covers/${base}-thumb.webp`;
}
