import type { Review } from '../domain/review.js';
import type { ReviewUpdater } from './ports/review-updater.js';
import { parseUpdateReviewRequest, type InvalidField } from './update-review-request.js';

export type UpdateReviewOutcome =
  | { readonly kind: 'updated'; readonly review: Review }
  | { readonly kind: 'review_not_found' }
  | { readonly kind: 'invalid'; readonly invalidFields: InvalidField[] };

export interface UpdateReviewUseCase {
  execute(reviewId: string, body: unknown): Promise<UpdateReviewOutcome>;
}

export class UpdateReview implements UpdateReviewUseCase {
  constructor(private readonly updater: ReviewUpdater) {}

  async execute(reviewId: string, body: unknown): Promise<UpdateReviewOutcome> {
    const parsed = parseUpdateReviewRequest(body);
    if (!parsed.ok) return { kind: 'invalid', invalidFields: parsed.invalidFields };

    const review = await this.updater.update(reviewId, parsed.changes);
    return review ? { kind: 'updated', review } : { kind: 'review_not_found' };
  }
}
