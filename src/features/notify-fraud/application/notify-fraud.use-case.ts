import { composeFraudAlert, type DeniedDecision } from '../domain/fraud-alert.js';
import type { Clock } from './ports/clock.js';
import type { FraudAlertSender } from './ports/fraud-alert-sender.js';
import type { NotificationResult, NotificationStatusRepository } from './ports/notification-status-repository.js';

export interface NotifyFraudOutcome {
  readonly transactionId: string;
  readonly result: NotificationResult;
  readonly statusSaved: boolean;
  readonly statusFailure: unknown;
}

export interface NotifyFraudUseCase {
  execute(decision: DeniedDecision): Promise<NotifyFraudOutcome>;
}

export interface NotifyFraudDependencies {
  readonly sender: FraudAlertSender;
  readonly statusRepository: NotificationStatusRepository;
  readonly clock: Clock;
}

function describe(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

/**
 * Envia o alerta de uma decisão negada já gravada e registra o resultado
 * (RF11, RF21). Nunca rejeita: falha de envio ou de gravação do status vira
 * informação no resultado, para não desfazer a auditoria nem provocar
 * reprocessamento da mensagem (RNF05, RNF06).
 */
export class NotifyFraud implements NotifyFraudUseCase {
  constructor(private readonly deps: NotifyFraudDependencies) {}

  async execute(decision: DeniedDecision): Promise<NotifyFraudOutcome> {
    const { sender, statusRepository, clock } = this.deps;
    let result: NotificationResult;
    try {
      await sender.send(composeFraudAlert(decision));
      result = { status: 'enviada', channel: sender.channel, error: null, updatedAt: clock.now() };
    } catch (error) {
      result = { status: 'falhou', channel: sender.channel, error: describe(error), updatedAt: clock.now() };
    }

    try {
      const statusSaved = await statusRepository.save(decision.transactionId, result);
      return { transactionId: decision.transactionId, result, statusSaved, statusFailure: null };
    } catch (error) {
      return { transactionId: decision.transactionId, result, statusSaved: false, statusFailure: error };
    }
  }
}
