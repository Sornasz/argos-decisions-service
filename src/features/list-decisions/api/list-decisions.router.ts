import { Router } from 'express';
import { sendInvalidRequest } from '../../../shared/http.js';
import type { ListDecisionsUseCase } from '../application/list-decisions.use-case.js';
import type { DecisionSummary } from '../domain/decision-summary.js';

function summaryToJson(decision: DecisionSummary) {
  return {
    id: decision.id,
    transactionId: decision.transactionId,
    status: decision.status,
    fraudScore: decision.fraudScore,
    approvalThreshold: decision.approvalThreshold,
    decidedAt: decision.decidedAt.toISOString(),
    amount: decision.amount,
    mcc: decision.mcc,
    markedIncorrect: decision.markedIncorrect,
    notificationStatus: decision.notificationStatus,
  };
}

export function createListDecisionsRouter(useCase: ListDecisionsUseCase): Router {
  const router = Router();
  router.get('/decisions', async (request, response) => {
    const outcome = await useCase.execute(request.query);
    if (outcome.kind === 'invalid') {
      sendInvalidRequest(response, outcome.invalidFields);
      return;
    }
    const { page } = outcome;
    response.json({
      items: page.items.map(summaryToJson),
      page: page.page,
      pageSize: page.pageSize,
      total: page.total,
      totalPages: page.totalPages,
    });
  });
  return router;
}
