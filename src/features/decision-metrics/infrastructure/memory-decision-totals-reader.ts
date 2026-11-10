import type { MemoryDatabase } from '../../../shared/memory-database.js';
import type { DecisionTotalsReader } from '../application/ports/decision-totals-reader.js';
import type { DecisionTotals } from '../domain/decision-metrics.js';

export class MemoryDecisionTotalsReader implements DecisionTotalsReader {
  constructor(private readonly database: MemoryDatabase) {}

  async read(): Promise<DecisionTotals> {
    const decisions = [...this.database.decisions.values()];
    const approved = decisions.filter((decision) => decision.approved).length;
    return {
      total: decisions.length,
      approved,
      denied: decisions.length - approved,
      scoreSum: decisions.reduce((sum, decision) => sum + decision.fraudScore, 0),
      markedIncorrect: decisions.filter((decision) => decision.markedIncorrect).length,
    };
  }
}
