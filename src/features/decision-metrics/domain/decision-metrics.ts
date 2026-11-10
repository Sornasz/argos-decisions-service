export interface DecisionTotals {
  readonly total: number;
  readonly approved: number;
  readonly denied: number;
  readonly scoreSum: number;
  readonly markedIncorrect: number;
}

export interface DecisionMetrics {
  readonly total: number;
  readonly approved: number;
  readonly denied: number;
  readonly approvalRate: number;
  readonly denialRate: number;
  readonly averageScore: number | null;
  readonly markedIncorrect: number;
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** Sem decisões, as taxas valem 0 e a média de score é null: não existe média de zero itens. */
export function computeMetrics(totals: DecisionTotals): DecisionMetrics {
  const { total } = totals;
  return {
    total,
    approved: totals.approved,
    denied: totals.denied,
    approvalRate: total === 0 ? 0 : round(totals.approved / total, 4),
    denialRate: total === 0 ? 0 : round(totals.denied / total, 4),
    averageScore: total === 0 ? null : round(totals.scoreSum / total, 4),
    markedIncorrect: totals.markedIncorrect,
  };
}
