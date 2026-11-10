export interface DecisionNeighbor {
  readonly position: number;
  readonly referenceId: number;
  readonly distance: number;
  readonly label: 'fraud' | 'legit';
}

export interface DecisionDetail {
  readonly id: string;
  readonly transactionId: string;
  readonly eventId: string;
  readonly status: 'APROVADO' | 'NEGADO';
  readonly fraudScore: number;
  readonly approvalThreshold: number;
  readonly referenceIndexVersion: string | null;
  readonly decidedAt: Date;
  readonly markedIncorrect: boolean;
  readonly notification: {
    readonly status: string;
    readonly channel: string | null;
    readonly error: string | null;
    readonly updatedAt: Date | null;
  };
  readonly featureVector: readonly number[];
  readonly neighbors: readonly DecisionNeighbor[];
  readonly transaction: {
    readonly amount: number;
    readonly installments: number;
    readonly requestedAt: Date;
    readonly customer: { readonly avgAmount: number; readonly txCount24h: number; readonly knownMerchants: readonly string[] };
    readonly merchant: { readonly id: string; readonly mcc: string; readonly avgAmount: number };
    readonly terminal: { readonly isOnline: boolean; readonly cardPresent: boolean; readonly kmFromHome: number };
    readonly lastTransaction: { readonly timestamp: Date; readonly kmFromCurrent: number } | null;
  };
}
