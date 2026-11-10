export const NEIGHBOR_COUNT = 5;
export const FEATURE_VECTOR_DIMENSIONS = 14;

export type ReferenceLabel = 'fraud' | 'legit';

export interface ReferenceNeighbor {
  readonly referenceId: number;
  readonly distance: number;
  readonly label: ReferenceLabel;
}

export interface TransactionSnapshot {
  readonly amount: number;
  readonly installments: number;
  readonly requestedAt: Date;
  readonly customer: {
    readonly avgAmount: number;
    readonly txCount24h: number;
    readonly knownMerchants: readonly string[];
  };
  readonly merchant: {
    readonly id: string;
    readonly mcc: string;
    readonly avgAmount: number;
  };
  readonly terminal: {
    readonly isOnline: boolean;
    readonly cardPresent: boolean;
    readonly kmFromHome: number;
  };
  readonly lastTransaction: { readonly timestamp: Date; readonly kmFromCurrent: number } | null;
}

/** Estado inicial da notificação: só decisões negadas geram alerta. */
export type InitialNotificationStatus = 'nao_aplicavel' | 'pendente';

export interface DecisionRecordInput {
  readonly eventId: string;
  readonly transactionId: string;
  readonly decidedAt: Date;
  readonly approved: boolean;
  readonly fraudScore: number;
  readonly approvalThreshold: number;
  readonly featureVector: readonly number[];
  readonly neighbors: readonly ReferenceNeighbor[];
  readonly referenceIndexVersion: string | null;
  readonly transaction: TransactionSnapshot;
}

export interface DecisionRecord extends DecisionRecordInput {
  readonly notificationStatus: InitialNotificationStatus;
}

export type CreateDecisionRecordResult =
  | { readonly ok: true; readonly record: DecisionRecord }
  | { readonly ok: false; readonly violations: string[] };

const SCORE_TOLERANCE = 1e-9;

/**
 * Confere a coerência interna da decisão antes de gravá-la: o score precisa ser
 * a fração de fraudes entre os 5 vizinhos e a aprovação precisa seguir o
 * threshold informado. Um evento que não fecha essas contas não é auditável.
 */
export function createDecisionRecord(input: DecisionRecordInput): CreateDecisionRecordResult {
  const violations: string[] = [];

  if (input.neighbors.length !== NEIGHBOR_COUNT) {
    violations.push(`neighbors deve ter ${NEIGHBOR_COUNT} itens, recebeu ${input.neighbors.length}`);
  } else {
    const frauds = input.neighbors.filter((neighbor) => neighbor.label === 'fraud').length;
    if (Math.abs(frauds / NEIGHBOR_COUNT - input.fraudScore) > SCORE_TOLERANCE) {
      violations.push(`decision.fraudScore ${input.fraudScore} não corresponde a ${frauds} fraudes em ${NEIGHBOR_COUNT} vizinhos`);
    }
    const positions = new Set(input.neighbors.map((neighbor) => neighbor.referenceId));
    if (positions.size !== NEIGHBOR_COUNT) {
      violations.push('neighbors contém referenceId repetido');
    }
  }

  if (input.featureVector.length !== FEATURE_VECTOR_DIMENSIONS) {
    violations.push(`featureVector deve ter ${FEATURE_VECTOR_DIMENSIONS} dimensões, recebeu ${input.featureVector.length}`);
  }

  if (!(input.approvalThreshold > 0 && input.approvalThreshold <= 1)) {
    violations.push('decision.approvalThreshold deve estar no intervalo (0, 1]');
  } else if (input.approved !== input.fraudScore < input.approvalThreshold) {
    violations.push('decision.approved não corresponde a fraudScore < approvalThreshold');
  }

  if (violations.length > 0) return { ok: false, violations };

  return {
    ok: true,
    record: { ...input, notificationStatus: input.approved ? 'nao_aplicavel' : 'pendente' },
  };
}
