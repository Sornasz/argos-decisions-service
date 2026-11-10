import type { NewReview, Review } from '../../domain/review.js';

export interface ReviewCreator {
  /**
   * Grava a revisão e atualiza o estado atual `marcada_incorreta` da decisão na
   * mesma transação. Devolve null quando a decisão não existe.
   */
  create(decisionId: string, review: NewReview): Promise<Review | null>;
}
