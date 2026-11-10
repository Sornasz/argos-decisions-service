type PathItem = Record<string, unknown>;

const uuid = { type: 'string', format: 'uuid' } as const;
const timestamp = { type: 'string', format: 'date-time' } as const;

const schemas = {
  DecisionSummary: {
    type: 'object',
    properties: {
      id: uuid,
      transactionId: { type: 'string', example: 'tx-1329056812' },
      status: { type: 'string', enum: ['APROVADO', 'NEGADO'] },
      fraudScore: { type: 'number', minimum: 0, maximum: 1, description: 'Fração de fraudes entre os 5 vizinhos.' },
      approvalThreshold: { type: 'number', example: 0.6 },
      decidedAt: timestamp,
      amount: { type: 'number' },
      mcc: { type: 'string', example: '5411' },
      markedIncorrect: { type: 'boolean', description: 'Veredito da revisão mais recente; false sem revisões.' },
      notificationStatus: { type: 'string', enum: ['pendente', 'nao_aplicavel', 'enviada', 'falhou'] },
    },
  },
  DecisionPage: {
    type: 'object',
    properties: {
      items: { type: 'array', items: { $ref: '#/components/schemas/DecisionSummary' } },
      page: { type: 'integer' },
      pageSize: { type: 'integer', example: 20 },
      total: { type: 'integer' },
      totalPages: { type: 'integer' },
    },
  },
  DecisionDetail: {
    type: 'object',
    properties: {
      id: uuid,
      transactionId: { type: 'string' },
      eventId: { type: 'string' },
      status: { type: 'string', enum: ['APROVADO', 'NEGADO'] },
      fraudScore: { type: 'number' },
      approvalThreshold: { type: 'number' },
      referenceIndexVersion: { type: 'string', nullable: true },
      decidedAt: timestamp,
      markedIncorrect: { type: 'boolean' },
      notification: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['pendente', 'nao_aplicavel', 'enviada', 'falhou'] },
          channel: { type: 'string', nullable: true, enum: ['gmail', 'log', null] },
          error: { type: 'string', nullable: true },
          updatedAt: { ...timestamp, nullable: true },
        },
      },
      featureVector: { type: 'array', items: { type: 'number' }, minItems: 14, maxItems: 14 },
      neighbors: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            position: { type: 'integer' },
            referenceId: { type: 'integer' },
            distance: { type: 'number' },
            label: { type: 'string', enum: ['fraud', 'legit'] },
          },
        },
      },
      transaction: { type: 'object', description: 'Transação como chegou no evento TransactionScored.' },
    },
  },
  DecisionMetrics: {
    type: 'object',
    properties: {
      total: { type: 'integer' },
      approved: { type: 'integer' },
      denied: { type: 'integer' },
      approvalRate: { type: 'number', minimum: 0, maximum: 1 },
      denialRate: { type: 'number', minimum: 0, maximum: 1 },
      averageScore: { type: 'number', nullable: true },
      markedIncorrect: { type: 'integer' },
    },
  },
  NewReview: {
    type: 'object',
    required: ['analyst', 'incorrect'],
    properties: {
      analyst: {
        type: 'object',
        required: ['name', 'email'],
        properties: { name: { type: 'string', maxLength: 200 }, email: { type: 'string', format: 'email' } },
      },
      incorrect: { type: 'boolean', description: 'true quando o analista considera a decisão incorreta.' },
      comment: { type: 'string', nullable: true, maxLength: 2000 },
    },
  },
  ReviewChanges: {
    type: 'object',
    properties: {
      incorrect: { type: 'boolean' },
      comment: { type: 'string', nullable: true, maxLength: 2000 },
    },
  },
  Review: {
    type: 'object',
    properties: {
      id: uuid,
      decisionId: uuid,
      analyst: { type: 'object', properties: { name: { type: 'string' }, email: { type: 'string', format: 'email' } } },
      incorrect: { type: 'boolean' },
      comment: { type: 'string', nullable: true },
      reviewedAt: timestamp,
      updatedAt: { ...timestamp, nullable: true },
    },
  },
  Health: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['ok', 'unavailable'] },
      store: { type: 'string', enum: ['sql', 'memory'] },
      receiver: { type: 'string', enum: ['enabled', 'disabled'] },
      reason: { type: 'string', nullable: true },
    },
  },
  Error: {
    type: 'object',
    properties: {
      error: { type: 'string', example: 'invalid_request' },
      message: { type: 'string' },
      invalid_fields: {
        type: 'array',
        items: { type: 'object', properties: { field: { type: 'string' }, reason: { type: 'string' } } },
      },
    },
  },
};

const responses = {
  InvalidRequest: {
    description: 'Parâmetro, campo ou corpo inválido.',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/Error' },
        example: {
          error: 'invalid_request',
          message: 'Campos ausentes ou em formato incorreto.',
          invalid_fields: [{ field: 'incorrect', reason: 'deve ser true ou false' }],
        },
      },
    },
  },
  NotFound: {
    description: 'Recurso não encontrado.',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/Error' },
        example: { error: 'not_found', message: 'Decisão não encontrada.' },
      },
    },
  },
};

/** Junta os paths das features; a mesma rota pode vir de features diferentes, com métodos diferentes. */
function mergePaths(featurePaths: readonly Record<string, unknown>[]): Record<string, PathItem> {
  const merged: Record<string, PathItem> = {};
  for (const paths of featurePaths) {
    for (const [path, item] of Object.entries(paths)) {
      merged[path] = { ...merged[path], ...(item as PathItem) };
    }
  }
  return merged;
}

export function buildOpenApiDocument(featurePaths: readonly Record<string, unknown>[]) {
  return {
    openapi: '3.0.3',
    info: {
      title: 'Argos decisions-service',
      version: '0.1.0',
      description:
        'Histórico de decisões de fraude do Argos e revisões feitas por analistas. As decisões nascem do evento `TransactionScored`, descrito em [/docs/events](/docs/events); o CRUD completo é o de revisões.',
    },
    tags: [
      { name: 'Decisões', description: 'Consulta ao histórico, somente leitura.' },
      { name: 'Revisões', description: 'Create, read, update e delete das revisões de um analista.' },
      { name: 'Saúde' },
    ],
    paths: mergePaths(featurePaths),
    components: { schemas, responses },
  };
}
