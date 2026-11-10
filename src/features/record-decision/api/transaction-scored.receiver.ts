import { ServiceBusClient, type ServiceBusReceivedMessage } from '@azure/service-bus';
import type { RecordDecisionOutcome, RecordDecisionUseCase } from '../application/record-decision.use-case.js';

export interface MessageSettlement {
  complete(message: ServiceBusReceivedMessage): Promise<void>;
  abandon(message: ServiceBusReceivedMessage): Promise<void>;
  deadLetter(message: ServiceBusReceivedMessage, reason: { reason: string; description: string }): Promise<void>;
}

export interface ReceiverLogger {
  info(line: string): void;
  error(line: string): void;
}

export const DEAD_LETTER_REASON = 'InvalidTransactionScored';
const MAX_DEAD_LETTER_DESCRIPTION = 1000;

/** O SDK entrega o corpo já desserializado quando é JSON; texto e bytes são aceitos por segurança. */
export function decodeMessageBody(body: unknown): unknown {
  const text =
    typeof body === 'string' ? body : body instanceof Uint8Array ? Buffer.from(body).toString('utf8') : null;
  if (text === null) return body;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function describeInvalid(outcome: Extract<RecordDecisionOutcome, { kind: 'invalid' }>): string {
  const fields = outcome.invalidFields.map((invalid) => `${invalid.field}: ${invalid.reason}`).join('; ');
  return `transação ${outcome.transactionId ?? 'desconhecida'}: ${fields}`.slice(0, MAX_DEAD_LETTER_DESCRIPTION);
}

/**
 * Decide o destino de cada mensagem do tópico:
 * - gravada ou duplicada: concluída (complete);
 * - evento inválido: dead letter explícita, sem novas tentativas;
 * - falha ao gravar (banco fora do ar, por exemplo): devolvida à fila (abandon),
 *   e o Service Bus a reentrega até o maxDeliveryCount da subscription.
 * Falha no alerta de fraude não muda o destino: a decisão já está gravada.
 */
export function createTransactionScoredHandler(
  recordDecision: RecordDecisionUseCase,
  settlement: MessageSettlement,
  logger: ReceiverLogger = console,
) {
  return async (message: ServiceBusReceivedMessage): Promise<void> => {
    let outcome: RecordDecisionOutcome;
    try {
      outcome = await recordDecision.execute(decodeMessageBody(message.body));
    } catch (error) {
      logger.error(
        JSON.stringify({ event: 'decision_record_failed', messageId: message.messageId ?? null, reason: errorMessage(error) }),
      );
      await settlement.abandon(message);
      return;
    }

    switch (outcome.kind) {
      case 'recorded':
        logger.info(
          JSON.stringify({
            event: 'decision_recorded',
            transactionId: outcome.record.transactionId,
            approved: outcome.record.approved,
            fraudScore: outcome.record.fraudScore,
            alertTriggered: outcome.alertTriggered,
          }),
        );
        if (outcome.alertFailure) {
          logger.error(
            JSON.stringify({
              event: 'fraud_alert_trigger_failed',
              transactionId: outcome.record.transactionId,
              reason: errorMessage(outcome.alertFailure),
            }),
          );
        }
        await settlement.complete(message);
        return;
      case 'duplicate':
        logger.info(JSON.stringify({ event: 'decision_duplicate_ignored', transactionId: outcome.transactionId }));
        await settlement.complete(message);
        return;
      case 'invalid':
        logger.error(
          JSON.stringify({
            event: 'transaction_scored_rejected',
            transactionId: outcome.transactionId,
            invalidFields: outcome.invalidFields,
          }),
        );
        await settlement.deadLetter(message, { reason: DEAD_LETTER_REASON, description: describeInvalid(outcome) });
    }
  };
}

export interface ServiceBusSubscription {
  readonly connectionString: string;
  readonly topicName: string;
  readonly subscriptionName: string;
}

export interface RunningReceiver {
  close(): Promise<void>;
}

/** Assina a subscription em modo peekLock; a conclusão de cada mensagem é explícita, nunca automática. */
export function startTransactionScoredReceiver(
  recordDecision: RecordDecisionUseCase,
  subscription: ServiceBusSubscription,
  logger: ReceiverLogger = console,
): RunningReceiver {
  const client = new ServiceBusClient(subscription.connectionString);
  const receiver = client.createReceiver(subscription.topicName, subscription.subscriptionName, {
    receiveMode: 'peekLock',
  });

  const handler = createTransactionScoredHandler(
    recordDecision,
    {
      complete: (message) => receiver.completeMessage(message),
      abandon: (message) => receiver.abandonMessage(message),
      deadLetter: (message, { reason, description }) =>
        receiver.deadLetterMessage(message, { deadLetterReason: reason, deadLetterErrorDescription: description }),
    },
    logger,
  );

  receiver.subscribe(
    {
      processMessage: async (message) => {
        try {
          await handler(message);
        } catch (error) {
          logger.error(
            JSON.stringify({ event: 'message_settlement_failed', messageId: message.messageId ?? null, reason: errorMessage(error) }),
          );
        }
      },
      processError: async (args) => {
        logger.error(JSON.stringify({ event: 'service_bus_error', source: args.errorSource, reason: errorMessage(args.error) }));
      },
    },
    { autoCompleteMessages: false, maxConcurrentCalls: 4 },
  );

  return {
    close: async () => {
      await receiver.close();
      await client.close();
    },
  };
}
