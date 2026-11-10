import { beforeEach, describe, expect, it } from 'vitest';
import { RecordDecision } from '../../../../src/features/record-decision/application/record-decision.use-case.js';
import { MemoryDatabase } from '../../../../src/shared/memory-database.js';
import { InMemoryDecisionRepository } from '../../../../src/features/record-decision/infrastructure/in-memory-decision-repository.js';
import { aDeniedEvent, anEvent } from '../../../support/builders.js';
import { FailingDecisionRepository, RecordingAlertTrigger } from '../../../support/fakes.js';

describe('RecordDecision', () => {
  let database: MemoryDatabase;
  let repository: InMemoryDecisionRepository;
  let alert: RecordingAlertTrigger;
  let recordDecision: RecordDecision;

  beforeEach(() => {
    database = new MemoryDatabase();
    repository = new InMemoryDecisionRepository(database);
    alert = new RecordingAlertTrigger();
    recordDecision = new RecordDecision({ repository, fraudAlert: alert });
  });

  it('grava decisão aprovada sem acionar alerta', async () => {
    const outcome = await recordDecision.execute(anEvent());

    expect(outcome).toMatchObject({ kind: 'recorded', alertTriggered: false });
    expect(database.findDecisionByTransactionId('tx-0001')?.notificationStatus).toBe('nao_aplicavel');
    expect(database.findDecisionByTransactionId('tx-0001')?.neighbors).toHaveLength(5);
    expect(alert.denied).toHaveLength(0);
  });

  it('grava decisão negada como pendente e aciona o alerta com os dados do e-mail', async () => {
    const outcome = await recordDecision.execute(aDeniedEvent());

    expect(outcome).toMatchObject({ kind: 'recorded', alertTriggered: true, alertFailure: null });
    expect(database.findDecisionByTransactionId('tx-9999')?.notificationStatus).toBe('pendente');
    expect(alert.denied).toEqual([
      {
        transactionId: 'tx-9999',
        amount: 9505.97,
        fraudScore: 0.8,
        mcc: '7802',
        transactionAt: new Date('2026-10-05T12:00:00Z'),
      },
    ]);
  });

  it('trata evento repetido como sucesso sem efeito e não reenvia alerta', async () => {
    await recordDecision.execute(aDeniedEvent());
    const replay = await recordDecision.execute(aDeniedEvent({ eventId: 'outro-evento' }));

    expect(replay).toEqual({ kind: 'duplicate', transactionId: 'tx-9999' });
    expect(database.decisions.size).toBe(1);
    expect(database.findDecisionByTransactionId('tx-9999')?.eventId).toBe('6f1c2a90-7d1e-4f0b-9a55-1b9a3c2d4e5f');
    expect(alert.denied).toHaveLength(1);
  });

  it('devolve evento inválido com o ID da transação, sem gravar', async () => {
    const outcome = await recordDecision.execute({ ...anEvent(), decision: { approved: true } });

    expect(outcome).toMatchObject({ kind: 'invalid', transactionId: 'tx-0001' });
    expect(database.decisions.size).toBe(0);
  });

  it('devolve como inválido o evento que viola as regras do domínio', async () => {
    const outcome = await recordDecision.execute(anEvent({ decision: { fraudScore: 0.4 } }));

    expect(outcome).toMatchObject({
      kind: 'invalid',
      transactionId: 'tx-0001',
      invalidFields: [{ field: 'decision', reason: expect.stringContaining('fraudScore 0.4') }],
    });
    expect(database.decisions.size).toBe(0);
  });

  it('mantém a decisão gravada quando o alerta falha', async () => {
    alert.failWith = new Error('notificador quebrado');

    const outcome = await recordDecision.execute(aDeniedEvent());

    expect(outcome).toMatchObject({ kind: 'recorded', alertTriggered: true });
    expect(outcome.kind === 'recorded' && (outcome.alertFailure as Error).message).toBe('notificador quebrado');
    expect(database.decisions.size).toBe(1);
  });

  it('propaga erro do repositório para a mensagem voltar à fila', async () => {
    const failing = new RecordDecision({ repository: new FailingDecisionRepository(), fraudAlert: alert });

    await expect(failing.execute(aDeniedEvent())).rejects.toThrow('banco indisponível');
    expect(alert.denied).toHaveLength(0);
  });
});
