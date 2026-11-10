import type { FeatureHttp } from '../../shared/feature-http.js';
import type { Persistence } from '../../shared/persistence.js';
import { getDecisionPaths } from './api/get-decision.openapi.js';
import { createGetDecisionRouter } from './api/get-decision.router.js';
import { GetDecision } from './application/get-decision.use-case.js';
import type { DecisionFinder } from './application/ports/decision-finder.js';
import { MemoryDecisionFinder } from './infrastructure/memory-decision-finder.js';
import { SqlDecisionFinder } from './infrastructure/sql-decision-finder.js';

export function createGetDecisionFeature(options: { readonly persistence: Persistence }): FeatureHttp {
  const finder: DecisionFinder =
    options.persistence.kind === 'sql'
      ? new SqlDecisionFinder(options.persistence.pool)
      : new MemoryDecisionFinder(options.persistence.database);
  return { router: createGetDecisionRouter(new GetDecision(finder)), openApiPaths: getDecisionPaths };
}
