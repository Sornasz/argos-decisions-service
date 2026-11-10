import type { AlertChannel, FraudAlertMessage } from '../../domain/fraud-alert.js';

export interface FraudAlertSender {
  readonly channel: AlertChannel;
  /** Rejeita quando o alerta não pôde ser entregue ao canal. */
  send(message: FraudAlertMessage): Promise<void>;
}
