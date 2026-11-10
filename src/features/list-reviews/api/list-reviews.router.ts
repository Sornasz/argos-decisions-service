import { Router } from 'express';
import { isUuid, reviewToJson, sendInvalidId, sendNotFound } from '../../../shared/http.js';
import type { ListReviewsUseCase } from '../application/list-reviews.use-case.js';

export function createListReviewsRouter(useCase: ListReviewsUseCase): Router {
  const router = Router();
  router.get('/decisions/:id/reviews', async (request, response) => {
    const decisionId = request.params.id as string;
    if (!isUuid(decisionId)) {
      sendInvalidId(response, 'id');
      return;
    }
    const outcome = await useCase.execute(decisionId);
    if (outcome.kind === 'decision_not_found') {
      sendNotFound(response, 'Decisão não encontrada.');
      return;
    }
    response.json({ items: outcome.reviews.map(reviewToJson) });
  });
  return router;
}
