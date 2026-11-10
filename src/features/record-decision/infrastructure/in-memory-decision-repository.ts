import type { MemoryDatabase } from '../../../shared/memory-database.js';
import type { DecisionRepository, RecordDecisionResult } from '../application/ports/decision-repository.js';
import type { DecisionRecord } from '../domain/decision-record.js';
import {
  MAX_NOTIFICATION_ERROR_LENGTH,
  type NotificationStatusUpdate,
  type NotificationStatusWriter,
} from './notification-status-writer.js';

/** Repositório em memória com as mesmas regras de unicidade do schema SQL. Só para desenvolvimento e testes. */
export class InMemoryDecisionRepository implements DecisionRepository, NotificationStatusWriter {
  constructor(private readonly database: MemoryDatabase) {}

  async record(decision: DecisionRecord): Promise<RecordDecisionResult> {
    if (this.database.findDecisionByTransactionId(decision.transactionId)) return 'duplicate';
    const id = this.database.newId();
    this.database.decisions.set(id, {
      id,
      transactionId: decision.transactionId,
      eventId: decision.eventId,
      approved: decision.approved,
      fraudScore: decision.fraudScore,
      approvalThreshold: decision.approvalThreshold,
      referenceIndexVersion: decision.referenceIndexVersion,
      decidedAt: decision.decidedAt,
      createdAt: new Date(),
      featureVector: [...decision.featureVector],
      neighbors: decision.neighbors.map((neighbor, index) => ({
        position: index + 1,
        referenceId: neighbor.referenceId,
        distance: neighbor.distance,
        fraud: neighbor.label === 'fraud',
      })),
      transaction: structuredClone(decision.transaction),
      markedIncorrect: false,
      notificationStatus: decision.notificationStatus,
      notificationChannel: null,
      notificationError: null,
      notificationUpdatedAt: null,
    });
    return 'recorded';
  }

  async updateNotificationStatus(transactionId: string, update: NotificationStatusUpdate): Promise<boolean> {
    const stored = this.database.findDecisionByTransactionId(transactionId);
    if (!stored || stored.notificationStatus !== 'pendente') return false;
    stored.notificationStatus = update.status;
    stored.notificationChannel = update.channel;
    stored.notificationError = update.error?.slice(0, MAX_NOTIFICATION_ERROR_LENGTH) ?? null;
    stored.notificationUpdatedAt = update.updatedAt;
    return true;
  }
}
