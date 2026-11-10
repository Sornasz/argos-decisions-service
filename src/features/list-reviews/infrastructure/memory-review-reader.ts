import type { MemoryDatabase } from '../../../shared/memory-database.js';
import type { ReviewReader } from '../application/ports/review-reader.js';
import type { Review } from '../domain/review.js';

export class MemoryReviewReader implements ReviewReader {
  constructor(private readonly database: MemoryDatabase) {}

  async listByDecision(decisionId: string): Promise<Review[] | null> {
    const key = decisionId.toLowerCase();
    if (!this.database.decisions.has(key)) return null;
    return this.database.reviewsOf(key).map((review) => ({
      id: review.id,
      decisionId: review.decisionId,
      analyst: { name: review.analystName, email: review.analystEmail },
      incorrect: review.incorrect,
      comment: review.comment,
      reviewedAt: review.reviewedAt,
      updatedAt: review.updatedAt,
    }));
  }
}
