import type { NotificationStatusWriter } from '../record-decision/index.js';
import { NotifyFraud } from './application/notify-fraud.use-case.js';
import type { FraudAlertSender } from './application/ports/fraud-alert-sender.js';
import type { DeniedDecision } from './domain/fraud-alert.js';
import { GmailApiFraudAlertSender, type GmailCredentials } from './infrastructure/gmail-api-fraud-alert-sender.js';
import { LogFraudAlertSender } from './infrastructure/log-fraud-alert-sender.js';
import { RecordDecisionStatusRepository } from './infrastructure/record-decision-status-repository.js';
import { systemClock } from './infrastructure/system-clock.js';
import { createDeniedDecisionHandler } from './api/denied-decision.handler.js';

export interface NotifyFraudFeatureOptions {
  readonly statusWriter: NotificationStatusWriter;
  readonly gmail: GmailCredentials | null;
  readonly recipients: readonly string[];
}

export interface NotifyFraudFeature {
  readonly notifyFraud: NotifyFraud;
  readonly channel: FraudAlertSender['channel'];
  handleDeniedDecision(decision: DeniedDecision): Promise<void>;
}

export function createNotifyFraudFeature(options: NotifyFraudFeatureOptions): NotifyFraudFeature {
  const sender: FraudAlertSender = options.gmail
    ? new GmailApiFraudAlertSender(options.gmail, options.recipients)
    : new LogFraudAlertSender();

  const notifyFraud = new NotifyFraud({
    sender,
    statusRepository: new RecordDecisionStatusRepository(options.statusWriter),
    clock: systemClock,
  });

  return {
    notifyFraud,
    channel: sender.channel,
    handleDeniedDecision: createDeniedDecisionHandler(notifyFraud),
  };
}
