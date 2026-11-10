export const updateReviewPaths = {
  '/reviews/{id}': {
    put: {
      tags: ['Revisões'],
      summary: 'Altera uma revisão',
      description:
        'Altera o veredito e/ou o comentário. A decisão volta a refletir o veredito da revisão mais recente, na mesma transação. `comment: null` apaga o comentário.',
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          description: 'ID da revisão (UUID).',
          schema: { type: 'string', format: 'uuid' },
          example: '9b1e6c52-0f3a-4d8e-8a47-5e2c71d3a0b4',
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ReviewChanges' },
            example: { incorrect: false, comment: 'Após nova análise, a negação estava correta.' },
          },
        },
      },
      responses: {
        '200': {
          description: 'Revisão alterada.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Review' }, example: {
  id: '9b1e6c52-0f3a-4d8e-8a47-5e2c71d3a0b4',
  decisionId: '3f2c9a54-6d1e-4b7a-9c58-2a4f1e0d7b11',
  analyst: { name: 'Eduardo Martins', email: 'eduardo.martins@example.com' },
  incorrect: false,
  comment: 'Após nova análise, a negação estava correta.',
  reviewedAt: '2026-11-09T14:02:11.000Z',
  updatedAt: '2026-11-09T15:30:00.000Z',
} } },
        },
        '400': { $ref: '#/components/responses/InvalidRequest' },
        '404': { $ref: '#/components/responses/NotFound' },
      },
    },
  },
};
