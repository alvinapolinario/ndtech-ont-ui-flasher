import { Router } from 'express';
import { systemRouter } from './system.routes.js';
import { firmwareRouter } from './firmware.routes.js';
import { workspaceRouter } from './workspace.routes.js';
import { assetRouter } from './asset.routes.js';
import { brandingRouter } from './branding.routes.js';

export const apiRouter = Router();

apiRouter.use('/system', systemRouter);
apiRouter.use('/firmware', firmwareRouter);
apiRouter.use('/workspaces', workspaceRouter);
apiRouter.use('/assets', assetRouter);
apiRouter.use('/profiles', brandingRouter);
