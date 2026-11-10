import type { FeatureHttp } from '../../shared/feature-http.js';
import type { Persistence } from '../../shared/persistence.js';
import { listReviewsPaths } from './api/list-reviews.openapi.js';
import { createListReviewsRouter } from './api/list-reviews.router.js';
import { ListReviews } from './application/list-reviews.use-case.js';
import type { ReviewReader } from './application/ports/review-reader.js';
import { MemoryReviewReader } from './infrastructure/memory-review-reader.js';
import { SqlReviewReader } from './infrastructure/sql-review-reader.js';

export function createListReviewsFeature(options: { readonly persistence: Persistence }): FeatureHttp {
  const reader: ReviewReader =
    options.persistence.kind === 'sql'
      ? new SqlReviewReader(options.persistence.pool)
      : new MemoryReviewReader(options.persistence.database);
  return { router: createListReviewsRouter(new ListReviews(reader)), openApiPaths: listReviewsPaths };
}
