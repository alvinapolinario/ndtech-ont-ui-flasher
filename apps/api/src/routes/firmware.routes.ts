import { Router } from 'express';
import {
  firmwareService,
  analysisService,
  workspaceService,
  exportService,
  ValidationError,
} from '@ndtech/core';
import type { ExportKind } from '@ndtech/shared';
import { asyncHandler, sendData } from '../middleware/asyncHandler.js';
import { firmwareUpload } from '../middleware/upload.js';

export const firmwareRouter = Router();

// Upload firmware (multipart/form-data, field name "firmware").
firmwareRouter.post(
  '/',
  firmwareUpload.single('firmware'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ValidationError('No firmware file uploaded (field name "firmware").');
    const notes =
      typeof req.body?.notes === 'string' && req.body.notes.length > 0 ? req.body.notes : null;
    const firmware = await firmwareService.registerFirmware({
      storagePath: req.file.path,
      originalName: req.file.originalname,
      notes,
    });
    sendData(res, firmware, 201);
  }),
);

firmwareRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    sendData(res, await firmwareService.listFirmware());
  }),
);

firmwareRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    sendData(res, await firmwareService.getFirmware(req.params.id));
  }),
);

firmwareRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await firmwareService.deleteFirmwareRecord(req.params.id);
    sendData(res, { deleted: true });
  }),
);

// --- Analysis ---------------------------------------------------------------
firmwareRouter.post(
  '/:id/analyze',
  asyncHandler(async (req, res) => {
    sendData(res, await analysisService.runAnalysis(req.params.id), 201);
  }),
);

firmwareRouter.get(
  '/:id/analysis',
  asyncHandler(async (req, res) => {
    sendData(res, await analysisService.getLatestAnalysis(req.params.id));
  }),
);

firmwareRouter.get(
  '/:id/analyses',
  asyncHandler(async (req, res) => {
    sendData(res, await analysisService.listAnalyses(req.params.id));
  }),
);

// --- Workspaces -------------------------------------------------------------
firmwareRouter.post(
  '/:id/workspace',
  asyncHandler(async (req, res) => {
    sendData(res, await workspaceService.createWorkspace(req.params.id), 201);
  }),
);

firmwareRouter.get(
  '/:id/workspace',
  asyncHandler(async (req, res) => {
    sendData(res, await workspaceService.getLatestWorkspace(req.params.id));
  }),
);

firmwareRouter.get(
  '/:id/workspaces',
  asyncHandler(async (req, res) => {
    sendData(res, await workspaceService.listWorkspaces(req.params.id));
  }),
);

// --- Exports ----------------------------------------------------------------
firmwareRouter.get(
  '/:id/exports',
  asyncHandler(async (req, res) => {
    sendData(res, await exportService.listExports(req.params.id));
  }),
);

firmwareRouter.post(
  '/:id/exports',
  asyncHandler(async (req, res) => {
    const kind = req.body?.kind as ExportKind | undefined;
    if (!kind) throw new ValidationError('Missing "kind" in request body.');
    const includeOriginalFirmware = req.body?.includeOriginalFirmware === true;
    const job = await exportService.createExport(req.params.id, kind, { includeOriginalFirmware });
    sendData(res, job, 201);
  }),
);
