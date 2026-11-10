import { afterEach, describe, expect, it, vi } from 'vitest';
import { createNotifyFraudFeature, type NotifyFraudFeature } from '../../../src/features/notify-fraud/index.js';
import { createRecordDecisionFeature } from '../../../src/features/record-decision/index.js';
import { MemoryDatabase } from '../../../src/shared/memory-database.js';
import { aDeniedEvent, anEvent } from '../../support/builders.js';

function composeInMemory() {
  const database = new MemoryDatabase();
  let notify: NotifyFraudFeature | undefined;
  const record = createRecordDecisionFeature({
    persistence: { kind: 'memory', database },
    fraudAlert: { decisionDenied: (decision) => notify!.handleDeniedDecision(decision) },
  });
  notify = createNotifyFraudFeature({ statusWriter: record.notificationStatusWriter, gmail: null, recipients: [] });
  return { record, notify, database };
}

describe('record-decision + notify-fraud compostos como no main.ts', () => {
  afterEach(() => vi.restoreAllMocks());

  it('grava a decisão negada, registra o alerta no log uma única vez e marca enviada pelo canal log', async () => {
    const logged = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const { record, notify } = composeInMemory();

    const first = await record.recordDecision.execute(aDeniedEvent());
    const replay = await record.recordDecision.execute(aDeniedEvent());

    expect(notify.channel).toBe('log');
    expect(first).toMatchObject({ kind: 'recorded', alertTriggered: true, alertFailure: null });
    expect(replay.kind).toBe('duplicate');
    expect(logged).toHaveBeenCalledTimes(1);
    expect(String(logged.mock.calls[0]![0])).toContain('tx-9999');
  });

  it('não aciona alerta para decisão aprovada', async () => {
    const logged = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { record } = composeInMemory();

    await record.recordDecision.execute(anEvent());

    expect(logged).not.toHaveBeenCalled();
  });
});
