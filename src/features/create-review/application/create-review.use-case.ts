import type { Review } from '../domain/review.js';
import { parseCreateReviewRequest, type InvalidField } from './create-review-request.js';
import type { ReviewCreator } from './ports/review-creator.js';

export type CreateReviewOutcome =
  | { readonly kind: 'created'; readonly review: Review }
  | { readonly kind: 'decision_not_found' }
  | { readonly kind: 'invalid'; readonly invalidFields: InvalidField[] };

export interface CreateReviewUseCase {
  execute(decisionId: string, body: unknown): Promise<CreateReviewOutcome>;
}

export class CreateReview implements CreateReviewUseCase {
  constructor(private readonly creator: ReviewCreator) {}

  async execute(decisionId: string, body: unknown): Promise<CreateReviewOutcome> {
    const parsed = parseCreateReviewRequest(body);
    if (!parsed.ok) return { kind: 'invalid', invalidFields: parsed.invalidFields };

    const review = await this.creator.create(decisionId, parsed.review);
    return review ? { kind: 'created', review } : { kind: 'decision_not_found' };
  }
}
