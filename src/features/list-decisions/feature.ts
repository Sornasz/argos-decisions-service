import type { Persistence } from '../../shared/persistence.js';
import { createListDecisionsRouter } from './api/list-decisions.router.js';
import { listDecisionsPaths } from './api/list-decisions.openapi.js';
import { ListDecisions } from './application/list-decisions.use-case.js';
import type { DecisionSearch } from './application/ports/decision-search.js';
import { MemoryDecisionSearch } from './infrastructure/memory-decision-search.js';
import { SqlDecisionSearch } from './infrastructure/sql-decision-search.js';
import type { FeatureHttp } from '../../shared/feature-http.js';

export function createListDecisionsFeature(options: { readonly persistence: Persistence }): FeatureHttp {
  const search: DecisionSearch =
    options.persistence.kind === 'sql'
      ? new SqlDecisionSearch(options.persistence.pool)
      : new MemoryDecisionSearch(options.persistence.database);
  return { router: createListDecisionsRouter(new ListDecisions(search)), openApiPaths: listDecisionsPaths };
}
