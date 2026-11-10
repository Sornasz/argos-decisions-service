import { Router } from 'express';
import { isUuid, reviewToJson, sendInvalidId, sendInvalidRequest, sendNotFound } from '../../../shared/http.js';
import type { CreateReviewUseCase } from '../application/create-review.use-case.js';

export function createCreateReviewRouter(useCase: CreateReviewUseCase): Router {
  const router = Router();
  router.post('/decisions/:id/reviews', async (request, response) => {
    const decisionId = request.params.id as string;
    if (!isUuid(decisionId)) {
      sendInvalidId(response, 'id');
      return;
    }
    const outcome = await useCase.execute(decisionId, request.body);
    switch (outcome.kind) {
      case 'invalid':
        sendInvalidRequest(response, outcome.invalidFields);
        return;
      case 'decision_not_found':
        sendNotFound(response, 'Decisão não encontrada.');
        return;
      case 'created':
        response.status(201).location(`/reviews/${outcome.review.id}`).json(reviewToJson(outcome.review));
    }
  });
  return router;
}
