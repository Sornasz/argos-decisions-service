import type { DecisionDetail } from '../../domain/decision-detail.js';

export interface DecisionFinder {
  findById(id: string): Promise<DecisionDetail | null>;
}
