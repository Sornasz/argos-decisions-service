import type { ReviewRemoval } from '../../domain/review-removal.js';

export interface ReviewRemover {
  /** Remove a revisão e recalcula `marcada_incorreta` da decisão na mesma transação. */
  remove(reviewId: string): Promise<ReviewRemoval>;
}
