import { randomUUID } from 'node:crypto';

export interface MemoryNeighbor {
  readonly position: number;
  readonly referenceId: number;
  readonly distance: number;
  readonly fraud: boolean;
}

export interface MemoryDecision {
  readonly id: string;
  readonly transactionId: string;
  readonly eventId: string;
  readonly approved: boolean;
  readonly fraudScore: number;
  readonly approvalThreshold: number;
  readonly referenceIndexVersion: string | null;
  readonly decidedAt: Date;
  readonly createdAt: Date;
  readonly featureVector: readonly number[];
  readonly neighbors: readonly MemoryNeighbor[];
  readonly transaction: {
    readonly amount: number;
    readonly installments: number;
    readonly requestedAt: Date;
    readonly customer: { readonly avgAmount: number; readonly txCount24h: number; readonly knownMerchants: readonly string[] };
    readonly merchant: { readonly id: string; readonly mcc: string; readonly avgAmount: number };
    readonly terminal: { readonly isOnline: boolean; readonly cardPresent: boolean; readonly kmFromHome: number };
    readonly lastTransaction: { readonly timestamp: Date; readonly kmFromCurrent: number } | null;
  };
  markedIncorrect: boolean;
  notificationStatus: string;
  notificationChannel: string | null;
  notificationError: string | null;
  notificationUpdatedAt: Date | null;
}

export interface MemoryReview {
  readonly id: string;
  readonly decisionId: string;
  readonly analystName: string;
  readonly analystEmail: string;
  incorrect: boolean;
  comment: string | null;
  readonly reviewedAt: Date;
  updatedAt: Date | null;
}

/**
 * Estado compartilhado pelos adapters em memória. Só existe com
 * DECISION_STORE=memory, para desenvolvimento e testes: os dados somem ao
 * reiniciar o processo.
 */
export class MemoryDatabase {
  readonly decisions = new Map<string, MemoryDecision>();
  readonly reviews = new Map<string, MemoryReview>();

  newId(): string {
    return randomUUID();
  }

  findDecisionByTransactionId(transactionId: string): MemoryDecision | undefined {
    for (const decision of this.decisions.values()) {
      if (decision.transactionId === transactionId) return decision;
    }
    return undefined;
  }

  reviewsOf(decisionId: string): MemoryReview[] {
    // Revertida antes do sort (estável): em empate de horário, a revisão criada por último vem primeiro.
    return [...this.reviews.values()]
      .reverse()
      .filter((review) => review.decisionId === decisionId)
      .sort((a, b) => b.reviewedAt.getTime() - a.reviewedAt.getTime());
  }

  /** O estado atual da decisão é o veredito da revisão mais recente; sem revisões, não está marcada. */
  refreshMarkedIncorrect(decisionId: string): void {
    const decision = this.decisions.get(decisionId);
    if (!decision) return;
    decision.markedIncorrect = this.reviewsOf(decisionId)[0]?.incorrect ?? false;
  }
}
