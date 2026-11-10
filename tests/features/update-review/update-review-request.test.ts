import { describe, expect, it } from 'vitest';
import { parseUpdateReviewRequest } from '../../../src/features/update-review/application/update-review-request.js';

describe('parseUpdateReviewRequest', () => {
  it('aceita só o veredito, só o comentário ou os dois', () => {
    expect(parseUpdateReviewRequest({ incorrect: false })).toEqual({ ok: true, changes: { incorrect: false } });
    expect(parseUpdateReviewRequest({ comment: ' novo ' })).toEqual({ ok: true, changes: { comment: 'novo' } });
    expect(parseUpdateReviewRequest({ incorrect: true, comment: 'x' })).toEqual({ ok: true, changes: { incorrect: true, comment: 'x' } });
  });

  it('comment null ou em branco apaga o comentário', () => {
    expect(parseUpdateReviewRequest({ comment: null })).toEqual({ ok: true, changes: { comment: null } });
    expect(parseUpdateReviewRequest({ comment: '  ' })).toEqual({ ok: true, changes: { comment: null } });
  });

  it('exige ao menos um campo', () => {
    expect(parseUpdateReviewRequest({})).toEqual({
      ok: false,
      invalidFields: [{ field: 'body', reason: 'informe incorrect, comment ou os dois' }],
    });
  });

  it('rejeita tipos errados e comentário gigante', () => {
    const result = parseUpdateReviewRequest({ incorrect: 'sim', comment: 'x'.repeat(2001) });

    expect(!result.ok && result.invalidFields.map((field) => field.field)).toEqual(['incorrect', 'comment']);
  });
});
