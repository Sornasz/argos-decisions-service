import type { AlertChannel, NotificationStatus } from '../../domain/fraud-alert.js';

export interface NotificationResult {
  readonly status: NotificationStatus;
  readonly channel: AlertChannel;
  readonly error: string | null;
  readonly updatedAt: Date;
}

export interface NotificationStatusRepository {
  /** Devolve false quando a decisão não estava mais `pendente`. */
  save(transactionId: string, result: NotificationResult): Promise<boolean>;
}
