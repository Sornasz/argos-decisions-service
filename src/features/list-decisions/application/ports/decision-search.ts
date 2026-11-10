import type { DecisionFilter, DecisionSummary } from '../../domain/decision-summary.js';

export interface DecisionSearchResult {
  readonly items: readonly DecisionSummary[];
  readonly total: number;
}

export interface DecisionSearch {
  /** Ordena da decisão mais recente para a mais antiga. */
  search(filter: DecisionFilter, offset: number, limit: number): Promise<DecisionSearchResult>;
}
