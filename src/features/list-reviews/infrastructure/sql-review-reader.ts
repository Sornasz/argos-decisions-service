import sql from 'mssql';
import type { SqlPoolProvider } from '../../../shared/persistence.js';
import { REVIEW_COLUMNS, reviewFromRow, type ReviewRow } from '../../../shared/sql-review-state.js';
import type { ReviewReader } from '../application/ports/review-reader.js';
import type { Review } from '../domain/review.js';

const LIST = `
IF NOT EXISTS (SELECT 1 FROM dbo.decisao WHERE id = @decisao_id)
  SELECT CAST(0 AS BIT) AS existe;
ELSE
BEGIN
  SELECT CAST(1 AS BIT) AS existe;
  SELECT ${REVIEW_COLUMNS}
  FROM dbo.revisao AS r
  JOIN dbo.analista AS a ON a.id = r.analista_id
  WHERE r.decisao_id = @decisao_id
  ORDER BY r.revisado_em DESC, r.id DESC;
END;
`;

export class SqlReviewReader implements ReviewReader {
  constructor(private readonly pool: SqlPoolProvider) {}

  async listByDecision(decisionId: string): Promise<Review[] | null> {
    const result = await (await this.pool()).request().input('decisao_id', sql.UniqueIdentifier, decisionId).query(LIST);
    const [existence, rows] = result.recordsets as unknown as [{ existe: boolean }[], ReviewRow[] | undefined];
    if (!existence[0]?.existe) return null;
    return (rows ?? []).map(reviewFromRow);
  }
}
