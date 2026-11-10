import { Router } from 'express';
import { isUuid, sendInvalidId, sendNotFound } from '../../../shared/http.js';
import type { DeleteReviewUseCase } from '../application/delete-review.use-case.js';

export function createDeleteReviewRouter(useCase: DeleteReviewUseCase): Router {
  const router = Router();
  router.delete('/reviews/:id', async (request, response) => {
    const reviewId = request.params.id as string;
    if (!isUuid(reviewId)) {
      sendInvalidId(response, 'id');
      return;
    }
    const outcome = await useCase.execute(reviewId);
    if (outcome === 'not_found') {
      sendNotFound(response, 'Revisão não encontrada.');
      return;
    }
    response.status(204).end();
  });
  return router;
}
