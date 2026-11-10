import type { DecisionRecordInput, ReferenceNeighbor, TransactionSnapshot } from '../domain/decision-record.js';
import { TRANSACTION_SCORED_EVENT_TYPE, TRANSACTION_SCORED_SCHEMA_VERSION } from './transaction-scored.js';

export interface InvalidField {
  readonly field: string;
  readonly reason: string;
}

export type ParseTransactionScoredResult =
  | { readonly ok: true; readonly input: DecisionRecordInput }
  | { readonly ok: false; readonly transactionId: string | null; readonly invalidFields: InvalidField[] };

type JsonObject = Record<string, unknown>;

const MAX_ID_LENGTH = 128;
const MCC_PATTERN = /^\d{4}$/;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function keyOf(path: string): string {
  return path.slice(path.lastIndexOf('.') + 1);
}

class FieldReader {
  readonly invalidFields: InvalidField[] = [];

  reject(field: string, reason: string): undefined {
    this.invalidFields.push({ field, reason });
    return undefined;
  }

  private present(parent: JsonObject | undefined, path: string): unknown {
    if (parent === undefined) return undefined;
    const value = parent[keyOf(path)];
    if (value === undefined || value === null) return this.reject(path, 'campo obrigatório');
    return value;
  }

  object(parent: JsonObject | undefined, path: string): JsonObject | undefined {
    const value = this.present(parent, path);
    if (value === undefined) return undefined;
    return isObject(value) ? value : this.reject(path, 'deve ser um objeto');
  }

  number(
    parent: JsonObject | undefined,
    path: string,
    rules: { min?: number; max?: number; integer?: boolean } = {},
  ): number | undefined {
    const value = this.present(parent, path);
    if (value === undefined) return undefined;
    return this.checkNumber(value, path, rules);
  }

  checkNumber(value: unknown, path: string, rules: { min?: number; max?: number; integer?: boolean }): number | undefined {
    if (typeof value !== 'number' || !Number.isFinite(value)) return this.reject(path, 'deve ser um número');
    if (rules.integer && !Number.isInteger(value)) return this.reject(path, 'deve ser um número inteiro');
    if (rules.min !== undefined && value < rules.min) return this.reject(path, `deve ser maior ou igual a ${rules.min}`);
    if (rules.max !== undefined && value > rules.max) return this.reject(path, `deve ser menor ou igual a ${rules.max}`);
    return value;
  }

  string(
    parent: JsonObject | undefined,
    path: string,
    rules: { maxLength?: number; pattern?: RegExp; patternHint?: string } = {},
  ): string | undefined {
    const value = this.present(parent, path);
    if (value === undefined) return undefined;
    if (typeof value !== 'string' || value.trim() === '') return this.reject(path, 'deve ser um texto não vazio');
    if (CONTROL_CHARACTERS.test(value)) return this.reject(path, 'não pode conter caracteres de controle');
    if (rules.maxLength !== undefined && value.length > rules.maxLength) {
      return this.reject(path, `deve ter no máximo ${rules.maxLength} caracteres`);
    }
    if (rules.pattern && !rules.pattern.test(value)) return this.reject(path, rules.patternHint ?? 'formato inválido');
    return value;
  }

  boolean(parent: JsonObject | undefined, path: string): boolean | undefined {
    const value = this.present(parent, path);
    if (value === undefined) return undefined;
    return typeof value === 'boolean' ? value : this.reject(path, 'deve ser true ou false');
  }

  timestamp(parent: JsonObject | undefined, path: string): Date | undefined {
    const value = this.present(parent, path);
    if (value === undefined) return undefined;
    const hint = 'deve ser um timestamp ISO 8601 com fuso';
    if (typeof value !== 'string' || !ISO_TIMESTAMP.test(value)) return this.reject(path, hint);
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? this.reject(path, hint) : date;
  }

  array(parent: JsonObject | undefined, path: string): unknown[] | undefined {
    const value = this.present(parent, path);
    if (value === undefined) return undefined;
    return Array.isArray(value) ? value : this.reject(path, 'deve ser uma lista');
  }

  literal<T>(parent: JsonObject, path: string, expected: T): T | undefined {
    const value = this.present(parent, path);
    if (value === undefined) return undefined;
    return value === expected ? expected : this.reject(path, `deve ser ${JSON.stringify(expected)}`);
  }
}

function readNeighbors(read: FieldReader, root: JsonObject): ReferenceNeighbor[] | undefined {
  const items = read.array(root, 'neighbors');
  if (items === undefined) return undefined;
  const neighbors: ReferenceNeighbor[] = [];
  items.forEach((item, index) => {
    const path = `neighbors[${index}]`;
    if (!isObject(item)) {
      read.reject(path, 'deve ser um objeto');
      return;
    }
    const referenceId = read.number(item, `${path}.referenceId`, { min: 0, integer: true });
    const distance = read.number(item, `${path}.distance`, { min: 0 });
    const label = item.label;
    if (label !== 'fraud' && label !== 'legit') read.reject(`${path}.label`, 'deve ser "fraud" ou "legit"');
    if (referenceId !== undefined && distance !== undefined && (label === 'fraud' || label === 'legit')) {
      neighbors.push({ referenceId, distance, label });
    }
  });
  return neighbors.length === items.length ? neighbors : undefined;
}

function readFeatureVector(read: FieldReader, root: JsonObject): number[] | undefined {
  const items = read.array(root, 'featureVector');
  if (items === undefined) return undefined;
  const vector = items.map((value, index) => read.checkNumber(value, `featureVector[${index}]`, { min: -1, max: 1 }));
  return vector.every((value) => value !== undefined) ? (vector as number[]) : undefined;
}

