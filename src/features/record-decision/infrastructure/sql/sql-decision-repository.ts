import sql from 'mssql';
import type { SqlPoolProvider } from '../../../../shared/persistence.js';
import type { DecisionRepository, RecordDecisionResult } from '../../application/ports/decision-repository.js';
import type { DecisionRecord } from '../../domain/decision-record.js';
import {
  MAX_NOTIFICATION_ERROR_LENGTH,
  type NotificationStatusUpdate,
  type NotificationStatusWriter,
} from '../notification-status-writer.js';

const UNIQUE_CONSTRAINT_VIOLATION = 2627;
const UNIQUE_INDEX_VIOLATION = 2601;

function isUniqueViolation(error: unknown): boolean {
  const candidate = error as { number?: unknown; originalError?: { info?: { number?: unknown } } } | null;
  const number = candidate?.number ?? candidate?.originalError?.info?.number;
  return number === UNIQUE_CONSTRAINT_VIOLATION || number === UNIQUE_INDEX_VIOLATION;
}

const NEIGHBOR_ROWS = [1, 2, 3, 4, 5]
  .map((position) => `(${position}, @v${position}_referencia, @v${position}_distancia, @v${position}_fraude)`)
  .join(',\n      ');

// Um único batch com XACT_ABORT: qualquer erro, inclusive a violação da chave
// única de transacao_externa_id, desfaz transação, decisão e vizinhos juntos.
const INSERT_DECISION = `
SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @transacao TABLE (id UNIQUEIDENTIFIER);
DECLARE @decisao TABLE (id UNIQUEIDENTIFIER);

INSERT INTO dbo.transacao (
  transacao_externa_id, valor, parcelas, solicitada_em,
  cliente_media_valor, cliente_transacoes_24h, cliente_comerciantes_conhecidos,
  comerciante_externo_id, comerciante_mcc, comerciante_media_valor,
  terminal_online, terminal_cartao_presente, terminal_km_de_casa,
  transacao_anterior_em, transacao_anterior_km
)
OUTPUT INSERTED.id INTO @transacao
VALUES (
  @transacao_externa_id, @valor, @parcelas, @solicitada_em,
  @cliente_media_valor, @cliente_transacoes_24h, @cliente_comerciantes_conhecidos,
  @comerciante_externo_id, @comerciante_mcc, @comerciante_media_valor,
  @terminal_online, @terminal_cartao_presente, @terminal_km_de_casa,
  @transacao_anterior_em, @transacao_anterior_km
);

INSERT INTO dbo.decisao (
  transacao_id, evento_id, fraud_score, status, threshold_aprovacao,
  versao_indice, vetor_caracteristicas, decidido_em, notificacao_status
)
OUTPUT INSERTED.id INTO @decisao
SELECT id, @evento_id, @fraud_score, @status, @threshold_aprovacao,
       @versao_indice, @vetor_caracteristicas, @decidido_em, @notificacao_status
FROM @transacao;

INSERT INTO dbo.decisao_vizinho (decisao_id, posicao, referencia_indice, distancia, rotulo_fraude)
SELECT d.id, v.posicao, v.referencia_indice, v.distancia, v.rotulo_fraude
FROM @decisao AS d
CROSS JOIN (VALUES
      ${NEIGHBOR_ROWS}
) AS v (posicao, referencia_indice, distancia, rotulo_fraude);

COMMIT TRANSACTION;
`;

const UPDATE_NOTIFICATION = `
UPDATE d
SET notificacao_status = @status,
    notificacao_canal = @canal,
    notificacao_erro = @erro,
    notificacao_atualizada_em = @atualizada_em
FROM dbo.decisao AS d
JOIN dbo.transacao AS t ON t.id = d.transacao_id
WHERE t.transacao_externa_id = @transacao_externa_id
  AND d.notificacao_status = 'pendente';
`;

export class SqlDecisionRepository implements DecisionRepository, NotificationStatusWriter {
  constructor(private readonly pool: SqlPoolProvider) {}

  async record(decision: DecisionRecord): Promise<RecordDecisionResult> {
    const { transaction } = decision;
    const request = (await this.pool()).request()
      .input('transacao_externa_id', sql.NVarChar(128), decision.transactionId)
      .input('valor', sql.Decimal(18, 2), transaction.amount)
      .input('parcelas', sql.Int, transaction.installments)
      .input('solicitada_em', sql.DateTime2(3), transaction.requestedAt)
      .input('cliente_media_valor', sql.Decimal(18, 2), transaction.customer.avgAmount)
      .input('cliente_transacoes_24h', sql.Int, transaction.customer.txCount24h)
      .input('cliente_comerciantes_conhecidos', sql.NVarChar(sql.MAX), JSON.stringify(transaction.customer.knownMerchants))
      .input('comerciante_externo_id', sql.NVarChar(128), transaction.merchant.id)
      .input('comerciante_mcc', sql.Char(4), transaction.merchant.mcc)
      .input('comerciante_media_valor', sql.Decimal(18, 2), transaction.merchant.avgAmount)
      .input('terminal_online', sql.Bit, transaction.terminal.isOnline)
      .input('terminal_cartao_presente', sql.Bit, transaction.terminal.cardPresent)
      .input('terminal_km_de_casa', sql.Float, transaction.terminal.kmFromHome)
      .input('transacao_anterior_em', sql.DateTime2(3), transaction.lastTransaction?.timestamp ?? null)
      .input('transacao_anterior_km', sql.Float, transaction.lastTransaction?.kmFromCurrent ?? null)
      .input('evento_id', sql.NVarChar(64), decision.eventId)
      .input('fraud_score', sql.Decimal(3, 2), decision.fraudScore)
      .input('status', sql.VarChar(8), decision.approved ? 'APROVADO' : 'NEGADO')
      .input('threshold_aprovacao', sql.Decimal(5, 4), decision.approvalThreshold)
      .input('versao_indice', sql.NVarChar(64), decision.referenceIndexVersion)
      .input('vetor_caracteristicas', sql.NVarChar(1000), JSON.stringify(decision.featureVector))
      .input('decidido_em', sql.DateTime2(3), decision.decidedAt)
      .input('notificacao_status', sql.VarChar(16), decision.notificationStatus);

    decision.neighbors.forEach((neighbor, index) => {
      const position = index + 1;
      request
        .input(`v${position}_referencia`, sql.Int, neighbor.referenceId)
        .input(`v${position}_distancia`, sql.Float, neighbor.distance)
        .input(`v${position}_fraude`, sql.Bit, neighbor.label === 'fraud');
    });

    try {
      await request.batch(INSERT_DECISION);
      return 'recorded';
    } catch (error) {
      if (isUniqueViolation(error)) return 'duplicate';
      throw error;
    }
  }

  async updateNotificationStatus(transactionId: string, update: NotificationStatusUpdate): Promise<boolean> {
    const result = await (await this.pool()).request()
      .input('transacao_externa_id', sql.NVarChar(128), transactionId)
      .input('status', sql.VarChar(16), update.status)
      .input('canal', sql.VarChar(8), update.channel)
      .input('erro', sql.NVarChar(MAX_NOTIFICATION_ERROR_LENGTH), update.error?.slice(0, MAX_NOTIFICATION_ERROR_LENGTH) ?? null)
      .input('atualizada_em', sql.DateTime2(3), update.updatedAt)
      .query(UPDATE_NOTIFICATION);
    return (result.rowsAffected[0] ?? 0) > 0;
  }
}
