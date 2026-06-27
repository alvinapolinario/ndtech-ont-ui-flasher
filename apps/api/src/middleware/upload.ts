import fs from 'node:fs';
import multer from 'multer';
import { config } from '@ndtech/core';

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120);
}

const firmwareStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(config.uploadsDir, { recursive: true });
    cb(null, config.uploadsDir);
  },
  filename: (_req, file, cb) => {
    cb(null, `${Date.now()}-${sanitize(file.originalname)}`);
  },
});

export const firmwareUpload = multer({
  storage: firmwareStorage,
  limits: { fileSize: config.maxUploadBytes },
});

const assetStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(config.profilesDir, { recursive: true });
    cb(null, config.profilesDir);
  },
  filename: (_req, file, cb) => {
    cb(null, `${Date.now()}-${sanitize(file.originalname)}`);
  },
});

/** Used for logo/favicon uploads (kept small). */
export const assetUpload = multer({
  storage: assetStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
});
