import { createDecisionRecord, type DecisionRecord } from '../domain/decision-record.js';
import type { DecisionRepository } from './ports/decision-repository.js';
import type { FraudAlertTrigger } from './ports/fraud-alert-trigger.js';
import { parseTransactionScored, type InvalidField } from './transaction-scored-event.js';

export type RecordDecisionOutcome =
  | {
      readonly kind: 'recorded';
      readonly record: DecisionRecord;
      readonly alertTriggered: boolean;
      readonly alertFailure: unknown;
    }
  | { readonly kind: 'duplicate'; readonly transactionId: string }
  | { readonly kind: 'invalid'; readonly transactionId: string | null; readonly invalidFields: InvalidField[] };

export interface RecordDecisionUseCase {
  execute(event: unknown): Promise<RecordDecisionOutcome>;
}

export interface RecordDecisionDependencies {
  readonly repository: DecisionRepository;
  readonly fraudAlert: FraudAlertTrigger;
}

/**
 * Registra a decisão recebida no evento TransactionScored (RF03, RF13).
 *
 * A entrega do broker é "pelo menos uma vez": um evento repetido devolve
 * `duplicate` e não dispara alerta de novo. Erro do repositório é propagado
 * para que a mensagem volte para a fila; falha no alerta nunca é propagada.
 */
export class RecordDecision implements RecordDecisionUseCase {
  constructor(private readonly deps: RecordDecisionDependencies) {}

  async execute(event: unknown): Promise<RecordDecisionOutcome> {
    const parsed = parseTransactionScored(event);
    if (!parsed.ok) {
      return { kind: 'invalid', transactionId: parsed.transactionId, invalidFields: parsed.invalidFields };
    }

    const created = createDecisionRecord(parsed.input);
    if (!created.ok) {
      return {
        kind: 'invalid',
        transactionId: parsed.input.transactionId,
        invalidFields: created.violations.map((reason) => ({ field: 'decision', reason })),
      };
    }
    const { record } = created;

    const result = await this.deps.repository.record(record);
    if (result === 'duplicate') {
      return { kind: 'duplicate', transactionId: record.transactionId };
    }

    if (record.notificationStatus !== 'pendente') {
      return { kind: 'recorded', record, alertTriggered: false, alertFailure: null };
    }

    try {
      await this.deps.fraudAlert.decisionDenied({
        transactionId: record.transactionId,
        amount: record.transaction.amount,
        fraudScore: record.fraudScore,
        mcc: record.transaction.merchant.mcc,
        transactionAt: record.transaction.requestedAt,
      });
      return { kind: 'recorded', record, alertTriggered: true, alertFailure: null };
    } catch (error) {
      return { kind: 'recorded', record, alertTriggered: true, alertFailure: error };
    }
  }
}
