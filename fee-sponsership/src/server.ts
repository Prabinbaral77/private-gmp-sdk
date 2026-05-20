import express, { type Express, type NextFunction, type Request, type Response } from 'express';

import { FeeSponsor, PolicyError, ValidationError } from './sponsor.js';
import type { AppConfig, SponsorRequest } from './types.js';

export function createApp(config: AppConfig): Express {
  const sponsor = new FeeSponsor(config);
  const app = express();

  // The delegated prover's response carries BigInt fields (e.g. broadcast
  // status_code); JSON.stringify throws on those, so stringify them here.
  app.set('json replacer', (_key: string, value: unknown) =>
    typeof value === 'bigint' ? value.toString() : value,
  );

  app.use(express.json({ limit: '256kb' }));

  app.get('/health', (_req, res) => {
    res.json({
      ok: true,
      network: config.network,
      allowedPrograms: Object.fromEntries(
        Object.entries(config.allowlist).map(([k, v]) => [k, [...v]]),
      ),
    });
  });

  app.post('/sponsor', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = (req.body ?? {}) as Partial<SponsorRequest>;
      const result = await sponsor.sponsor({
        authorization: body.authorization as string,
        ...(body.priorityFeeCredits !== undefined
          ? { priorityFeeCredits: body.priorityFeeCredits }
          : {}),
        ...(body.broadcast !== undefined ? { broadcast: body.broadcast } : {}),
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
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
