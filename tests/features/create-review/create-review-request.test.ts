import { describe, expect, it } from 'vitest';
import { parseCreateReviewRequest } from '../../../src/features/create-review/application/create-review-request.js';

const valid = { analyst: { name: 'Arthur Sornas', email: 'Arthur@Example.com' }, incorrect: true, comment: 'ok' };

describe('parseCreateReviewRequest', () => {
  it('normaliza nome, e-mail e comentário', () => {
    const result = parseCreateReviewRequest({ ...valid, analyst: { name: '  Arthur Sornas ', email: ' Arthur@Example.com ' }, comment: ' ok ' });

    expect(result).toEqual({
      ok: true,
      review: { analyst: { name: 'Arthur Sornas', email: 'arthur@example.com' }, incorrect: true, comment: 'ok' },
    });
  });

  it('comentário ausente, null ou em branco vira null', () => {
    for (const comment of [undefined, null, '   ']) {
      const result = parseCreateReviewRequest({ ...valid, comment });
      expect(result.ok && result.review.comment).toBeNull();
    }
  });

  it('rejeita corpo que não é objeto', () => {
    expect(parseCreateReviewRequest(undefined)).toEqual({ ok: false, invalidFields: [{ field: 'body', reason: 'deve ser um objeto JSON' }] });
    expect(parseCreateReviewRequest([])).toMatchObject({ ok: false });
  });

  it('rejeita analista ausente, nome gigante e comentário gigante', () => {
    const missing = parseCreateReviewRequest({ incorrect: true });
    const long = parseCreateReviewRequest({
      analyst: { name: 'x'.repeat(201), email: 'a@example.com' },
      incorrect: true,
      comment: 'y'.repeat(2001),
    });

    expect(!missing.ok && missing.invalidFields.map((field) => field.field)).toEqual(['analyst']);
    expect(!long.ok && long.invalidFields.map((field) => field.field)).toEqual(['analyst.name', 'comment']);
  });

  it('rejeita caractere de controle no nome', () => {
    const result = parseCreateReviewRequest({ ...valid, analyst: { name: 'Ar\u0000thur', email: 'a@example.com' } });

    expect(!result.ok && result.invalidFields[0]).toEqual({ field: 'analyst.name', reason: 'não pode conter caracteres de controle' });
  });
});
