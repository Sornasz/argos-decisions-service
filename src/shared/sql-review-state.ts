import type { ReviewView } from './http.js';

/**
 * Recalcula decisao.marcada_incorreta a partir da revisão mais recente da
 * decisão `@decisao_id`. Entra no mesmo batch, e portanto na mesma transação,
 * de quem criou, alterou ou removeu a revisão.
 */
export const REFRESH_MARKED_INCORRECT = `
UPDATE dbo.decisao
SET marcada_incorreta = ISNULL(
  (SELECT TOP 1 decisao_incorreta FROM dbo.revisao WHERE decisao_id = @decisao_id ORDER BY revisado_em DESC, id DESC),
  0
)
WHERE id = @decisao_id;
`;

export const REVIEW_COLUMNS = `
  r.id, r.decisao_id, a.nome AS analista_nome, a.email AS analista_email,
  r.decisao_incorreta, r.comentario, r.revisado_em, r.atualizado_em
`;

export interface ReviewRow {
  id: string;
  decisao_id: string;
  analista_nome: string;
  analista_email: string;
  decisao_incorreta: boolean;
  comentario: string | null;
  revisado_em: Date;
  atualizado_em: Date | null;
}

export function reviewFromRow(row: ReviewRow): ReviewView {
  return {
    id: row.id.toLowerCase(),
    decisionId: row.decisao_id.toLowerCase(),
    analyst: { name: row.analista_nome, email: row.analista_email },
    incorrect: Boolean(row.decisao_incorreta),
    comment: row.comentario,
    reviewedAt: row.revisado_em,
    updatedAt: row.atualizado_em,
  };
}
