import type { MemoryDatabase, MemoryDecision } from '../../../shared/memory-database.js';
import type { DecisionSearch, DecisionSearchResult } from '../application/ports/decision-search.js';
import type { DecisionFilter, DecisionSummary, NotificationState } from '../domain/decision-summary.js';

function matches(decision: MemoryDecision, filter: DecisionFilter): boolean {
  if (filter.status && (decision.approved ? 'APROVADO' : 'NEGADO') !== filter.status) return false;
  if (filter.from && decision.decidedAt < filter.from) return false;
  if (filter.to && decision.decidedAt > filter.to) return false;
  if (filter.minScore !== undefined && decision.fraudScore < filter.minScore) return false;
  if (filter.maxScore !== undefined && decision.fraudScore > filter.maxScore) return false;
  return true;
}

function toSummary(decision: MemoryDecision): DecisionSummary {
  return {
    id: decision.id,
    transactionId: decision.transactionId,
    status: decision.approved ? 'APROVADO' : 'NEGADO',
    fraudScore: decision.fraudScore,
    approvalThreshold: decision.approvalThreshold,
    decidedAt: decision.decidedAt,
    amount: decision.transaction.amount,
    mcc: decision.transaction.merchant.mcc,
    markedIncorrect: decision.markedIncorrect,
    notificationStatus: decision.notificationStatus as NotificationState,
  };
}

export class MemoryDecisionSearch implements DecisionSearch {
  constructor(private readonly database: MemoryDatabase) {}

  async search(filter: DecisionFilter, offset: number, limit: number): Promise<DecisionSearchResult> {
    const found = [...this.database.decisions.values()]
      .filter((decision) => matches(decision, filter))
      .sort((a, b) => b.decidedAt.getTime() - a.decidedAt.getTime() || a.id.localeCompare(b.id));
    return { items: found.slice(offset, offset + limit).map(toSummary), total: found.length };
  }
}
