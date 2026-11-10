import { describe, expect, it } from 'vitest';
import { MemoryDatabase } from '../../../../src/shared/memory-database.js';
import { InMemoryDecisionRepository } from '../../../../src/features/record-decision/infrastructure/in-memory-decision-repository.js';
import { aDeniedEvent, anEvent, recordOf } from '../../../support/builders.js';

const sent = { status: 'enviada', channel: 'gmail', error: null, updatedAt: new Date('2026-10-05T12:00:02Z') } as const;

describe('InMemoryDecisionRepository', () => {
  it('recusa o mesmo ID de transação duas vezes', async () => {
    const database = new MemoryDatabase();
    const repository = new InMemoryDecisionRepository(database);

    expect(await repository.record(recordOf(anEvent()))).toBe('recorded');
    expect(await repository.record(recordOf(anEvent()))).toBe('duplicate');
    expect(database.decisions.size).toBe(1);
  });

  it('atualiza a notificação só enquanto ela está pendente', async () => {
    const database = new MemoryDatabase();
    const repository = new InMemoryDecisionRepository(database);
    await repository.record(recordOf(aDeniedEvent()));

    expect(await repository.updateNotificationStatus('tx-9999', sent)).toBe(true);
    expect(await repository.updateNotificationStatus('tx-9999', { ...sent, status: 'falhou' })).toBe(false);
    expect(database.findDecisionByTransactionId('tx-9999')).toMatchObject({ notificationStatus: 'enviada', notificationChannel: 'gmail' });
  });

  it('não altera decisão aprovada nem decisão inexistente', async () => {
    const database = new MemoryDatabase();
    const repository = new InMemoryDecisionRepository(database);
    await repository.record(recordOf(anEvent()));

    expect(await repository.updateNotificationStatus('tx-0001', sent)).toBe(false);
    expect(await repository.updateNotificationStatus('tx-nao-existe', sent)).toBe(false);
    expect(database.findDecisionByTransactionId('tx-0001')?.notificationStatus).toBe('nao_aplicavel');
  });

  it('limita o tamanho da mensagem de erro', async () => {
    const database = new MemoryDatabase();
    const repository = new InMemoryDecisionRepository(database);
    await repository.record(recordOf(aDeniedEvent()));

    await repository.updateNotificationStatus('tx-9999', { ...sent, status: 'falhou', error: 'x'.repeat(900) });

    expect(database.findDecisionByTransactionId('tx-9999')?.notificationError).toHaveLength(500);
  });
});
