import type { DecisionTotals } from '../../domain/decision-metrics.js';

export interface DecisionTotalsReader {
  read(): Promise<DecisionTotals>;
}
