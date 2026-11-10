import sql from 'mssql';
import type { SqlPoolProvider } from '../../../shared/persistence.js';
import { REFRESH_MARKED_INCORRECT } from '../../../shared/sql-review-state.js';
import type { ReviewRemover } from '../application/ports/review-remover.js';
import type { ReviewRemoval } from '../domain/review-removal.js';

const DELETE_REVIEW = `
SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @removida TABLE (decisao_id UNIQUEIDENTIFIER);
DELETE FROM dbo.revisao
OUTPUT deleted.decisao_id INTO @removida
WHERE id = @id;

IF NOT EXISTS (SELECT 1 FROM @removida)
BEGIN
  ROLLBACK TRANSACTION;
  SELECT CAST(0 AS BIT) AS removida;
  RETURN;
END;

DECLARE @decisao_id UNIQUEIDENTIFIER = (SELECT TOP 1 decisao_id FROM @removida);
${REFRESH_MARKED_INCORRECT}

COMMIT TRANSACTION;
SELECT CAST(1 AS BIT) AS removida;
`;

export class SqlReviewRemover implements ReviewRemover {
  constructor(private readonly pool: SqlPoolProvider) {}

  async remove(reviewId: string): Promise<ReviewRemoval> {
    const result = await (await this.pool()).request()
      .input('id', sql.UniqueIdentifier, reviewId)
      .batch<{ removida: boolean }>(DELETE_REVIEW);
    return result.recordset?.[0]?.removida ? 'removed' : 'not_found';
  }
}
