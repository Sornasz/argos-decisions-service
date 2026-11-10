import { PAGE_SIZE, buildPage, type DecisionPage } from '../domain/decision-summary.js';
import { parseListDecisionsQuery, type InvalidField } from './list-decisions-query.js';
import type { DecisionSearch } from './ports/decision-search.js';

export type ListDecisionsOutcome =
  | { readonly kind: 'listed'; readonly page: DecisionPage }
  | { readonly kind: 'invalid'; readonly invalidFields: InvalidField[] };

export interface ListDecisionsUseCase {
  execute(query: Record<string, unknown>): Promise<ListDecisionsOutcome>;
}

export class ListDecisions implements ListDecisionsUseCase {
  constructor(private readonly search: DecisionSearch) {}

  async execute(query: Record<string, unknown>): Promise<ListDecisionsOutcome> {
    const parsed = parseListDecisionsQuery(query);
    if (!parsed.ok) return { kind: 'invalid', invalidFields: parsed.invalidFields };

    const { items, total } = await this.search.search(parsed.filter, (parsed.page - 1) * PAGE_SIZE, PAGE_SIZE);
    return { kind: 'listed', page: buildPage(items, total, parsed.page) };
  }
}
