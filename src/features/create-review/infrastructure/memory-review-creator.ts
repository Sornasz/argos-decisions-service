import type { MemoryDatabase } from '../../../shared/memory-database.js';
import type { ReviewCreator } from '../application/ports/review-creator.js';
import type { NewReview, Review } from '../domain/review.js';

export class MemoryReviewCreator implements ReviewCreator {
  constructor(private readonly database: MemoryDatabase) {}

  async create(decisionId: string, review: NewReview): Promise<Review | null> {
    const key = decisionId.toLowerCase();
    if (!this.database.decisions.has(key)) return null;

    const stored = {
      id: this.database.newId(),
      decisionId: key,
      analystName: review.analyst.name,
      analystEmail: review.analyst.email,
      incorrect: review.incorrect,
      comment: review.comment,
      reviewedAt: new Date(),
      updatedAt: null,
    };
    this.database.reviews.set(stored.id, stored);
    this.database.refreshMarkedIncorrect(key);

    return {
      id: stored.id,
      decisionId: key,
      analyst: { name: stored.analystName, email: stored.analystEmail },
      incorrect: stored.incorrect,
      comment: stored.comment,
      reviewedAt: stored.reviewedAt,
      updatedAt: null,
    };
  }
}
