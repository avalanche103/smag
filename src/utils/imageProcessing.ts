import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { env } from "../config/env";

const FULL_MAX_WIDTH = 1200;
const THUMB_MAX_WIDTH = 480;

function thumbCandidates(coverImage: string): string[] {
  const filename = path.basename(coverImage);
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  if (base.endsWith("-thumb")) {
    return [coverImage];
  }

  return [
    `/uploads/covers/${base}-thumb${ext}`,
    `/uploads/covers/${base}-thumb.jpg`,
    `/uploads/covers/${base}-thumb.webp`,
    `/uploads/covers/${base}-thumb.jpeg`
  ];
}

async function writeOptimizedJpeg(sourcePath: string, targetPath: string, width: number, quality: number): Promise<void> {
  const tempPath = `${targetPath}.tmp`;
  await sharp(sourcePath)
    .rotate()
    .resize({ width, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality, mozjpeg: true })
    .toFile(tempPath);
  await fsPromises.rename(tempPath, targetPath);
}

export async function processCoverImage(sourcePath: string, filename: string): Promise<{ fullPath: string; thumbPath: string; publicPath: string }> {
  const ext = path.extname(filename).toLowerCase();
  const baseName = path.basename(filename, ext);
  const fullFilename = `${baseName}.jpg`;
  const thumbFilename = `${baseName}-thumb.jpg`;
  const fullDiskPath = path.join(env.coversDir, fullFilename);
  const thumbDiskPath = path.join(env.coversDir, thumbFilename);

  await writeOptimizedJpeg(sourcePath, fullDiskPath, FULL_MAX_WIDTH, 86);
  await writeOptimizedJpeg(sourcePath, thumbDiskPath, THUMB_MAX_WIDTH, 82);

  if (path.resolve(sourcePath) !== path.resolve(fullDiskPath)) {
    await fsPromises.unlink(sourcePath).catch(() => undefined);
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

  for (const candidate of thumbCandidates(coverImage)) {
    const diskPath = path.join(env.coversDir, path.basename(candidate));
    if (fs.existsSync(diskPath)) {
      return candidate;
    }
  }

  const fullPath = path.join(env.coversDir, path.basename(coverImage));
  if (fs.existsSync(fullPath)) {
    return coverImage;
  }

  const ext = path.extname(coverImage);
  const base = path.basename(coverImage, ext);
  const jpegFallback = `/uploads/covers/${base}.jpg`;
  if (fs.existsSync(path.join(env.coversDir, `${base}.jpg`))) {
    return jpegFallback;
  }

  return coverImage;
}
