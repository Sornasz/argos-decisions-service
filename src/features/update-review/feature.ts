import type { FeatureHttp } from '../../shared/feature-http.js';
import type { Persistence } from '../../shared/persistence.js';
import { updateReviewPaths } from './api/update-review.openapi.js';
import { createUpdateReviewRouter } from './api/update-review.router.js';
import type { ReviewUpdater } from './application/ports/review-updater.js';
import { UpdateReview } from './application/update-review.use-case.js';
import { MemoryReviewUpdater } from './infrastructure/memory-review-updater.js';
import { SqlReviewUpdater } from './infrastructure/sql-review-updater.js';

export function createUpdateReviewFeature(options: { readonly persistence: Persistence }): FeatureHttp {
  const updater: ReviewUpdater =
    options.persistence.kind === 'sql'
      ? new SqlReviewUpdater(options.persistence.pool)
      : new MemoryReviewUpdater(options.persistence.database);
  return { router: createUpdateReviewRouter(new UpdateReview(updater)), openApiPaths: updateReviewPaths };
}
