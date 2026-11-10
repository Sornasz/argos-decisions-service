import { Router } from 'express';
import { isUuid, sendInvalidId, sendNotFound } from '../../../shared/http.js';
import type { GetDecisionUseCase } from '../application/get-decision.use-case.js';
import type { DecisionDetail } from '../domain/decision-detail.js';

function detailToJson(decision: DecisionDetail) {
  const { transaction } = decision;
  return {
    id: decision.id,
    transactionId: decision.transactionId,
    eventId: decision.eventId,
    status: decision.status,
    fraudScore: decision.fraudScore,
    approvalThreshold: decision.approvalThreshold,
    referenceIndexVersion: decision.referenceIndexVersion,
    decidedAt: decision.decidedAt.toISOString(),
    markedIncorrect: decision.markedIncorrect,
    notification: {
      status: decision.notification.status,
      channel: decision.notification.channel,
      error: decision.notification.error,
      updatedAt: decision.notification.updatedAt?.toISOString() ?? null,
    },
    featureVector: decision.featureVector,
    neighbors: decision.neighbors,
    transaction: {
      amount: transaction.amount,
      installments: transaction.installments,
      requestedAt: transaction.requestedAt.toISOString(),
      customer: transaction.customer,
      merchant: transaction.merchant,
      terminal: transaction.terminal,
      lastTransaction: transaction.lastTransaction
        ? {
            timestamp: transaction.lastTransaction.timestamp.toISOString(),
            kmFromCurrent: transaction.lastTransaction.kmFromCurrent,
          }
        : null,
    },
  };
}

export function createGetDecisionRouter(useCase: GetDecisionUseCase): Router {
  const router = Router();
  router.get('/decisions/:id', async (request, response) => {
    const id = request.params.id as string;
    if (!isUuid(id)) {
      sendInvalidId(response, 'id');
      return;
    }
    const outcome = await useCase.execute(id);
    if (outcome.kind === 'not_found') {
      sendNotFound(response, 'Decisão não encontrada.');
      return;
    }
    response.json(detailToJson(outcome.decision));
  });
  return router;
}