function readStringList(read: FieldReader, parent: JsonObject | undefined, path: string): string[] | undefined {
  const items = read.array(parent, path);
  if (items === undefined) return undefined;
  return items.every((item) => typeof item === 'string') ? (items as string[]) : read.reject(path, 'deve ser uma lista de textos');
}

function readTransaction(read: FieldReader, root: JsonObject): TransactionSnapshot | undefined {
  const transaction = read.object(root, 'transaction');
  const amount = read.number(transaction, 'transaction.amount', { min: 0 });
  const installments = read.number(transaction, 'transaction.installments', { min: 1, integer: true });
  const requestedAt = read.timestamp(transaction, 'transaction.requestedAt');

  const customer = transaction && read.object(transaction, 'transaction.customer');
  const avgAmount = read.number(customer, 'transaction.customer.avgAmount', { min: 0 });
  const txCount24h = read.number(customer, 'transaction.customer.txCount24h', { min: 0, integer: true });
  const knownMerchants = readStringList(read, customer, 'transaction.customer.knownMerchants');

  const merchant = transaction && read.object(transaction, 'transaction.merchant');
  const merchantId = read.string(merchant, 'transaction.merchant.id', { maxLength: MAX_ID_LENGTH });
  const mcc = read.string(merchant, 'transaction.merchant.mcc', { pattern: MCC_PATTERN, patternHint: 'deve ter 4 dígitos numéricos' });
  const merchantAvgAmount = read.number(merchant, 'transaction.merchant.avgAmount', { min: 0 });

  const terminal = transaction && read.object(transaction, 'transaction.terminal');
  const isOnline = read.boolean(terminal, 'transaction.terminal.isOnline');
  const cardPresent = read.boolean(terminal, 'transaction.terminal.cardPresent');
  const kmFromHome = read.number(terminal, 'transaction.terminal.kmFromHome', { min: 0 });

  let lastTransaction: TransactionSnapshot['lastTransaction'] | undefined;
  if (transaction) {
    if (!('lastTransaction' in transaction)) {
      read.reject('transaction.lastTransaction', 'campo obrigatório (null quando não houver)');
    } else if (transaction.lastTransaction === null) {
      lastTransaction = null;
    } else {
      const last = read.object(transaction, 'transaction.lastTransaction');
      const timestamp = read.timestamp(last, 'transaction.lastTransaction.timestamp');
      const kmFromCurrent = read.number(last, 'transaction.lastTransaction.kmFromCurrent', { min: 0 });
      if (timestamp !== undefined && kmFromCurrent !== undefined) lastTransaction = { timestamp, kmFromCurrent };
    }
  }

  if (read.invalidFields.length > 0 || transaction === undefined) return undefined;
  return {
    amount: amount!,
    installments: installments!,
    requestedAt: requestedAt!,
    customer: { avgAmount: avgAmount!, txCount24h: txCount24h!, knownMerchants: knownMerchants! },
    merchant: { id: merchantId!, mcc: mcc!, avgAmount: merchantAvgAmount! },
    terminal: { isOnline: isOnline!, cardPresent: cardPresent!, kmFromHome: kmFromHome! },
    lastTransaction: lastTransaction!,
  };
}

/** Lê o ID da transação mesmo de um evento inválido, para que o erro seja rastreável. */
export function transactionIdOf(event: unknown): string | null {
  if (!isObject(event)) return null;
  const id = event.transactionId;
  return typeof id === 'string' && id.length <= MAX_ID_LENGTH && !CONTROL_CHARACTERS.test(id) ? id : null;
}

/**
 * Valida o evento TransactionScored (schemaVersion 1) recebido do broker. A
 * mensagem é tratada como entrada não confiável: o formato é conferido campo a
 * campo, independentemente do tipo declarado em transaction-scored.ts.
 */
export function parseTransactionScored(event: unknown): ParseTransactionScoredResult {
  if (!isObject(event)) {
    return { ok: false, transactionId: null, invalidFields: [{ field: 'body', reason: 'deve ser um objeto JSON' }] };
  }

  const read = new FieldReader();
  const eventId = read.string(event, 'eventId', { maxLength: 64 });
  read.literal(event, 'eventType', TRANSACTION_SCORED_EVENT_TYPE);
  read.literal(event, 'schemaVersion', TRANSACTION_SCORED_SCHEMA_VERSION);
  const decidedAt = read.timestamp(event, 'occurredAt');
  const transactionId = read.string(event, 'transactionId', { maxLength: MAX_ID_LENGTH });

  const decision = read.object(event, 'decision');
  const approved = read.boolean(decision, 'decision.approved');
  const fraudScore = read.number(decision, 'decision.fraudScore', { min: 0, max: 1 });
  const approvalThreshold = read.number(decision, 'decision.approvalThreshold');

  const featureVector = readFeatureVector(read, event);
  const neighbors = readNeighbors(read, event);

  let referenceIndexVersion: string | null | undefined = null;
  if (event.referenceIndexVersion !== null && event.referenceIndexVersion !== undefined) {
    referenceIndexVersion = read.string(event, 'referenceIndexVersion', { maxLength: 64 });
  }

  const transaction = readTransaction(read, event);

  if (read.invalidFields.length > 0) {
    return { ok: false, transactionId: transactionIdOf(event), invalidFields: read.invalidFields };
  }

  return {
    ok: true,
    input: {
      eventId: eventId!,
      transactionId: transactionId!,
      decidedAt: decidedAt!,
      approved: approved!,
      fraudScore: fraudScore!,
      approvalThreshold: approvalThreshold!,
      featureVector: featureVector!,
      neighbors: neighbors!,
      referenceIndexVersion: referenceIndexVersion ?? null,
      transaction: transaction!,
    },
  };
}
