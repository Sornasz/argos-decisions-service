import sql from 'mssql';
import type { SqlPoolProvider } from '../../../shared/persistence.js';
import { REFRESH_MARKED_INCORRECT, REVIEW_COLUMNS, reviewFromRow, type ReviewRow } from '../../../shared/sql-review-state.js';
import type { ReviewCreator } from '../application/ports/review-creator.js';
import type { NewReview, Review } from '../domain/review.js';

// Um único batch com XACT_ABORT: o analista, a revisão e o novo estado da
// decisão são confirmados juntos ou desfeitos juntos.
const CREATE_REVIEW = `
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (SELECT 1 FROM dbo.decisao WITH (UPDLOCK, HOLDLOCK) WHERE id = @decisao_id)
BEGIN
  ROLLBACK TRANSACTION;
  RETURN;
END;

DECLARE @analista TABLE (id UNIQUEIDENTIFIER);
MERGE dbo.analista WITH (HOLDLOCK) AS destino
USING (SELECT @analista_email AS email) AS origem ON destino.email = origem.email
WHEN MATCHED THEN UPDATE SET nome = @analista_nome
WHEN NOT MATCHED THEN INSERT (nome, email) VALUES (@analista_nome, @analista_email)
OUTPUT inserted.id INTO @analista;

DECLARE @revisao TABLE (id UNIQUEIDENTIFIER);
INSERT INTO dbo.revisao (decisao_id, analista_id, decisao_incorreta, comentario)
OUTPUT inserted.id INTO @revisao
SELECT @decisao_id, id, @incorreta, @comentario FROM @analista;

${REFRESH_MARKED_INCORRECT}

COMMIT TRANSACTION;

SELECT ${REVIEW_COLUMNS}
FROM dbo.revisao AS r
JOIN dbo.analista AS a ON a.id = r.analista_id
WHERE r.id = (SELECT id FROM @revisao);
`;

export class SqlReviewCreator implements ReviewCreator {
  constructor(private readonly pool: SqlPoolProvider) {}

  async create(decisionId: string, review: NewReview): Promise<Review | null> {
    const result = await (await this.pool()).request()
      .input('decisao_id', sql.UniqueIdentifier, decisionId)
      .input('analista_nome', sql.NVarChar(200), review.analyst.name)
      .input('analista_email', sql.NVarChar(320), review.analyst.email)
      .input('incorreta', sql.Bit, review.incorrect)
      .input('comentario', sql.NVarChar(2000), review.comment)
      .batch<ReviewRow>(CREATE_REVIEW);
    const row = result.recordset?.[0];
    return row ? reviewFromRow(row) : null;
  }
}
