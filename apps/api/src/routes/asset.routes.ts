import { Router } from 'express';
import path from 'node:path';
import { assetService } from '@ndtech/core';
import { asyncHandler, sendData } from '../middleware/asyncHandler.js';

export const assetRouter = Router();

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  // Stylesheets/scripts must carry a correct MIME type or browsers refuse to
  // apply them when referenced from the preview iframe.
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

assetRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    sendData(res, await assetService.getAsset(req.params.id));
  }),
);

assetRouter.get(
  '/:id/content',
  asyncHandler(async (req, res) => {
    sendData(res, await assetService.readAssetContent(req.params.id));
  }),
);

// Serve raw bytes (used to render images/favicons in the preview pane).
assetRouter.get(
  '/:id/raw',
  asyncHandler(async (req, res) => {
    const { asset, bytes } = await assetService.readAssetBytes(req.params.id);
    const ext = path.extname(asset.relativePath).toLowerCase();
    res.setHeader('Content-Type', MIME_BY_EXT[ext] ?? 'application/octet-stream');
    res.send(bytes);
  }),
);
