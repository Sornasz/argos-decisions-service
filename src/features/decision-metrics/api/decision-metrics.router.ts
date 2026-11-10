import { Router } from 'express';
import type { GetDecisionMetricsUseCase } from '../application/get-decision-metrics.use-case.js';

export function createDecisionMetricsRouter(useCase: GetDecisionMetricsUseCase): Router {
  const router = Router();
  router.get('/decisions/metrics', async (_request, response) => {
    response.json(await useCase.execute());
  });
  return router;
}
