export const healthPaths = {
  '/health': {
    get: {
      tags: ['Saúde'],
      summary: 'Estado do serviço',
      description: 'Responde 200 quando o armazenamento responde e 503 quando não. `receiver` informa se o receptor do Service Bus está ativo.',
      responses: {
        '200': {
          description: 'Saudável.',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Health' },
              example: { status: 'ok', store: 'sql', receiver: 'enabled', reason: null },
            },
          },
        },
        '503': {
          description: 'Armazenamento indisponível.',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Health' },
              example: { status: 'unavailable', store: 'sql', receiver: 'enabled', reason: 'ConnectionError' },
            },
          },
        },
      },
    },
  },
};
