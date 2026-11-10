import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/bootstrap/server.js';
import { createCreateReviewFeature } from '../../src/features/create-review/index.js';
import { createDecisionMetricsFeature } from '../../src/features/decision-metrics/index.js';
import { createDeleteReviewFeature } from '../../src/features/delete-review/index.js';
import { createGetDecisionFeature } from '../../src/features/get-decision/index.js';
import { createHealthCheckFeature } from '../../src/features/health-check/index.js';
import { createListDecisionsFeature } from '../../src/features/list-decisions/index.js';
import { createListReviewsFeature } from '../../src/features/list-reviews/index.js';
import { createRecordDecisionFeature } from '../../src/features/record-decision/index.js';
import { createUpdateReviewFeature } from '../../src/features/update-review/index.js';
import { MemoryDatabase, type Persistence } from '../../src/shared/index.js';
import { aDeniedEvent, anEvent } from '../support/builders.js';

const asyncApiFile = fileURLToPath(new URL('../../asyncapi.yaml', import.meta.url));

const oneFraudNeighbor = [0.011, 0.014, 0.017, 0.023, 0.031].map((distance, index) => ({
  referenceId: 300 + index,
  distance,
  label: index === 0 ? ('fraud' as const) : ('legit' as const),
}));

const analyst = { name: 'Eduardo Martins', email: 'Eduardo.Martins@Example.com' };

let server: Server;
let baseUrl: string;

async function call(method: string, path: string, body?: unknown) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  const text = await response.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: response.status, json, text, headers: response.headers };
}

async function idOf(transactionId: string): Promise<string> {
  const { json } = await call('GET', '/decisions');
  return json.items.find((item: { transactionId: string }) => item.transactionId === transactionId).id;
}

