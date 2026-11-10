import { describe, expect, it } from 'vitest';
import { LogFraudAlertSender } from '../../../../src/features/notify-fraud/infrastructure/log-fraud-alert-sender.js';
import { RecordDecisionStatusRepository } from '../../../../src/features/notify-fraud/infrastructure/record-decision-status-repository.js';
import { MemoryDatabase } from '../../../../src/shared/memory-database.js';
import { InMemoryDecisionRepository } from '../../../../src/features/record-decision/infrastructure/in-memory-decision-repository.js';
import { aDeniedEvent, recordOf } from '../../../support/builders.js';

describe('LogFraudAlertSender', () => {
  it('só escreve o alerta no log, com canal log', async () => {
    const lines: string[] = [];
    const sender = new LogFraudAlertSender((line) => lines.push(line));

    await sender.send({ subject: 'Alerta', body: 'ID da transação: tx-1\n' });

    expect(sender.channel).toBe('log');
    expect(JSON.parse(lines[0]!)).toEqual({ event: 'fraud_alert_logged', subject: 'Alerta', body: 'ID da transação: tx-1\n' });
  });
});

describe('RecordDecisionStatusRepository', () => {
  it('grava o resultado pela API pública do record-decision', async () => {
    const database = new MemoryDatabase();
    const decisions = new InMemoryDecisionRepository(database);
    await decisions.record(recordOf(aDeniedEvent()));
    const repository = new RecordDecisionStatusRepository(decisions);

    const saved = await repository.save('tx-9999', {
      status: 'falhou',
      channel: 'gmail',
      error: 'FraudAlertDeliveryError: HTTP 503',
      updatedAt: new Date('2026-10-05T12:00:02Z'),
    });

    expect(saved).toBe(true);
    expect(database.findDecisionByTransactionId('tx-9999')).toMatchObject({
      notificationStatus: 'falhou',
      notificationChannel: 'gmail',
      notificationError: 'FraudAlertDeliveryError: HTTP 503',
    });
  });
});
