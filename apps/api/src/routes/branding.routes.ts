import { Router } from 'express';
import { brandingService, ValidationError } from '@ndtech/core';
import { asyncHandler, sendData } from '../middleware/asyncHandler.js';
import { assetUpload } from '../middleware/upload.js';

export const brandingRouter = Router();

const IMAGE_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

brandingRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    sendData(res, await brandingService.listProfiles());
  }),
);

brandingRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    sendData(res, await brandingService.createProfile(req.body ?? {}), 201);
  }),
);

brandingRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    sendData(res, await brandingService.getProfile(req.params.id));
  }),
);

brandingRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    sendData(res, await brandingService.updateProfile(req.params.id, req.body ?? {}));
  }),
);

brandingRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await brandingService.deleteProfile(req.params.id);
    sendData(res, { deleted: true });
  }),
);

brandingRouter.get(
  '/:id/export',
  asyncHandler(async (req, res) => {
    const filePath = await brandingService.exportProfileJson(req.params.id);
    sendData(res, { path: filePath });
  }),
);

brandingRouter.post(
  '/:id/logo',
  assetUpload.single('logo'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ValidationError('No logo uploaded (field name "logo").');
    sendData(res, await brandingService.setProfileAsset(req.params.id, 'logo', req.file.path));
  }),
);

brandingRouter.post(
  '/:id/favicon',
  assetUpload.single('favicon'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ValidationError('No favicon uploaded (field name "favicon").');
    sendData(res, await brandingService.setProfileAsset(req.params.id, 'favicon', req.file.path));
  }),
);

// Serve the stored logo/favicon bytes so the UI can show a thumbnail preview.
brandingRouter.get(
  '/:id/logo',
  asyncHandler(async (req, res) => {
    const { bytes, ext } = await brandingService.readProfileAssetBytes(req.params.id, 'logo');
    res.setHeader('Content-Type', IMAGE_MIME[ext] ?? 'application/octet-stream');
    res.send(bytes);
  }),
);

brandingRouter.get(
  '/:id/favicon',
  asyncHandler(async (req, res) => {
    const { bytes, ext } = await brandingService.readProfileAssetBytes(req.params.id, 'favicon');
    res.setHeader('Content-Type', IMAGE_MIME[ext] ?? 'application/octet-stream');
    res.send(bytes);
  }),
);
