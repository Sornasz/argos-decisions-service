import { describe, expect, it } from 'vitest';
import type {
  NotifyFraudOutcome,
  NotifyFraudUseCase,
} from '../../../../src/features/notify-fraud/application/notify-fraud.use-case.js';
import { createDeniedDecisionHandler } from '../../../../src/features/notify-fraud/api/denied-decision.handler.js';

const decision = {
  transactionId: 'tx-9999',
  amount: 10,
  fraudScore: 0.8,
  mcc: '7802',
  transactionAt: new Date('2026-10-05T12:00:00Z'),
};

function run(outcome: Omit<NotifyFraudOutcome, 'transactionId'>) {
  const lines: Array<{ level: 'info' | 'error'; entry: Record<string, unknown> }> = [];
  const useCase: NotifyFraudUseCase = { execute: async () => ({ transactionId: 'tx-9999', ...outcome }) };
  const logger = {
    info: (line: string) => lines.push({ level: 'info', entry: JSON.parse(line) }),
    error: (line: string) => lines.push({ level: 'error', entry: JSON.parse(line) }),
  };
  return createDeniedDecisionHandler(useCase, logger)(decision).then(() => lines);
}

const updatedAt = new Date('2026-10-05T12:00:02Z');

describe('createDeniedDecisionHandler', () => {
  it('registra alerta enviado como info', async () => {
    const lines = await run({
      result: { status: 'enviada', channel: 'gmail', error: null, updatedAt },
      statusSaved: true,
      statusFailure: null,
    });

    expect(lines).toEqual([
      {
        level: 'info',
        entry: { event: 'fraud_alert_sent', transactionId: 'tx-9999', channel: 'gmail', error: null, statusSaved: true },
      },
    ]);
  });

  it('registra falha de envio e falha ao gravar status como erro', async () => {
    const lines = await run({
      result: { status: 'falhou', channel: 'gmail', error: 'HTTP 503', updatedAt },
      statusSaved: false,
      statusFailure: new Error('deadlock'),
    });

    expect(lines.map((line) => [line.level, line.entry.event])).toEqual([
      ['error', 'fraud_alert_failed'],
      ['error', 'notification_status_not_saved'],
    ]);
  });
});
