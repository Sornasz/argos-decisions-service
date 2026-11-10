import type { Router } from 'express';

/** O que cada feature de leitura ou revisão entrega ao servidor: as rotas e a documentação OpenAPI delas. */
export interface FeatureHttp {
  readonly router: Router;
  readonly openApiPaths: Record<string, unknown>;
}
