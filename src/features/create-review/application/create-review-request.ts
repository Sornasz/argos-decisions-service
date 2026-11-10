import type { NewReview } from '../domain/review.js';

export interface InvalidField {
  readonly field: string;
  readonly reason: string;
}

export type ParseCreateReviewResult =
  | { readonly ok: true; readonly review: NewReview }
  | { readonly ok: false; readonly invalidFields: InvalidField[] };

export const MAX_NAME_LENGTH = 200;
export const MAX_EMAIL_LENGTH = 320;
export const MAX_COMMENT_LENGTH = 2000;
const EMAIL_PATTERN = /^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]+$/;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Valida o corpo de POST /decisions/:id/reviews, apontando todos os campos com problema de uma vez. */
export function parseCreateReviewRequest(body: unknown): ParseCreateReviewResult {
  if (!isObject(body)) {
    return { ok: false, invalidFields: [{ field: 'body', reason: 'deve ser um objeto JSON' }] };
  }
  const invalidFields: InvalidField[] = [];
  const reject = (field: string, reason: string) => invalidFields.push({ field, reason });

  let name: string | undefined;
  let email: string | undefined;
  if (!isObject(body.analyst)) {
    reject('analyst', 'campo obrigatório, com name e email');
  } else {
    const rawName = body.analyst.name;
    if (typeof rawName !== 'string' || rawName.trim() === '') reject('analyst.name', 'deve ser um texto não vazio');
    else if (rawName.trim().length > MAX_NAME_LENGTH) reject('analyst.name', `deve ter no máximo ${MAX_NAME_LENGTH} caracteres`);
    else if (CONTROL_CHARACTERS.test(rawName)) reject('analyst.name', 'não pode conter caracteres de controle');
    else name = rawName.trim();

    const rawEmail = body.analyst.email;
    if (typeof rawEmail !== 'string' || !EMAIL_PATTERN.test(rawEmail.trim()) || rawEmail.trim().length > MAX_EMAIL_LENGTH) {
      reject('analyst.email', 'deve ser um endereço de e-mail válido');
    } else email = rawEmail.trim().toLowerCase();
  }

  let incorrect: boolean | undefined;
  if (typeof body.incorrect !== 'boolean') reject('incorrect', 'deve ser true ou false');
  else incorrect = body.incorrect;

  let comment: string | null = null;
  if (body.comment !== undefined && body.comment !== null) {
    if (typeof body.comment !== 'string') reject('comment', 'deve ser um texto');
    else if (body.comment.length > MAX_COMMENT_LENGTH) reject('comment', `deve ter no máximo ${MAX_COMMENT_LENGTH} caracteres`);
    else comment = body.comment.trim() === '' ? null : body.comment.trim();
  }

  if (invalidFields.length > 0) return { ok: false, invalidFields };
  return { ok: true, review: { analyst: { name: name!, email: email! }, incorrect: incorrect!, comment } };
}
