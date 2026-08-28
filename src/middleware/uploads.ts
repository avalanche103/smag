import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { nanoid } from "nanoid";
import { env } from "../config/env";

function createStorage(targetDir: string) {
  fs.mkdirSync(targetDir, { recursive: true });

  return multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, targetDir),
    filename: (_req, file, callback) => {
      const ext = path.extname(file.originalname).toLowerCase();
      callback(null, `${Date.now()}-${nanoid(8)}${ext}`);
    }
  });
}

function hasAllowedExtension(filename: string, extensions: Set<string>): boolean {
  return extensions.has(path.extname(filename).toLowerCase());
}

export const coverUpload = multer({
  storage: createStorage(env.coversDir),
  fileFilter: (_req, file, callback) => {
    callback(null, /image\/(jpeg|png|webp)/.test(file.mimetype) && hasAllowedExtension(file.originalname, new Set([".jpg", ".jpeg", ".png", ".webp"])));
  },
  limits: { fileSize: 8 * 1024 * 1024 }
});

export const invoiceUpload = multer({
  storage: createStorage(env.invoicesDir),
  fileFilter: (_req, file, callback) => callback(null, file.mimetype === "application/pdf" && hasAllowedExtension(file.originalname, new Set([".pdf"]))),
  limits: { fileSize: 15 * 1024 * 1024 }
});

export const listUpload = multer({
  storage: createStorage(env.listsDir),
  fileFilter: (_req, file, callback) => {
    callback(
      null,
      file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" &&
        hasAllowedExtension(file.originalname, new Set([".xlsx"]))
    );
  },
  limits: { fileSize: 15 * 1024 * 1024 }
});

export const pdfListUpload = multer({
  storage: createStorage(env.listsDir),
  fileFilter: (_req, file, callback) => {
    const isPdf = file.mimetype === "application/pdf" || file.originalname.toLowerCase().endsWith(".pdf");
    callback(null, isPdf && hasAllowedExtension(file.originalname, new Set([".pdf"])));
  },
  limits: { fileSize: 15 * 1024 * 1024 }
});
