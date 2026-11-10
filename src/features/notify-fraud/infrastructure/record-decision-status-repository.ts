import type { NotificationStatusWriter } from '../../record-decision/index.js';
import type {
  NotificationResult,
  NotificationStatusRepository,
} from '../application/ports/notification-status-repository.js';

/** A tabela de decisões pertence ao record-decision; o status é gravado pela API pública dele. */
export class RecordDecisionStatusRepository implements NotificationStatusRepository {
  constructor(private readonly writer: NotificationStatusWriter) {}

  save(transactionId: string, result: NotificationResult): Promise<boolean> {
    return this.writer.updateNotificationStatus(transactionId, {
      status: result.status,
      channel: result.channel,
      error: result.error,
      updatedAt: result.updatedAt,
    });
  }
}
