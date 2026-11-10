import type { Review } from '../../domain/review.js';

export interface ReviewReader {
  /** Da revisão mais recente para a mais antiga. Devolve null quando a decisão não existe. */
  listByDecision(decisionId: string): Promise<Review[] | null>;
}
