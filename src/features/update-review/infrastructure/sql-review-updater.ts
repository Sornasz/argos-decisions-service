import sql from 'mssql';
import type { SqlPoolProvider } from '../../../shared/persistence.js';
import { REFRESH_MARKED_INCORRECT, REVIEW_COLUMNS, reviewFromRow, type ReviewRow } from '../../../shared/sql-review-state.js';
import type { ReviewUpdater } from '../application/ports/review-updater.js';
import type { Review, ReviewChanges } from '../domain/review.js';

const UPDATE_REVIEW = `
SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @alterada TABLE (decisao_id UNIQUEIDENTIFIER);
UPDATE dbo.revisao
SET decisao_incorreta = CASE WHEN @alterar_incorreta = 1 THEN @incorreta ELSE decisao_incorreta END,
    comentario = CASE WHEN @alterar_comentario = 1 THEN @comentario ELSE comentario END,
    atualizado_em = SYSUTCDATETIME()
OUTPUT inserted.decisao_id INTO @alterada
WHERE id = @id;

IF NOT EXISTS (SELECT 1 FROM @alterada)
BEGIN
  ROLLBACK TRANSACTION;
  RETURN;
END;

DECLARE @decisao_id UNIQUEIDENTIFIER = (SELECT TOP 1 decisao_id FROM @alterada);
${REFRESH_MARKED_INCORRECT}

COMMIT TRANSACTION;

SELECT ${REVIEW_COLUMNS}
FROM dbo.revisao AS r
JOIN dbo.analista AS a ON a.id = r.analista_id
WHERE r.id = @id;
`;

export class SqlReviewUpdater implements ReviewUpdater {
  constructor(private readonly pool: SqlPoolProvider) {}

  async update(reviewId: string, changes: ReviewChanges): Promise<Review | null> {
    const result = await (await this.pool()).request()
      .input('id', sql.UniqueIdentifier, reviewId)
      .input('alterar_incorreta', sql.Bit, changes.incorrect !== undefined)
      .input('incorreta', sql.Bit, changes.incorrect ?? null)
      .input('alterar_comentario', sql.Bit, changes.comment !== undefined)
      .input('comentario', sql.NVarChar(2000), changes.comment ?? null)
      .batch<ReviewRow>(UPDATE_REVIEW);
    const row = result.recordset?.[0];
    return row ? reviewFromRow(row) : null;
  }
}
