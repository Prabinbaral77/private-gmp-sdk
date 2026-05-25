import express, { type Express, type NextFunction, type Request, type Response } from 'express';

import { AuthError, FeeSponsor, PolicyError, ValidationError } from './sponsor.js';
import type { AppConfig, FeeAuthorizationRequest } from './types.js';

export function createApp(config: AppConfig): Express {
  const sponsor = new FeeSponsor(config);
  const app = express();

  app.use(express.json({ limit: '32kb' }));

  app.get('/health', (_req, res) => {
    res.json({
      ok: true,
      network: config.network,
      authConfigured: config.apiKeys.size > 0,
      maxBaseFeeCredits: config.maxBaseFeeCredits,
      maxPriorityFeeCredits: config.maxPriorityFeeCredits,
    });
  });

  app.post('/fee-authorization', async (req: Request, res: Response, next: NextFunction) => {
    try {
      sponsor.authenticate(extractApiKey(req));
      const body = (req.body ?? {}) as Partial<FeeAuthorizationRequest>;
      const result = await sponsor.signFee({
        executionId: body.executionId as string,
        baseFeeCredits: body.baseFeeCredits as number,
        ...(body.priorityFeeCredits !== undefined
          ? { priorityFeeCredits: body.priorityFeeCredits }
          : {}),
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AuthError) {
      res.status(401).json({ error: err.message });
      return;
    }
    if (err instanceof ValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    if (err instanceof PolicyError) {
      res.status(403).json({ error: err.message });
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  });

  return app;
}

function extractApiKey(req: Request): string | undefined {
  const header = req.header('authorization');
  if (header) {
    const match = /^Bearer\s+(.+)$/i.exec(header);
    if (match && match[1]) return match[1].trim();
  }
  const xKey = req.header('x-api-key');
  return xKey && xKey.length > 0 ? xKey : undefined;
}
