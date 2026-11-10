import { Router } from 'express';
import { isUuid, reviewToJson, sendInvalidId, sendInvalidRequest, sendNotFound } from '../../../shared/http.js';
import type { UpdateReviewUseCase } from '../application/update-review.use-case.js';

export function createUpdateReviewRouter(useCase: UpdateReviewUseCase): Router {
  const router = Router();
  router.put('/reviews/:id', async (request, response) => {
    const reviewId = request.params.id as string;
    if (!isUuid(reviewId)) {
      sendInvalidId(response, 'id');
      return;
    }
    const outcome = await useCase.execute(reviewId, request.body);
    switch (outcome.kind) {
      case 'invalid':
        sendInvalidRequest(response, outcome.invalidFields);
        return;
      case 'review_not_found':
        sendNotFound(response, 'Revisão não encontrada.');
        return;
      case 'updated':
        response.json(reviewToJson(outcome.review));
    }
  });
  return router;
}
