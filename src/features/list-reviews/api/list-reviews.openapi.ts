export const listReviewsPaths = {
  '/decisions/{id}/reviews': {
    get: {
      tags: ['Revisões'],
      summary: 'Lista as revisões da decisão, da mais recente para a mais antiga',
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
          example: '3f2c9a54-6d1e-4b7a-9c58-2a4f1e0d7b11',
        },
      ],
      responses: {
        '200': {
          description: 'Revisões da decisão (lista vazia quando não houve nenhuma).',
          content: {
            'application/json': {
              schema: { type: 'object', properties: { items: { type: 'array', items: { $ref: '#/components/schemas/Review' } } } },
              example: { items: [{
  id: '9b1e6c52-0f3a-4d8e-8a47-5e2c71d3a0b4',
  decisionId: '3f2c9a54-6d1e-4b7a-9c58-2a4f1e0d7b11',
  analyst: { name: 'Eduardo Martins', email: 'eduardo.martins@example.com' },
  incorrect: true,
  comment: 'Cliente confirmou a compra por telefone.',
  reviewedAt: '2026-11-09T14:02:11.000Z',
  updatedAt: null,
}] },
            },
          },
        },
        '400': { $ref: '#/components/responses/InvalidRequest' },
        '404': { $ref: '#/components/responses/NotFound' },
      },
    },
  },
};
