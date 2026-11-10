export const createReviewPaths = {
  '/decisions/{id}/reviews': {
    post: {
      tags: ['Revisões'],
      summary: 'Cria uma revisão da decisão',
      description:
        'Registra o veredito de um analista. A decisão passa a refletir o veredito da revisão mais recente em `markedIncorrect`, na mesma transação do banco. O analista é identificado pelo e-mail.',
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
          example: '3f2c9a54-6d1e-4b7a-9c58-2a4f1e0d7b11',
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/NewReview' },
            example: {
              analyst: { name: 'Eduardo Martins', email: 'eduardo.martins@example.com' },
              incorrect: true,
              comment: 'Cliente confirmou a compra por telefone.',
            },
          },
        },
      },
      responses: {
        '201': {
          description: 'Revisão criada.',
          headers: { Location: { description: 'Caminho da revisão criada.', schema: { type: 'string' } } },
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Review' }, example: {
  id: '9b1e6c52-0f3a-4d8e-8a47-5e2c71d3a0b4',
  decisionId: '3f2c9a54-6d1e-4b7a-9c58-2a4f1e0d7b11',
  analyst: { name: 'Eduardo Martins', email: 'eduardo.martins@example.com' },
  incorrect: true,
  comment: 'Cliente confirmou a compra por telefone.',
  reviewedAt: '2026-11-09T14:02:11.000Z',
  updatedAt: null,
} } },
        },
        '400': { $ref: '#/components/responses/InvalidRequest' },
        '404': { $ref: '#/components/responses/NotFound' },
      },
    },
  },
};
