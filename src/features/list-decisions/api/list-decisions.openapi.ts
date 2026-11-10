export const listDecisionsPaths = {
  '/decisions': {
    get: {
      tags: ['Decisões'],
      summary: 'Lista as decisões, da mais recente para a mais antiga',
      description: 'Cada página tem 20 itens. Todos os filtros são opcionais e se combinam.',
      parameters: [
        { name: 'status', in: 'query', schema: { type: 'string', enum: ['APROVADO', 'NEGADO'] }, example: 'NEGADO' },
        { name: 'from', in: 'query', description: 'Início do período (inclusive), em ISO 8601.', schema: { type: 'string' }, example: '2026-11-09' },
        { name: 'to', in: 'query', description: 'Fim do período (inclusive), em ISO 8601.', schema: { type: 'string' }, example: '2026-11-09T23:59:59Z' },
        { name: 'minScore', in: 'query', schema: { type: 'number', minimum: 0, maximum: 1 }, example: 0.6 },
        { name: 'maxScore', in: 'query', schema: { type: 'number', minimum: 0, maximum: 1 }, example: 1 },
        { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 }, example: 1 },
      ],
      responses: {
        '200': {
          description: 'Página de decisões.',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DecisionPage' },
              example: {
                items: [
                  {
                    id: '3f2c9a54-6d1e-4b7a-9c58-2a4f1e0d7b11',
                    transactionId: 'tx-1329056812',
                    status: 'NEGADO',
                    fraudScore: 0.8,
                    approvalThreshold: 0.6,
                    decidedAt: '2026-11-09T13:20:41.368Z',
                    amount: 9500,
                    mcc: '7995',
                    markedIncorrect: false,
                    notificationStatus: 'enviada',
                  },
                ],
                page: 1,
                pageSize: 20,
                total: 1,
                totalPages: 1,
              },
            },
          },
        },
        '400': { $ref: '#/components/responses/InvalidRequest' },
      },
    },
  },
};
