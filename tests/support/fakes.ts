import type { DecisionRepository, RecordDecisionResult } from '../../src/features/record-decision/application/ports/decision-repository.js';
import type {
  DeniedDecisionSummary,
  FraudAlertTrigger,
} from '../../src/features/record-decision/application/ports/fraud-alert-trigger.js';
import type { DecisionRecord } from '../../src/features/record-decision/domain/decision-record.js';
import type { Clock } from '../../src/features/notify-fraud/application/ports/clock.js';
import type { FraudAlertSender } from '../../src/features/notify-fraud/application/ports/fraud-alert-sender.js';
import type {
  NotificationResult,
  NotificationStatusRepository,
} from '../../src/features/notify-fraud/application/ports/notification-status-repository.js';
import type { FraudAlertMessage } from '../../src/features/notify-fraud/domain/fraud-alert.js';

export class RecordingAlertTrigger implements FraudAlertTrigger {
  readonly denied: DeniedDecisionSummary[] = [];
  failWith: Error | null = null;

  async decisionDenied(summary: DeniedDecisionSummary): Promise<void> {
    this.denied.push(summary);
    if (this.failWith) throw this.failWith;
  }
}

export class FailingDecisionRepository implements DecisionRepository {
  constructor(private readonly error = new Error('banco indisponível')) {}

  async record(_decision: DecisionRecord): Promise<RecordDecisionResult> {
    throw this.error;
  }
}

export class RecordingSender implements FraudAlertSender {
  readonly sent: FraudAlertMessage[] = [];
  failWith: Error | null = null;

  constructor(readonly channel: 'gmail' | 'log' = 'gmail') {}

  async send(message: FraudAlertMessage): Promise<void> {
    if (this.failWith) throw this.failWith;
    this.sent.push(message);
  }
}

export class RecordingStatusRepository implements NotificationStatusRepository {
  readonly saved: Array<{ transactionId: string; result: NotificationResult }> = [];
  failWith: Error | null = null;
  pending = true;

  async save(transactionId: string, result: NotificationResult): Promise<boolean> {
    if (this.failWith) throw this.failWith;
    this.saved.push({ transactionId, result });
    return this.pending;
  }
}

export class FixedClock implements Clock {
  constructor(private readonly instant = new Date('2026-10-05T12:00:02Z')) {}

  now(): Date {
    return this.instant;
  }
}
