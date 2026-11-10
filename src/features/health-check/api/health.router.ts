import { Router } from 'express';
import type { CheckHealthUseCase } from '../application/check-health.use-case.js';

export function createHealthRouter(useCase: CheckHealthUseCase): Router {
  const router = Router();
  router.get('/health', async (_request, response) => {
    const health = await useCase.execute();
    response.status(health.status === 'ok' ? 200 : 503).json(health);
  });
  return router;
}
