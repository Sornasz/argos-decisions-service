import type { ReviewRemoval } from '../domain/review-removal.js';
import type { ReviewRemover } from './ports/review-remover.js';

export interface DeleteReviewUseCase {
  execute(reviewId: string): Promise<ReviewRemoval>;
}

export class DeleteReview implements DeleteReviewUseCase {
  constructor(private readonly remover: ReviewRemover) {}

  execute(reviewId: string): Promise<ReviewRemoval> {
    return this.remover.remove(reviewId);
  }
}
