export type DecisionStatus = 'APROVADO' | 'NEGADO';
export type NotificationState = 'pendente' | 'nao_aplicavel' | 'enviada' | 'falhou';

export const PAGE_SIZE = 20;

export interface DecisionSummary {
  readonly id: string;
  readonly transactionId: string;
  readonly status: DecisionStatus;
  readonly fraudScore: number;
  readonly approvalThreshold: number;
  readonly decidedAt: Date;
  readonly amount: number;
  readonly mcc: string;
  readonly markedIncorrect: boolean;
  readonly notificationStatus: NotificationState;
}

export interface DecisionFilter {
  readonly status?: DecisionStatus;
  readonly from?: Date;
  readonly to?: Date;
  readonly minScore?: number;
  readonly maxScore?: number;
}

export interface DecisionPage {
  readonly items: readonly DecisionSummary[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

export function buildPage(items: readonly DecisionSummary[], total: number, page: number): DecisionPage {
  return { items, page, pageSize: PAGE_SIZE, total, totalPages: Math.ceil(total / PAGE_SIZE) };
}
