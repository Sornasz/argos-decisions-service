import sql from 'mssql';
import type { SqlPoolProvider } from '../../../shared/persistence.js';
import type { DecisionFinder } from '../application/ports/decision-finder.js';
import type { DecisionDetail } from '../domain/decision-detail.js';

const FIND = `
SELECT d.id, d.evento_id, d.status, d.fraud_score, d.threshold_aprovacao, d.versao_indice, d.vetor_caracteristicas,
       d.decidido_em, d.marcada_incorreta, d.notificacao_status, d.notificacao_canal, d.notificacao_erro,
       d.notificacao_atualizada_em,
       t.transacao_externa_id, t.valor, t.parcelas, t.solicitada_em, t.cliente_media_valor, t.cliente_transacoes_24h,
       t.cliente_comerciantes_conhecidos, t.comerciante_externo_id, t.comerciante_mcc, t.comerciante_media_valor,
       t.terminal_online, t.terminal_cartao_presente, t.terminal_km_de_casa, t.transacao_anterior_em, t.transacao_anterior_km
FROM dbo.decisao AS d
JOIN dbo.transacao AS t ON t.id = d.transacao_id
WHERE d.id = @id;

SELECT posicao, referencia_indice, distancia, rotulo_fraude
FROM dbo.decisao_vizinho
WHERE decisao_id = @id
ORDER BY posicao;
`;

interface DecisionRow {
  id: string;
  evento_id: string;
  status: 'APROVADO' | 'NEGADO';
  fraud_score: number;
  threshold_aprovacao: number;
  versao_indice: string | null;
  vetor_caracteristicas: string;
  decidido_em: Date;
  marcada_incorreta: boolean;
  notificacao_status: string;
  notificacao_canal: string | null;
  notificacao_erro: string | null;
  notificacao_atualizada_em: Date | null;
  transacao_externa_id: string;
  valor: number;
  parcelas: number;
  solicitada_em: Date;
  cliente_media_valor: number;
  cliente_transacoes_24h: number;
  cliente_comerciantes_conhecidos: string;
  comerciante_externo_id: string;
  comerciante_mcc: string;
  comerciante_media_valor: number;
  terminal_online: boolean;
  terminal_cartao_presente: boolean;
  terminal_km_de_casa: number;
  transacao_anterior_em: Date | null;
  transacao_anterior_km: number | null;
}

interface NeighborRow {
  posicao: number;
  referencia_indice: number;
  distancia: number;
  rotulo_fraude: boolean;
}

export class SqlDecisionFinder implements DecisionFinder {
  constructor(private readonly pool: SqlPoolProvider) {}

  async findById(id: string): Promise<DecisionDetail | null> {
    const result = await (await this.pool()).request().input('id', sql.UniqueIdentifier, id).query(FIND);
    const [rows, neighborRows] = result.recordsets as unknown as [DecisionRow[], NeighborRow[]];
    const row = rows[0];
    if (!row) return null;

    return {
      id: row.id.toLowerCase(),
      transactionId: row.transacao_externa_id,
      eventId: row.evento_id,
      status: row.status,
      fraudScore: Number(row.fraud_score),
      approvalThreshold: Number(row.threshold_aprovacao),
      referenceIndexVersion: row.versao_indice,
      decidedAt: row.decidido_em,
      markedIncorrect: Boolean(row.marcada_incorreta),
      notification: {
        status: row.notificacao_status,
        channel: row.notificacao_canal,
        error: row.notificacao_erro,
        updatedAt: row.notificacao_atualizada_em,
      },
      featureVector: JSON.parse(row.vetor_caracteristicas) as number[],
      neighbors: neighborRows.map((neighbor) => ({
        position: neighbor.posicao,
        referenceId: neighbor.referencia_indice,
        distance: neighbor.distancia,
        label: neighbor.rotulo_fraude ? 'fraud' : 'legit',
      })),
      transaction: {
        amount: Number(row.valor),
        installments: row.parcelas,
        requestedAt: row.solicitada_em,
        customer: {
          avgAmount: Number(row.cliente_media_valor),
          txCount24h: row.cliente_transacoes_24h,
          knownMerchants: JSON.parse(row.cliente_comerciantes_conhecidos) as string[],
        },
        merchant: { id: row.comerciante_externo_id, mcc: row.comerciante_mcc, avgAmount: Number(row.comerciante_media_valor) },
        terminal: {
          isOnline: Boolean(row.terminal_online),
          cardPresent: Boolean(row.terminal_cartao_presente),
          kmFromHome: row.terminal_km_de_casa,
        },
        lastTransaction:
          row.transacao_anterior_em && row.transacao_anterior_km !== null
            ? { timestamp: row.transacao_anterior_em, kmFromCurrent: row.transacao_anterior_km }
            : null,
      },
    };
  }
}
