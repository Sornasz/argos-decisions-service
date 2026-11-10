import type { Review, ReviewChanges } from '../../domain/review.js';

export interface ReviewUpdater {
  /**
   * Altera a revisão e recalcula `marcada_incorreta` da decisão na mesma
   * transação. Devolve null quando a revisão não existe.
   */
  update(reviewId: string, changes: ReviewChanges): Promise<Review | null>;
}
