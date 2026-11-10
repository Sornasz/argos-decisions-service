export const decisionMetricsPaths = {
  '/decisions/metrics': {
    get: {
      tags: ['Decisões'],
      summary: 'Volume, taxas de aprovação e negação e score médio',
      description: 'Considera todas as decisões gravadas. As taxas vão de 0 a 1; `averageScore` é null quando não há decisões.',
      responses: {
        '200': {
          description: 'Métricas agregadas.',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DecisionMetrics' },
              example: {
                total: 1481,
                approved: 1326,
                denied: 155,
                approvalRate: 0.8953,
                denialRate: 0.1047,
                averageScore: 0.1812,
                markedIncorrect: 9,
              },
            },
          },
        },
      },
    },
  },
};
