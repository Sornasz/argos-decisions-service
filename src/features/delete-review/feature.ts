import type { FeatureHttp } from '../../shared/feature-http.js';
import type { Persistence } from '../../shared/persistence.js';
import { deleteReviewPaths } from './api/delete-review.openapi.js';
import { createDeleteReviewRouter } from './api/delete-review.router.js';
import { DeleteReview } from './application/delete-review.use-case.js';
import type { ReviewRemover } from './application/ports/review-remover.js';
import { MemoryReviewRemover } from './infrastructure/memory-review-remover.js';
import { SqlReviewRemover } from './infrastructure/sql-review-remover.js';

export function createDeleteReviewFeature(options: { readonly persistence: Persistence }): FeatureHttp {
  const remover: ReviewRemover =
    options.persistence.kind === 'sql'
      ? new SqlReviewRemover(options.persistence.pool)
      : new MemoryReviewRemover(options.persistence.database);
  return { router: createDeleteReviewRouter(new DeleteReview(remover)), openApiPaths: deleteReviewPaths };
}
