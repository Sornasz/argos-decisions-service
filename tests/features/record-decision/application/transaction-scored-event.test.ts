import { describe, expect, it } from 'vitest';
import {
  parseTransactionScored,
  transactionIdOf,
} from '../../../../src/features/record-decision/application/transaction-scored-event.js';
import { anEvent } from '../../../support/builders.js';

function invalidFieldsOf(event: unknown) {
  const result = parseTransactionScored(event);
  if (result.ok) throw new Error('esperava evento inválido');
  return result;
}

describe('parseTransactionScored', () => {
  it('aceita um evento montado com o tipo de packages/contracts', () => {
    const result = parseTransactionScored(anEvent());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input).toMatchObject({
      eventId: '6f1c2a90-7d1e-4f0b-9a55-1b9a3c2d4e5f',
      transactionId: 'tx-0001',
      decidedAt: new Date('2026-10-05T12:00:01Z'),
      approved: true,
      fraudScore: 0,
      referenceIndexVersion: 'sha256:c4e472531de1',
      transaction: {
        amount: 250,
        requestedAt: new Date('2026-10-05T12:00:00Z'),
        merchant: { id: 'MERC-A', mcc: '5411', avgAmount: 1000 },
        lastTransaction: { timestamp: new Date('2026-10-05T11:00:00Z'), kmFromCurrent: 50 },
      },
    });
    expect(result.input.neighbors).toHaveLength(5);
  });

  it('aceita lastTransaction e referenceIndexVersion nulos', () => {
    const result = parseTransactionScored(
      anEvent({ referenceIndexVersion: null, transaction: { lastTransaction: null } }),
    );

    expect(result.ok && result.input.transaction.lastTransaction).toBeNull();
    expect(result.ok && result.input.referenceIndexVersion).toBeNull();
  });

  it('lista os campos inválidos e preserva o ID da transação para o log', () => {
    const event = anEvent();
    const broken = {
      ...event,
      eventType: 'OutraCoisa',
      decision: { ...event.decision, fraudScore: 3 },
      neighbors: [{ referenceId: -1, distance: 0.1, label: 'talvez' }],
      transaction: { ...event.transaction, merchant: { ...event.transaction.merchant, mcc: 'ABCD' } },
    };

    const result = invalidFieldsOf(broken);

    expect(result.transactionId).toBe('tx-0001');
    expect(result.invalidFields.map((invalid) => invalid.field)).toEqual([
      'eventType',
      'decision.fraudScore',
      'neighbors[0].referenceId',
      'neighbors[0].label',
      'transaction.merchant.mcc',
    ]);
  });

  it('rejeita versão de schema desconhecida', () => {
    const result = invalidFieldsOf({ ...anEvent(), schemaVersion: 2 });

    expect(result.invalidFields).toEqual([{ field: 'schemaVersion', reason: 'deve ser 1' }]);
  });

  it('rejeita vetor com valor fora de [-1, 1]', () => {
    const vector = anEvent().featureVector.map((value, index) => (index === 3 ? 1.5 : value));

    expect(invalidFieldsOf(anEvent({ featureVector: vector })).invalidFields).toEqual([
      { field: 'featureVector[3]', reason: 'deve ser menor ou igual a 1' },
    ]);
  });

  it('rejeita ID de transação com quebra de linha', () => {
    const result = invalidFieldsOf(anEvent({ transactionId: 'tx-1\r\nBcc: alguem@exemplo.com' }));

    expect(result.transactionId).toBeNull();
    expect(result.invalidFields).toEqual([{ field: 'transactionId', reason: 'não pode conter caracteres de controle' }]);
  });

  it('exige lastTransaction presente, mesmo que null', () => {
    const event = anEvent();
    const { lastTransaction: _omitted, ...transaction } = event.transaction;

    expect(invalidFieldsOf({ ...event, transaction }).invalidFields.map((invalid) => invalid.field)).toEqual([
      'transaction.lastTransaction',
    ]);
  });

  it.each([null, 'texto', 42, []])('rejeita corpo que não é objeto: %j', (body) => {
    expect(invalidFieldsOf(body)).toEqual({
      ok: false,
      transactionId: null,
      invalidFields: [{ field: 'body', reason: 'deve ser um objeto JSON' }],
    });
  });
});

describe('transactionIdOf', () => {
  it('extrai o ID quando ele é um texto seguro', () => {
    expect(transactionIdOf({ transactionId: 'tx-1' })).toBe('tx-1');
    expect(transactionIdOf({ transactionId: 42 })).toBeNull();
    expect(transactionIdOf('tx-1')).toBeNull();
  });
});
