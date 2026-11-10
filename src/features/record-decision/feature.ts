import type { Persistence } from '../../shared/persistence.js';
import type { FraudAlertTrigger } from './application/ports/fraud-alert-trigger.js';
import { RecordDecision } from './application/record-decision.use-case.js';
import { InMemoryDecisionRepository } from './infrastructure/in-memory-decision-repository.js';
import type { NotificationStatusWriter } from './infrastructure/notification-status-writer.js';
import { SqlDecisionRepository } from './infrastructure/sql/sql-decision-repository.js';
import {
  startTransactionScoredReceiver,
  type RunningReceiver,
  type ServiceBusSubscription,
} from './api/transaction-scored.receiver.js';

export interface RecordDecisionFeatureOptions {
  readonly persistence: Persistence;
  readonly fraudAlert: FraudAlertTrigger;
}

export interface RecordDecisionFeature {
  readonly recordDecision: RecordDecision;
  readonly notificationStatusWriter: NotificationStatusWriter;
  startReceiver(subscription: ServiceBusSubscription): RunningReceiver;
}

export function createRecordDecisionFeature(options: RecordDecisionFeatureOptions): RecordDecisionFeature {
  const repository =
    options.persistence.kind === 'sql'
      ? new SqlDecisionRepository(options.persistence.pool)
      : new InMemoryDecisionRepository(options.persistence.database);

  const recordDecision = new RecordDecision({ repository, fraudAlert: options.fraudAlert });

  return {
    recordDecision,
    notificationStatusWriter: repository,
    startReceiver: (subscription) => startTransactionScoredReceiver(recordDecision, subscription),
  };
}
