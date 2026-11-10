export const deleteReviewPaths = {
  '/reviews/{id}': {
    delete: {
      tags: ['Revisões'],
      summary: 'Remove uma revisão',
      description:
        'A decisão volta a refletir o veredito da revisão mais recente que sobrou, ou deixa de estar marcada como incorreta se não restar nenhuma. Tudo na mesma transação.',
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
      responses: {
        '204': { description: 'Revisão removida.' },
        '400': { $ref: '#/components/responses/InvalidRequest' },
        '404': { $ref: '#/components/responses/NotFound' },
      },
    },
  },
};
