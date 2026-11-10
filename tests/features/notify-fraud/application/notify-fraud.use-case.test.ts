import { beforeEach, describe, expect, it } from 'vitest';
import { NotifyFraud } from '../../../../src/features/notify-fraud/application/notify-fraud.use-case.js';
import { FixedClock, RecordingSender, RecordingStatusRepository } from '../../../support/fakes.js';

const decision = {
  transactionId: 'tx-9999',
  amount: 9505.97,
  fraudScore: 0.8,
  mcc: '7802',
  transactionAt: new Date('2026-10-05T12:00:00Z'),
};

describe('NotifyFraud', () => {
  let sender: RecordingSender;
  let statuses: RecordingStatusRepository;
  let notifyFraud: NotifyFraud;

  beforeEach(() => {
    sender = new RecordingSender('gmail');
    statuses = new RecordingStatusRepository();
    notifyFraud = new NotifyFraud({ sender, statusRepository: statuses, clock: new FixedClock() });
  });

  it('envia o alerta e grava enviada com o canal usado', async () => {
    const outcome = await notifyFraud.execute(decision);

    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0]!.subject).toContain('tx-9999');
    expect(statuses.saved).toEqual([
      {
        transactionId: 'tx-9999',
        result: { status: 'enviada', channel: 'gmail', error: null, updatedAt: new Date('2026-10-05T12:00:02Z') },
      },
    ]);
    expect(outcome).toMatchObject({ statusSaved: true, statusFailure: null });
  });

  it('grava falhou com o motivo quando o envio falha, sem rejeitar', async () => {
    sender.failWith = new Error('HTTP 503');

    const outcome = await notifyFraud.execute(decision);

    expect(outcome.result).toMatchObject({ status: 'falhou', error: 'Error: HTTP 503' });
    expect(statuses.saved[0]!.result.status).toBe('falhou');
  });

  it('não rejeita quando a gravação do status falha', async () => {
    statuses.failWith = new Error('deadlock');

    const outcome = await notifyFraud.execute(decision);

    expect(outcome).toMatchObject({ statusSaved: false, result: { status: 'enviada' } });
    expect((outcome.statusFailure as Error).message).toBe('deadlock');
  });

  it('informa quando a decisão já não estava pendente', async () => {
    statuses.pending = false;

    expect((await notifyFraud.execute(decision)).statusSaved).toBe(false);
  });
});
