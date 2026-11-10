import type { ReviewChanges } from '../domain/review.js';

export interface InvalidField {
  readonly field: string;
  readonly reason: string;
}

export type ParseUpdateReviewResult =
  | { readonly ok: true; readonly changes: ReviewChanges }
  | { readonly ok: false; readonly invalidFields: InvalidField[] };

export const MAX_COMMENT_LENGTH = 2000;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Valida o corpo de PUT /reviews/:id: `incorrect` e `comment` são opcionais, mas um dos dois precisa vir. */
export function parseUpdateReviewRequest(body: unknown): ParseUpdateReviewResult {
  if (!isObject(body)) {
    return { ok: false, invalidFields: [{ field: 'body', reason: 'deve ser um objeto JSON' }] };
  }
  const invalidFields: InvalidField[] = [];
  const reject = (field: string, reason: string) => invalidFields.push({ field, reason });
  let incorrect: boolean | undefined;
  let comment: string | null | undefined;

  if (body.incorrect !== undefined) {
    if (typeof body.incorrect !== 'boolean') reject('incorrect', 'deve ser true ou false');
    else incorrect = body.incorrect;
  }
  if (body.comment !== undefined) {
    if (body.comment === null) comment = null;
    else if (typeof body.comment !== 'string') reject('comment', 'deve ser um texto ou null');
    else if (body.comment.length > MAX_COMMENT_LENGTH) reject('comment', `deve ter no máximo ${MAX_COMMENT_LENGTH} caracteres`);
    else comment = body.comment.trim() === '' ? null : body.comment.trim();
  }
  if (incorrect === undefined && comment === undefined && invalidFields.length === 0) {
    reject('body', 'informe incorrect, comment ou os dois');
  }

  if (invalidFields.length > 0) return { ok: false, invalidFields };
  return {
    ok: true,
    changes: { ...(incorrect !== undefined ? { incorrect } : {}), ...(comment !== undefined ? { comment } : {}) },
  };
}
