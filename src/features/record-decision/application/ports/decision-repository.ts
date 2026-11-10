import type { DecisionRecord } from '../../domain/decision-record.js';

export type RecordDecisionResult = 'recorded' | 'duplicate';

export interface DecisionRepository {
  /**
   * Grava transação, decisão e vizinhos numa única transação de banco.
   * Devolve `duplicate`, sem alterar nada, quando o ID da transação já existe.
   */
  record(decision: DecisionRecord): Promise<RecordDecisionResult>;
}
