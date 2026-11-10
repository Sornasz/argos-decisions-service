import sql from 'mssql';
import type { SqlPoolProvider } from '../../../shared/persistence.js';
import type { DecisionSearch, DecisionSearchResult } from '../application/ports/decision-search.js';
import type { DecisionFilter, DecisionStatus, NotificationState } from '../domain/decision-summary.js';

const WHERE = `
WHERE (@status IS NULL OR d.status = @status)
  AND (@de IS NULL OR d.decidido_em >= @de)
  AND (@ate IS NULL OR d.decidido_em <= @ate)
  AND (@score_min IS NULL OR d.fraud_score >= @score_min)
  AND (@score_max IS NULL OR d.fraud_score <= @score_max)
`;

const SEARCH = `
SELECT d.id, t.transacao_externa_id, d.status, d.fraud_score, d.threshold_aprovacao, d.decidido_em,
       t.valor, t.comerciante_mcc, d.marcada_incorreta, d.notificacao_status
FROM dbo.decisao AS d
JOIN dbo.transacao AS t ON t.id = d.transacao_id
${WHERE}
ORDER BY d.decidido_em DESC, d.id
OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;

SELECT COUNT(*) AS total
FROM dbo.decisao AS d
${WHERE};
`;

interface SummaryRow {
  id: string;
  transacao_externa_id: string;
  status: DecisionStatus;
  fraud_score: number;
  threshold_aprovacao: number;
  decidido_em: Date;
  valor: number;
  comerciante_mcc: string;
  marcada_incorreta: boolean;
  notificacao_status: NotificationState;
}

export class SqlDecisionSearch implements DecisionSearch {
  constructor(private readonly pool: SqlPoolProvider) {}

  async search(filter: DecisionFilter, offset: number, limit: number): Promise<DecisionSearchResult> {
    const result = await (await this.pool()).request()
      .input('status', sql.VarChar(8), filter.status ?? null)
      .input('de', sql.DateTime2(3), filter.from ?? null)
      .input('ate', sql.DateTime2(3), filter.to ?? null)
      .input('score_min', sql.Decimal(3, 2), filter.minScore ?? null)
      .input('score_max', sql.Decimal(3, 2), filter.maxScore ?? null)
      .input('offset', sql.Int, offset)
      .input('limit', sql.Int, limit)
      .query<SummaryRow & { total: number }>(SEARCH);

    const [rows, counts] = result.recordsets as unknown as [SummaryRow[], { total: number }[]];
    return {
      total: counts[0]?.total ?? 0,
      items: rows.map((row) => ({
        id: row.id.toLowerCase(),
        transactionId: row.transacao_externa_id,
        status: row.status,
        fraudScore: Number(row.fraud_score),
        approvalThreshold: Number(row.threshold_aprovacao),
        decidedAt: row.decidido_em,
        amount: Number(row.valor),
        mcc: row.comerciante_mcc,
        markedIncorrect: Boolean(row.marcada_incorreta),
        notificationStatus: row.notificacao_status,
      })),
    };
  }
}
