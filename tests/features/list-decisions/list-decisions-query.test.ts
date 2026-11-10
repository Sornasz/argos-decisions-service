import { describe, expect, it } from 'vitest';
import { parseListDecisionsQuery } from '../../../src/features/list-decisions/application/list-decisions-query.js';

describe('parseListDecisionsQuery', () => {
  it('aceita a consulta vazia: página 1 e nenhum filtro', () => {
    expect(parseListDecisionsQuery({})).toEqual({ ok: true, page: 1, filter: {} });
  });

  it('converte todos os filtros', () => {
    const result = parseListDecisionsQuery({
      status: 'negado',
      from: '2026-11-01',
      to: '2026-11-09T12:00:00Z',
      minScore: '0.2',
      maxScore: '1',
      page: '3',
    });

    expect(result).toEqual({
      ok: true,
      page: 3,
      filter: {
        status: 'NEGADO',
        from: new Date('2026-11-01'),
        to: new Date('2026-11-09T12:00:00Z'),
        minScore: 0.2,
        maxScore: 1,
      },
    });
  });

  it('trata parâmetro vazio como ausente', () => {
    expect(parseListDecisionsQuery({ status: '', page: '' })).toEqual({ ok: true, page: 1, filter: {} });
  });

  it('rejeita parâmetro repetido (lista)', () => {
    const result = parseListDecisionsQuery({ status: ['NEGADO', 'APROVADO'] });

    expect(result).toMatchObject({ ok: false, invalidFields: [{ field: 'status' }] });
  });

  it('rejeita score fora de 0..1, página fracionária e data impossível', () => {
    const result = parseListDecisionsQuery({ minScore: '-0.1', maxScore: 'x', page: '1.5', from: '2026-13-45' });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.invalidFields.map((field) => field.field)).toEqual(['from', 'minScore', 'maxScore', 'page']);
  });
});
