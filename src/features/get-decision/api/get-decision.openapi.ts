export const getDecisionPaths = {
  '/decisions/{id}': {
    get: {
      tags: ['Decisões'],
      summary: 'Detalha uma decisão, com a transação, o vetor e os 5 vizinhos',
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          description: 'ID da decisão (UUID), o campo `id` de GET /decisions.',
          schema: { type: 'string', format: 'uuid' },
          example: '3f2c9a54-6d1e-4b7a-9c58-2a4f1e0d7b11',
        },
      ],
      responses: {
        '200': {
          description: 'Decisão.',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DecisionDetail' },
              example: {
                id: '3f2c9a54-6d1e-4b7a-9c58-2a4f1e0d7b11',
                transactionId: 'tx-1329056812',
                eventId: 'b2d1c8e0-3a64-4f0e-9a33-7c1e55a0d9f2',
                status: 'NEGADO',
                fraudScore: 0.8,
                approvalThreshold: 0.6,
                referenceIndexVersion: 'sha256:c4e472531de1',
                decidedAt: '2026-11-09T13:20:41.368Z',
                markedIncorrect: false,
                notification: { status: 'enviada', channel: 'gmail', error: null, updatedAt: '2026-11-09T13:20:42.010Z' },
                featureVector: [0.95, 1, 0.0, 0.13, 0.75, -1, -1, 1, 1, 0, 0.8, 0.25, 0.1, 0.05],
                neighbors: [
                  { position: 1, referenceId: 120233, distance: 0.04, label: 'fraud' },
                  { position: 2, referenceId: 884120, distance: 0.06, label: 'fraud' },
                  { position: 3, referenceId: 45012, distance: 0.07, label: 'fraud' },
                  { position: 4, referenceId: 700391, distance: 0.09, label: 'fraud' },
                  { position: 5, referenceId: 310044, distance: 0.11, label: 'legit' },
                ],
                transaction: {
                  amount: 9500,
                  installments: 12,
                  requestedAt: '2026-11-09T13:20:40Z',
                  customer: { avgAmount: 100, txCount24h: 20, knownMerchants: [] },
                  merchant: { id: 'MERC-Z', mcc: '7995', avgAmount: 50 },
                  terminal: { isOnline: true, cardPresent: false, kmFromHome: 900 },
                  lastTransaction: null,
                },
              },
            },
          },
        },
        '400': { $ref: '#/components/responses/InvalidRequest' },
        '404': { $ref: '#/components/responses/NotFound' },
      },
    },
  },
};
