export interface DeniedDecisionSummary {
  readonly transactionId: string;
  readonly amount: number;
  readonly fraudScore: number;
  readonly mcc: string;
  readonly transactionAt: Date;
}

/** Acionado depois que uma decisão negada foi gravada pela primeira vez. */
export interface FraudAlertTrigger {
  decisionDenied(summary: DeniedDecisionSummary): Promise<void>;
}
