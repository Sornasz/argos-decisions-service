import { describe, expect, it } from 'vitest';
import { computeMetrics } from '../../../src/features/decision-metrics/domain/decision-metrics.js';

describe('computeMetrics', () => {
  it('calcula taxas e média de score', () => {
    expect(computeMetrics({ total: 8, approved: 6, denied: 2, scoreSum: 2.4, markedIncorrect: 1 })).toEqual({
      total: 8,
      approved: 6,
      denied: 2,
      approvalRate: 0.75,
      denialRate: 0.25,
      averageScore: 0.3,
      markedIncorrect: 1,
    });
  });

  it('arredonda para 4 casas', () => {
    const metrics = computeMetrics({ total: 3, approved: 2, denied: 1, scoreSum: 1, markedIncorrect: 0 });

    expect(metrics.approvalRate).toBe(0.6667);
    expect(metrics.averageScore).toBe(0.3333);
  });

  it('sem decisões, taxas valem 0 e a média de score é null', () => {
    expect(computeMetrics({ total: 0, approved: 0, denied: 0, scoreSum: 0, markedIncorrect: 0 })).toMatchObject({
      approvalRate: 0,
      denialRate: 0,
      averageScore: null,
    });
  });
});
