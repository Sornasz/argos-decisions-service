import type { FraudAlertSender } from '../application/ports/fraud-alert-sender.js';
import type { FraudAlertMessage } from '../domain/fraud-alert.js';

/** Usado quando as credenciais do Gmail não estão configuradas: o alerta só vai para o log. */
export class LogFraudAlertSender implements FraudAlertSender {
  readonly channel = 'log' as const;

  constructor(private readonly log: (line: string) => void = console.warn) {}

  async send(message: FraudAlertMessage): Promise<void> {
    this.log(JSON.stringify({ event: 'fraud_alert_logged', subject: message.subject, body: message.body }));
  }
}
