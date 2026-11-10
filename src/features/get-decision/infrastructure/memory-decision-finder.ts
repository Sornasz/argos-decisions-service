import type { MemoryDatabase } from '../../../shared/memory-database.js';
import type { DecisionFinder } from '../application/ports/decision-finder.js';
import type { DecisionDetail } from '../domain/decision-detail.js';

export class MemoryDecisionFinder implements DecisionFinder {
  constructor(private readonly database: MemoryDatabase) {}

  async findById(id: string): Promise<DecisionDetail | null> {
    const stored = this.database.decisions.get(id.toLowerCase());
    if (!stored) return null;
    return {
      id: stored.id,
      transactionId: stored.transactionId,
      eventId: stored.eventId,
      status: stored.approved ? 'APROVADO' : 'NEGADO',
      fraudScore: stored.fraudScore,
      approvalThreshold: stored.approvalThreshold,
      referenceIndexVersion: stored.referenceIndexVersion,
      decidedAt: stored.decidedAt,
      markedIncorrect: stored.markedIncorrect,
      notification: {
        status: stored.notificationStatus,
        channel: stored.notificationChannel,
        error: stored.notificationError,
        updatedAt: stored.notificationUpdatedAt,
      },
      featureVector: stored.featureVector,
      neighbors: stored.neighbors.map((neighbor) => ({
        position: neighbor.position,
        referenceId: neighbor.referenceId,
        distance: neighbor.distance,
        label: neighbor.fraud ? 'fraud' : 'legit',
      })),
      transaction: stored.transaction,
    };
  }
}
