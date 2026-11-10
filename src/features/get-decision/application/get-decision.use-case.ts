import type { DecisionDetail } from '../domain/decision-detail.js';
import type { DecisionFinder } from './ports/decision-finder.js';

export type GetDecisionOutcome =
  | { readonly kind: 'found'; readonly decision: DecisionDetail }
  | { readonly kind: 'not_found' };

export interface GetDecisionUseCase {
  execute(id: string): Promise<GetDecisionOutcome>;
}

export class GetDecision implements GetDecisionUseCase {
  constructor(private readonly finder: DecisionFinder) {}

  async execute(id: string): Promise<GetDecisionOutcome> {
    const decision = await this.finder.findById(id);
    return decision ? { kind: 'found', decision } : { kind: 'not_found' };
  }
}
