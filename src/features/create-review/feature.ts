import type { FeatureHttp } from '../../shared/feature-http.js';
import type { Persistence } from '../../shared/persistence.js';
import { createReviewPaths } from './api/create-review.openapi.js';
import { createCreateReviewRouter } from './api/create-review.router.js';
import { CreateReview } from './application/create-review.use-case.js';
import type { ReviewCreator } from './application/ports/review-creator.js';
import { MemoryReviewCreator } from './infrastructure/memory-review-creator.js';
import { SqlReviewCreator } from './infrastructure/sql-review-creator.js';

export function createCreateReviewFeature(options: { readonly persistence: Persistence }): FeatureHttp {
  const creator: ReviewCreator =
    options.persistence.kind === 'sql'
      ? new SqlReviewCreator(options.persistence.pool)
      : new MemoryReviewCreator(options.persistence.database);
  return { router: createCreateReviewRouter(new CreateReview(creator)), openApiPaths: createReviewPaths };
}
