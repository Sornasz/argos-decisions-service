import type { MemoryDatabase } from '../../../shared/memory-database.js';
import type { ReviewRemover } from '../application/ports/review-remover.js';
import type { ReviewRemoval } from '../domain/review-removal.js';

export class MemoryReviewRemover implements ReviewRemover {
  constructor(private readonly database: MemoryDatabase) {}

  async remove(reviewId: string): Promise<ReviewRemoval> {
    const key = reviewId.toLowerCase();
    const review = this.database.reviews.get(key);
    if (!review) return 'not_found';
    this.database.reviews.delete(key);
    this.database.refreshMarkedIncorrect(review.decisionId);
    return 'removed';
  }
}
