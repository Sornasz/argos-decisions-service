import type { NotifyFraudUseCase } from '../application/notify-fraud.use-case.js';
import type { DeniedDecision } from '../domain/fraud-alert.js';

export interface AlertLogger {
  info(line: string): void;
  error(line: string): void;
}

/**
 * Ponto de entrada da feature: recebe, dentro do mesmo processo, a decisão
 * negada que o record-decision acabou de gravar. Não há receptor próprio; o
 * alerta acontece no mesmo processamento da mensagem que gravou a decisão.
 */
export function createDeniedDecisionHandler(notifyFraud: NotifyFraudUseCase, logger: AlertLogger = console) {
  return async (decision: DeniedDecision): Promise<void> => {
    const outcome = await notifyFraud.execute(decision);
    const entry = {
      event: outcome.result.status === 'enviada' ? 'fraud_alert_sent' : 'fraud_alert_failed',
      transactionId: outcome.transactionId,
      channel: outcome.result.channel,
      error: outcome.result.error,
      statusSaved: outcome.statusSaved,
    };
    if (outcome.result.status === 'enviada' && outcome.statusSaved) logger.info(JSON.stringify(entry));
    else logger.error(JSON.stringify(entry));

    if (outcome.statusFailure) {
      logger.error(
        JSON.stringify({
          event: 'notification_status_not_saved',
          transactionId: outcome.transactionId,
          reason: outcome.statusFailure instanceof Error ? outcome.statusFailure.message : String(outcome.statusFailure),
        }),
      );
    }
  };
}