beforeAll(async () => {
  const database = new MemoryDatabase();
  const persistence: Persistence = { kind: 'memory', database };
  const record = createRecordDecisionFeature({ persistence, fraudAlert: { decisionDenied: async () => undefined } });

  const events = [
    anEvent({ transactionId: 'tx-0001', eventId: 'e1', occurredAt: '2026-11-01T10:00:00.000Z' }),
    aDeniedEvent({ transactionId: 'tx-9999', eventId: 'e2', occurredAt: '2026-11-02T10:00:00.000Z' }),
    aDeniedEvent({ transactionId: 'tx-8888', eventId: 'e3', occurredAt: '2026-11-03T10:00:00.000Z' }),
    anEvent({
      transactionId: 'tx-0002',
      eventId: 'e4',
      occurredAt: '2026-11-04T10:00:00.000Z',
      decision: { fraudScore: 0.2 },
      neighbors: oneFraudNeighbor,
    }),
  ];
  for (const event of events) {
    const outcome = await record.recordDecision.execute(event);
    if (outcome.kind !== 'recorded') throw new Error(`seed inválido: ${JSON.stringify(outcome)}`);
  }

  const app = createApp({
    asyncApiFile,
    log: () => undefined,
    features: [
      createListDecisionsFeature({ persistence }),
      createDecisionMetricsFeature({ persistence }),
      createGetDecisionFeature({ persistence }),
      createCreateReviewFeature({ persistence }),
      createListReviewsFeature({ persistence }),
      createUpdateReviewFeature({ persistence }),
      createDeleteReviewFeature({ persistence }),
      createHealthCheckFeature({ persistence, receiverEnabled: false }),
    ],
  });
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

describe('GET /decisions', () => {
  it('lista da decisão mais recente para a mais antiga, com paginação', async () => {
    const { status, json } = await call('GET', '/decisions');

    expect(status).toBe(200);
    expect(json).toMatchObject({ page: 1, pageSize: 20, total: 4, totalPages: 1 });
    expect(json.items.map((item: { transactionId: string }) => item.transactionId)).toEqual(['tx-0002', 'tx-8888', 'tx-9999', 'tx-0001']);
    expect(json.items[1]).toMatchObject({
      status: 'NEGADO',
      fraudScore: 0.8,
      approvalThreshold: 0.6,
      amount: 9505.97,
      mcc: '7802',
      markedIncorrect: false,
      notificationStatus: 'pendente',
    });
  });

  it('filtra por status, em maiúsculas ou minúsculas', async () => {
    const upper = await call('GET', '/decisions?status=NEGADO');
    const lower = await call('GET', '/decisions?status=aprovado');

    expect(upper.json.total).toBe(2);
    expect(lower.json.items.map((item: { transactionId: string }) => item.transactionId)).toEqual(['tx-0002', 'tx-0001']);
  });

  it('filtra por faixa de score e por período', async () => {
    expect((await call('GET', '/decisions?minScore=0.5')).json.total).toBe(2);
    expect((await call('GET', '/decisions?maxScore=0.3')).json.total).toBe(2);
    expect((await call('GET', '/decisions?minScore=0.1&maxScore=0.3')).json.total).toBe(1);
    expect((await call('GET', '/decisions?from=2026-11-02&to=2026-11-03T23:59:59Z')).json.total).toBe(2);
    expect((await call('GET', '/decisions?status=NEGADO&from=2026-11-03T00:00:00Z')).json.total).toBe(1);
  });

  it('devolve página vazia além do fim, mantendo o total', async () => {
    const { json } = await call('GET', '/decisions?page=2');

    expect(json).toMatchObject({ items: [], page: 2, total: 4, totalPages: 1 });
  });

  it('rejeita parâmetros inválidos apontando cada campo', async () => {
    const { status, json } = await call('GET', '/decisions?status=talvez&minScore=2&from=ontem&page=0');

    expect(status).toBe(400);
    expect(json.error).toBe('invalid_request');
    expect(json.invalid_fields.map((field: { field: string }) => field.field)).toEqual(['status', 'from', 'minScore', 'page']);
  });

  it('rejeita intervalos invertidos', async () => {
    const { json } = await call('GET', '/decisions?minScore=0.9&maxScore=0.1&from=2026-11-05&to=2026-11-01');

    expect(json.invalid_fields.map((field: { field: string }) => field.field).sort()).toEqual(['from', 'minScore']);
  });
});

describe('GET /decisions/metrics', () => {
  it('devolve volume, taxas e score médio, antes de tratar "metrics" como um :id', async () => {
    const { status, json } = await call('GET', '/decisions/metrics');

    expect(status).toBe(200);
    expect(json).toEqual({
      total: 4,
      approved: 2,
      denied: 2,
      approvalRate: 0.5,
      denialRate: 0.5,
      averageScore: 0.45,
      markedIncorrect: 0,
    });
  });
});

describe('GET /decisions/:id', () => {
  it('detalha a decisão com transação, vetor e os 5 vizinhos', async () => {
    const id = await idOf('tx-9999');

    const { status, json } = await call('GET', `/decisions/${id}`);

    expect(status).toBe(200);
    expect(json).toMatchObject({ id, transactionId: 'tx-9999', status: 'NEGADO', referenceIndexVersion: 'sha256:c4e472531de1' });
    expect(json.featureVector).toHaveLength(14);
    expect(json.neighbors).toHaveLength(5);
    expect(json.neighbors[0]).toMatchObject({ position: 1, label: 'fraud' });
    expect(json.transaction.merchant).toEqual({ id: 'MERC-068', mcc: '7802', avgAmount: 54.86 });
    expect(json.transaction.lastTransaction).toMatchObject({ kmFromCurrent: 50 });
  });

  it('responde 404 para uma decisão que não existe e 400 para um ID que não é UUID', async () => {
    const missing = await call('GET', '/decisions/3f2c9a54-6d1e-4b7a-9c58-2a4f1e0d7b11');
    const malformed = await call('GET', '/decisions/tx-9999');

    expect(missing).toMatchObject({ status: 404, json: { error: 'not_found' } });
    expect(malformed).toMatchObject({ status: 400, json: { error: 'invalid_request' } });
  });
});

describe('CRUD de revisões', () => {
  it('cria, lista, altera e remove, mantendo marcada_incorreta pela revisão mais recente', async () => {
    const decisionId = await idOf('tx-8888');
    const markedIncorrect = async () => (await call('GET', `/decisions/${decisionId}`)).json.markedIncorrect;

    const first = await call('POST', `/decisions/${decisionId}/reviews`, { analyst, incorrect: true, comment: '  Cliente confirmou a compra.  ' });
    expect(first.status).toBe(201);
    expect(first.headers.get('location')).toBe(`/reviews/${first.json.id}`);
    expect(first.json).toMatchObject({
      decisionId,
      analyst: { name: 'Eduardo Martins', email: 'eduardo.martins@example.com' },
      incorrect: true,
      comment: 'Cliente confirmou a compra.',
      updatedAt: null,
    });
    expect(await markedIncorrect()).toBe(true);

    const second = await call('POST', `/decisions/${decisionId}/reviews`, { analyst, incorrect: false });
    expect(second.status).toBe(201);
    expect(second.json.comment).toBeNull();
    expect(await markedIncorrect()).toBe(false);

    const listed = await call('GET', `/decisions/${decisionId}/reviews`);
    expect(listed.json.items.map((review: { id: string }) => review.id)).toEqual([second.json.id, first.json.id]);

    const olderChanged = await call('PUT', `/reviews/${first.json.id}`, { comment: 'Texto novo' });
    expect(olderChanged.status).toBe(200);
    expect(olderChanged.json).toMatchObject({ incorrect: true, comment: 'Texto novo' });
    expect(olderChanged.json.updatedAt).not.toBeNull();
    expect(await markedIncorrect()).toBe(false);

    const latestChanged = await call('PUT', `/reviews/${second.json.id}`, { incorrect: true, comment: null });
    expect(latestChanged.json).toMatchObject({ incorrect: true, comment: null });
    expect(await markedIncorrect()).toBe(true);
    expect((await call('GET', '/decisions/metrics')).json.markedIncorrect).toBe(1);

    expect((await call('DELETE', `/reviews/${second.json.id}`)).status).toBe(204);
    expect(await markedIncorrect()).toBe(true);

    expect((await call('DELETE', `/reviews/${first.json.id}`)).status).toBe(204);
    expect(await markedIncorrect()).toBe(false);
    expect((await call('GET', `/decisions/${decisionId}/reviews`)).json).toEqual({ items: [] });
    expect((await call('GET', '/decisions/metrics')).json.markedIncorrect).toBe(0);
  });

  it('reaproveita o analista pelo e-mail em revisões diferentes', async () => {
    const decisionId = await idOf('tx-0001');

    const one = await call('POST', `/decisions/${decisionId}/reviews`, { analyst, incorrect: false });
    const two = await call('POST', `/decisions/${decisionId}/reviews`, {
      analyst: { name: 'Eduardo M.', email: 'eduardo.martins@example.com' },
      incorrect: false,
    });

    expect(one.json.analyst.email).toBe(two.json.analyst.email);
    await call('DELETE', `/reviews/${one.json.id}`);
    await call('DELETE', `/reviews/${two.json.id}`);
  });

  it('valida o corpo de POST e aponta todos os campos de uma vez', async () => {
    const decisionId = await idOf('tx-0001');

    const { status, json } = await call('POST', `/decisions/${decisionId}/reviews`, {
      analyst: { name: '  ', email: 'sem-arroba' },
      incorrect: 'sim',
      comment: 42,
    });

    expect(status).toBe(400);
    expect(json.invalid_fields.map((field: { field: string }) => field.field)).toEqual(['analyst.name', 'analyst.email', 'incorrect', 'comment']);
  });

  it('responde 404 para decisão inexistente e 400 para ID malformado', async () => {
    const unknown = '3f2c9a54-6d1e-4b7a-9c58-2a4f1e0d7b11';

    expect((await call('POST', `/decisions/${unknown}/reviews`, { analyst, incorrect: true })).status).toBe(404);
    expect((await call('GET', `/decisions/${unknown}/reviews`)).status).toBe(404);
    expect((await call('GET', '/decisions/abc/reviews')).status).toBe(400);
  });

  it('valida PUT e DELETE de revisões que não existem', async () => {
    const unknown = '9b1e6c52-0f3a-4d8e-8a47-5e2c71d3a0b4';

    expect((await call('PUT', `/reviews/${unknown}`, { incorrect: true })).status).toBe(404);
    expect((await call('PUT', `/reviews/${unknown}`, {})).json.invalid_fields).toEqual([
      { field: 'body', reason: 'informe incorrect, comment ou os dois' },
    ]);
    expect((await call('PUT', '/reviews/xyz', { incorrect: true })).status).toBe(400);
    expect((await call('DELETE', `/reviews/${unknown}`)).status).toBe(404);
    expect((await call('DELETE', '/reviews/xyz')).status).toBe(400);
  });
});

describe('infraestrutura da API', () => {
  it('GET /health informa o armazenamento e o receptor', async () => {
    const { status, json } = await call('GET', '/health');

    expect(status).toBe(200);
    expect(json).toEqual({ status: 'ok', store: 'memory', receiver: 'disabled', reason: null });
  });

  it('serve o OpenAPI com todas as operações e exemplos em /docs', async () => {
    const { status, json } = await call('GET', '/docs/openapi.json');

    expect(status).toBe(200);
    const operations = Object.entries(json.paths).flatMap(([path, item]) =>
      Object.keys(item as object).map((method) => `${method.toUpperCase()} ${path}`),
    );
    expect(operations.sort()).toEqual(
      [
        'DELETE /reviews/{id}',
        'GET /decisions',
        'GET /decisions/metrics',
        'GET /decisions/{id}',
        'GET /decisions/{id}/reviews',
        'GET /health',
        'POST /decisions/{id}/reviews',
        'PUT /reviews/{id}',
      ].sort(),
    );
    expect(JSON.stringify(json.paths['/decisions'].get.responses['200'])).toContain('"example"');
    expect((await call('GET', '/docs/')).text).toContain('swagger-ui');
  });

  it('serve o AsyncAPI do evento TransactionScored em /docs/events', async () => {
    const { status, text, headers } = await call('GET', '/docs/events');

    expect(status).toBe(200);
    expect(headers.get('content-type')).toContain('yaml');
    expect(text).toContain('asyncapi: 2.6.0');
    expect(text).toContain('TransactionScored');
  });

  it('responde JSON para rota desconhecida e para corpo que não é JSON', async () => {
    const decisionId = await idOf('tx-0001');

    expect(await call('GET', '/nao-existe')).toMatchObject({ status: 404, json: { error: 'not_found' } });
    expect(await call('POST', `/decisions/${decisionId}/reviews`, '{quebrado')).toMatchObject({
      status: 400,
      json: { error: 'invalid_json' },
    });
  });
});
