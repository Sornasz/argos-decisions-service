import type { SqlPoolProvider } from '../../../shared/persistence.js';
import type { DecisionTotalsReader } from '../application/ports/decision-totals-reader.js';
import type { DecisionTotals } from '../domain/decision-metrics.js';

const TOTALS = `
SELECT COUNT(*) AS total,
       ISNULL(SUM(CASE WHEN status = 'APROVADO' THEN 1 ELSE 0 END), 0) AS approved,
       ISNULL(SUM(CASE WHEN status = 'NEGADO' THEN 1 ELSE 0 END), 0) AS denied,
       ISNULL(SUM(CAST(fraud_score AS FLOAT)), 0) AS score_sum,
       ISNULL(SUM(CAST(marcada_incorreta AS INT)), 0) AS marked_incorrect
FROM dbo.decisao;
`;

export class SqlDecisionTotalsReader implements DecisionTotalsReader {
  constructor(private readonly pool: SqlPoolProvider) {}

  async read(): Promise<DecisionTotals> {
    const result = await (await this.pool()).request().query<{
      total: number;
      approved: number;
      denied: number;
      score_sum: number;
      marked_incorrect: number;
    }>(TOTALS);
    const row = result.recordset[0]!;
    return {
      total: row.total,
      approved: row.approved,
      denied: row.denied,
      scoreSum: Number(row.score_sum),
      markedIncorrect: row.marked_incorrect,
    };
  }
}
