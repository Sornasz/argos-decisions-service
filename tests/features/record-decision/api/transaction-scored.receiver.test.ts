import type { ServiceBusReceivedMessage } from '@azure/service-bus';
import { describe, expect, it } from 'vitest';
import type {
  RecordDecisionOutcome,
  RecordDecisionUseCase,
} from '../../../../src/features/record-decision/application/record-decision.use-case.js';
import {
  DEAD_LETTER_REASON,
  createTransactionScoredHandler,
  decodeMessageBody,
  type MessageSettlement,
} from '../../../../src/features/record-decision/api/transaction-scored.receiver.js';
import { aDeniedEvent, recordOf } from '../../../support/builders.js';

function stub(outcome: RecordDecisionOutcome | Error) {
  const received: unknown[] = [];
  const useCase: RecordDecisionUseCase = {
    execute: async (event) => {
      received.push(event);
      if (outcome instanceof Error) throw outcome;
      return outcome;
    },
  };
  return { useCase, received };
}

function recordingSettlement() {
  const calls: Array<{ action: 'complete' | 'abandon' | 'deadLetter'; reason?: string; description?: string }> = [];
  const settlement: MessageSettlement = {
    complete: async () => void calls.push({ action: 'complete' }),
    abandon: async () => void calls.push({ action: 'abandon' }),
    deadLetter: async (_message, { reason, description }) => void calls.push({ action: 'deadLetter', reason, description }),
  };
  return { settlement, calls };
}

function recordingLogger() {
  const lines: Array<{ level: 'info' | 'error'; line: string }> = [];
  return {
    lines,
    logger: {
      info: (line: string) => void lines.push({ level: 'info', line }),
      error: (line: string) => void lines.push({ level: 'error', line }),
    },
  };
}

const message = (body: unknown) => ({ body, messageId: 'm-1' }) as unknown as ServiceBusReceivedMessage;

const recorded: RecordDecisionOutcome = {
  kind: 'recorded',
  record: recordOf(aDeniedEvent()),
  alertTriggered: true,
  alertFailure: null,
};

describe('receptor do Service Bus (TransactionScored)', () => {
  it('conclui a mensagem quando a decisão é gravada', async () => {
    const { useCase, received } = stub(recorded);
    const { settlement, calls } = recordingSettlement();
    const { logger, lines } = recordingLogger();

    await createTransactionScoredHandler(useCase, settlement, logger)(message({ transactionId: 'tx-9999' }));

    expect(received).toEqual([{ transactionId: 'tx-9999' }]);
    expect(calls).toEqual([{ action: 'complete' }]);
    expect(lines[0]?.line).toContain('"event":"decision_recorded"');
  });

  it('conclui a mensagem duplicada', async () => {
    const { useCase } = stub({ kind: 'duplicate', transactionId: 'tx-9999' });
    const { settlement, calls } = recordingSettlement();
    const { logger, lines } = recordingLogger();

    await createTransactionScoredHandler(useCase, settlement, logger)(message({}));

    expect(calls).toEqual([{ action: 'complete' }]);
    expect(lines[0]?.line).toContain('decision_duplicate_ignored');
  });

  it('manda evento inválido para a dead letter, de forma explícita e com o motivo', async () => {
    const { useCase } = stub({
      kind: 'invalid',
      transactionId: 'tx-ruim',
      invalidFields: [{ field: 'decision.fraudScore', reason: 'campo obrigatório' }],
    });
    const { settlement, calls } = recordingSettlement();
    const { logger, lines } = recordingLogger();

    await createTransactionScoredHandler(useCase, settlement, logger)(message({}));

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ action: 'deadLetter', reason: DEAD_LETTER_REASON });
    expect(calls[0]?.description).toContain('tx-ruim');
    expect(calls[0]?.description).toContain('decision.fraudScore: campo obrigatório');
    expect(lines[0]).toMatchObject({ level: 'error' });
    expect(lines[0]?.line).toContain('"transactionId":"tx-ruim"');
  });

  it('devolve a mensagem para a fila quando o banco falha', async () => {
    const { useCase } = stub(new Error('timeout no SQL'));
    const { settlement, calls } = recordingSettlement();
    const { logger, lines } = recordingLogger();

    await createTransactionScoredHandler(useCase, settlement, logger)(message({}));

    expect(calls).toEqual([{ action: 'abandon' }]);
    expect(lines[0]?.line).toContain('decision_record_failed');
    expect(lines[0]?.line).toContain('timeout no SQL');
  });

  it('registra falha do alerta e ainda conclui a mensagem, porque a decisão já foi gravada', async () => {
    const { useCase } = stub({ ...recorded, alertFailure: new Error('smtp') } as RecordDecisionOutcome);
    const { settlement, calls } = recordingSettlement();
    const { logger, lines } = recordingLogger();

    await createTransactionScoredHandler(useCase, settlement, logger)(message({}));

    expect(calls).toEqual([{ action: 'complete' }]);
    expect(lines.map((entry) => entry.level)).toEqual(['info', 'error']);
  });

  it('limita o tamanho da descrição da dead letter', async () => {
    const { useCase } = stub({
      kind: 'invalid',
      transactionId: null,
      invalidFields: Array.from({ length: 200 }, (_, index) => ({ field: `campo${index}`, reason: 'inválido' })),
    });
    const { settlement, calls } = recordingSettlement();

    await createTransactionScoredHandler(useCase, settlement, recordingLogger().logger)(message({}));

    expect(calls[0]?.description?.length).toBeLessThanOrEqual(1000);
  });
});

describe('decodeMessageBody', () => {
  it('aceita objeto, texto JSON e bytes', () => {
    expect(decodeMessageBody({ a: 1 })).toEqual({ a: 1 });
    expect(decodeMessageBody('{"a":1}')).toEqual({ a: 1 });
    expect(decodeMessageBody(new TextEncoder().encode('{"a":1}'))).toEqual({ a: 1 });
    expect(decodeMessageBody('não é json')).toBe('não é json');
  });
});
