import type { DecisionFilter, DecisionStatus } from '../domain/decision-summary.js';

export interface InvalidField {
  readonly field: string;
  readonly reason: string;
}

export type ParseListDecisionsResult =
  | { readonly ok: true; readonly filter: DecisionFilter; readonly page: number }
  | { readonly ok: false; readonly invalidFields: InvalidField[] };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2}))?$/;
const STATUSES: Record<string, DecisionStatus> = { aprovado: 'APROVADO', negado: 'NEGADO' };

function single(value: unknown): string | undefined {
  if (value === undefined || value === '') return undefined;
  return typeof value === 'string' ? value : '\u0000';
}

/** Lê os parâmetros de GET /decisions. Todos são opcionais; o que vier precisa estar correto. */
export function parseListDecisionsQuery(query: Record<string, unknown>): ParseListDecisionsResult {
  const invalidFields: InvalidField[] = [];
  const reject = (field: string, reason: string) => invalidFields.push({ field, reason });

  let status: DecisionStatus | undefined;
  const rawStatus = single(query.status);
  if (rawStatus !== undefined) {
    status = STATUSES[rawStatus.toLowerCase()];
    if (!status) reject('status', 'deve ser APROVADO ou NEGADO');
  }

  const readDate = (name: 'from' | 'to'): Date | undefined => {
    const raw = single(query[name]);
    if (raw === undefined) return undefined;
    const date = ISO_DATE.test(raw) ? new Date(raw) : null;
    if (!date || Number.isNaN(date.getTime())) {
      reject(name, 'deve ser uma data ISO 8601, como 2026-11-09 ou 2026-11-09T12:00:00Z');
      return undefined;
    }
    return date;
  };
  const from = readDate('from');
  const to = readDate('to');

  const readScore = (name: 'minScore' | 'maxScore'): number | undefined => {
    const raw = single(query[name]);
    if (raw === undefined) return undefined;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      reject(name, 'deve ser um número entre 0 e 1');
      return undefined;
    }
    return value;
  };
  const minScore = readScore('minScore');
  const maxScore = readScore('maxScore');

  let page = 1;
  const rawPage = single(query.page);
  if (rawPage !== undefined) {
    const value = Number(rawPage);
    if (!Number.isInteger(value) || value < 1) reject('page', 'deve ser um inteiro maior ou igual a 1');
    else page = value;
  }

  if (from && to && from > to) reject('from', 'não pode ser depois de to');
  if (minScore !== undefined && maxScore !== undefined && minScore > maxScore) reject('minScore', 'não pode ser maior que maxScore');

  if (invalidFields.length > 0) return { ok: false, invalidFields };
  return {
    ok: true,
    page,
    filter: {
      ...(status ? { status } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      ...(minScore !== undefined ? { minScore } : {}),
      ...(maxScore !== undefined ? { maxScore } : {}),
    },
  };
}
