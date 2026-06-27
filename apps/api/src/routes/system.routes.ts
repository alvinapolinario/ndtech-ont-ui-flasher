import { Router } from 'express';
import { environmentService } from '@ndtech/core';
import { SAFETY_NOTICE } from '@ndtech/shared';
import { asyncHandler, sendData } from '../middleware/asyncHandler.js';

export const systemRouter = Router();

systemRouter.get(
  '/status',
  asyncHandler(async (_req, res) => {
    sendData(res, await environmentService.getSystemStatus());
  }),
);

systemRouter.get('/safety', (_req, res) => {
  sendData(res, { notice: SAFETY_NOTICE });
});
