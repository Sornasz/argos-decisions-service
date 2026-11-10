import type { Review } from '../domain/review.js';
import type { ReviewReader } from './ports/review-reader.js';

export type ListReviewsOutcome =
  | { readonly kind: 'listed'; readonly reviews: Review[] }
  | { readonly kind: 'decision_not_found' };

export interface ListReviewsUseCase {
  execute(decisionId: string): Promise<ListReviewsOutcome>;
}

export class ListReviews implements ListReviewsUseCase {
  constructor(private readonly reader: ReviewReader) {}

  async execute(decisionId: string): Promise<ListReviewsOutcome> {
    const reviews = await this.reader.listByDecision(decisionId);
    return reviews ? { kind: 'listed', reviews } : { kind: 'decision_not_found' };
  }
}
