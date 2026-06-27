import { Router } from 'express';
import {
  workspaceService,
  assetService,
  patchService,
  repackService,
  ValidationError,
} from '@ndtech/core';
import { asyncHandler, sendData } from '../middleware/asyncHandler.js';

export const workspaceRouter = Router();

workspaceRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    sendData(res, await workspaceService.getWorkspace(req.params.id));
  }),
);

workspaceRouter.post(
  '/:id/rescan',
  asyncHandler(async (req, res) => {
    sendData(res, await workspaceService.rescanWorkspaceAssets(req.params.id));
  }),
);

workspaceRouter.get(
  '/:id/assets',
  asyncHandler(async (req, res) => {
    sendData(res, await assetService.listAssets(req.params.id));
  }),
);

// Apply a branding profile to the extracted web assets (backups are automatic).
workspaceRouter.post(
  '/:id/branding',
  asyncHandler(async (req, res) => {
    const profileId = req.body?.profileId as string | undefined;
    if (!profileId) throw new ValidationError('Missing "profileId" in request body.');
    const result = await patchService.applyBrandingToWorkspace(req.params.id, profileId, {
      logoSourcePath: req.body?.logoSourcePath ?? null,
      faviconSourcePath: req.body?.faviconSourcePath ?? null,
    });
    sendData(res, result, 201);
  }),
);

workspaceRouter.get(
  '/:id/patches',
  asyncHandler(async (req, res) => {
    sendData(res, await patchService.listPatches(req.params.id));
  }),
);

workspaceRouter.post(
  '/:id/revert',
  asyncHandler(async (req, res) => {
    const restored = await patchService.revertWorkspace(req.params.id);
    sendData(res, { restored });
  }),
);

// Patch report as standalone HTML (also printable to PDF in the browser).
workspaceRouter.get(
  '/:id/report',
  asyncHandler(async (req, res) => {
    const html = await patchService.generateReportHtml(req.params.id);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }),
);

workspaceRouter.get(
  '/:id/repack',
  asyncHandler(async (req, res) => {
    sendData(res, await repackService.analyzeRepack(req.params.id));
  }),
);
