import type { MemoryDatabase } from '../../../shared/memory-database.js';
import type { ReviewUpdater } from '../application/ports/review-updater.js';
import type { Review, ReviewChanges } from '../domain/review.js';

export class MemoryReviewUpdater implements ReviewUpdater {
  constructor(private readonly database: MemoryDatabase) {}

  async update(reviewId: string, changes: ReviewChanges): Promise<Review | null> {
    const review = this.database.reviews.get(reviewId.toLowerCase());
    if (!review) return null;

    if (changes.incorrect !== undefined) review.incorrect = changes.incorrect;
    if (changes.comment !== undefined) review.comment = changes.comment;
    review.updatedAt = new Date();
    this.database.refreshMarkedIncorrect(review.decisionId);

    return {
      id: review.id,
      decisionId: review.decisionId,
      analyst: { name: review.analystName, email: review.analystEmail },
      incorrect: review.incorrect,
      comment: review.comment,
      reviewedAt: review.reviewedAt,
      updatedAt: review.updatedAt,
    };
  }
}
