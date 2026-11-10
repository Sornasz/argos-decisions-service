import { computeMetrics, type DecisionMetrics } from '../domain/decision-metrics.js';
import type { DecisionTotalsReader } from './ports/decision-totals-reader.js';

export interface GetDecisionMetricsUseCase {
  execute(): Promise<DecisionMetrics>;
}

export class GetDecisionMetrics implements GetDecisionMetricsUseCase {
  constructor(private readonly totals: DecisionTotalsReader) {}

  async execute(): Promise<DecisionMetrics> {
    return computeMetrics(await this.totals.read());
  }
}
