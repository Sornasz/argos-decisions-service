import type { TransactionScored } from '../../src/features/record-decision/application/transaction-scored.js';
import { parseTransactionScored } from '../../src/features/record-decision/application/transaction-scored-event.js';
import { createDecisionRecord, type DecisionRecord } from '../../src/features/record-decision/domain/decision-record.js';

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> | null : T[K] };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function merge<T>(base: T, overrides: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(overrides)) return (overrides === undefined ? base : overrides) as T;
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(overrides)) result[key] = merge(result[key], value);
  return result as T;
}

const legitNeighbors = [0.011, 0.014, 0.017, 0.023, 0.031].map((distance, index) => ({
  referenceId: 100 + index,
  distance,
  label: 'legit' as const,
}));

/**
 * Evento TransactionScored válido e aprovado. Tipado pelo contrato em
 * transaction-scored.ts: se o contrato mudar, este arquivo deixa de compilar.
 */
export function anEvent(overrides: DeepPartial<TransactionScored> = {}): TransactionScored {
  const base: TransactionScored = {
    eventId: '6f1c2a90-7d1e-4f0b-9a55-1b9a3c2d4e5f',
    eventType: 'TransactionScored',
    schemaVersion: 1,
    occurredAt: '2026-10-05T12:00:01.000Z',
    transactionId: 'tx-0001',
    decision: { approved: true, fraudScore: 0, approvalThreshold: 0.6 },
    featureVector: [0.025, 0.25, 0.05, 0.5217, 0, 0.0417, 0.05, 0.1, 0.2, 0, 1, 0, 0.15, 0.1],
    neighbors: legitNeighbors,
    referenceIndexVersion: 'sha256:c4e472531de1',
    transaction: {
      amount: 250,
      installments: 3,
      requestedAt: '2026-10-05T12:00:00.000Z',
      customer: { avgAmount: 500, txCount24h: 4, knownMerchants: ['MERC-A', 'MERC-B'] },
      merchant: { id: 'MERC-A', mcc: '5411', avgAmount: 1000 },
      terminal: { isOnline: false, cardPresent: true, kmFromHome: 100 },
      lastTransaction: { timestamp: '2026-10-05T11:00:00.000Z', kmFromCurrent: 50 },
    },
  };
  return merge(base, overrides);
}

/** Evento negado: 4 dos 5 vizinhos são fraude. */
export function aDeniedEvent(overrides: DeepPartial<TransactionScored> = {}): TransactionScored {
  const neighbors = [0.05, 0.09, 0.14, 0.16, 0.17].map((distance, index) => ({
    referenceId: 200 + index,
    distance,
    label: index === 4 ? ('legit' as const) : ('fraud' as const),
  }));
  const denied: DeepPartial<TransactionScored> = {
    transactionId: 'tx-9999',
    decision: { approved: false, fraudScore: 0.8, approvalThreshold: 0.6 },
    neighbors,
    transaction: { amount: 9505.97, merchant: { id: 'MERC-068', mcc: '7802', avgAmount: 54.86 } },
  };
  return anEvent(merge(denied, overrides));
}

/** Converte um evento de teste no registro de domínio que os repositórios recebem. */
export function recordOf(event: unknown): DecisionRecord {
  const parsed = parseTransactionScored(event);
  if (!parsed.ok) throw new Error(`evento de teste inválido: ${JSON.stringify(parsed.invalidFields)}`);
  const created = createDecisionRecord(parsed.input);
  if (!created.ok) throw new Error(`decisão de teste inválida: ${created.violations.join('; ')}`);
  return created.record;
}
