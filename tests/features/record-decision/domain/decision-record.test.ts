import { describe, expect, it } from 'vitest';
import {
  createDecisionRecord,
  type DecisionRecordInput,
  type ReferenceNeighbor,
} from '../../../../src/features/record-decision/domain/decision-record.js';

function neighbors(...labels: Array<'fraud' | 'legit'>): ReferenceNeighbor[] {
  return labels.map((label, index) => ({ referenceId: index, distance: index / 10, label }));
}

function input(overrides: Partial<DecisionRecordInput> = {}): DecisionRecordInput {
  return {
    eventId: 'evt-1',
    transactionId: 'tx-1',
    decidedAt: new Date('2026-10-05T12:00:00Z'),
    approved: true,
    fraudScore: 0.2,
    approvalThreshold: 0.6,
    featureVector: new Array(14).fill(0.1),
    neighbors: neighbors('fraud', 'legit', 'legit', 'legit', 'legit'),
    referenceIndexVersion: 'v1',
    transaction: {
      amount: 10,
      installments: 1,
      requestedAt: new Date('2026-10-05T11:59:59Z'),
      customer: { avgAmount: 10, txCount24h: 1, knownMerchants: [] },
      merchant: { id: 'M', mcc: '5411', avgAmount: 10 },
      terminal: { isOnline: false, cardPresent: true, kmFromHome: 1 },
      lastTransaction: null,
    },
    ...overrides,
  };
}

describe('createDecisionRecord', () => {
  it('marca decisão aprovada como nao_aplicavel para notificação', () => {
    const result = createDecisionRecord(input());

    expect(result.ok && result.record.notificationStatus).toBe('nao_aplicavel');
  });

  it('marca decisão negada como pendente para notificação', () => {
    const result = createDecisionRecord(
      input({ approved: false, fraudScore: 0.6, neighbors: neighbors('fraud', 'fraud', 'fraud', 'legit', 'legit') }),
    );

    expect(result.ok && result.record.notificationStatus).toBe('pendente');
  });

  it('rejeita score que não corresponde aos vizinhos', () => {
    const result = createDecisionRecord(input({ fraudScore: 0.4 }));

    expect(result).toEqual({ ok: false, violations: [expect.stringContaining('não corresponde a 1 fraudes')] });
  });

  it('rejeita aprovação incoerente com o threshold', () => {
    const result = createDecisionRecord(input({ approved: false }));

    expect(result.ok).toBe(false);
    expect(!result.ok && result.violations).toEqual(['decision.approved não corresponde a fraudScore < approvalThreshold']);
  });

  it('exige 5 vizinhos distintos e vetor de 14 dimensões', () => {
    const result = createDecisionRecord(input({ neighbors: neighbors('legit', 'legit'), featureVector: [0.1] }));

    expect(!result.ok && result.violations).toHaveLength(2);
  });

  it('rejeita vizinhos repetidos', () => {
    const repeated = neighbors('fraud', 'legit', 'legit', 'legit', 'legit').map((neighbor) => ({ ...neighbor, referenceId: 7 }));

    const result = createDecisionRecord(input({ neighbors: repeated }));

    expect(!result.ok && result.violations).toEqual(['neighbors contém referenceId repetido']);
  });

  it('rejeita threshold fora de (0, 1]', () => {
    const result = createDecisionRecord(input({ approvalThreshold: 0 }));

    expect(!result.ok && result.violations).toEqual(['decision.approvalThreshold deve estar no intervalo (0, 1]']);
  });
});
