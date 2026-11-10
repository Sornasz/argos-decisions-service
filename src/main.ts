import { fileURLToPath } from 'node:url';
import { readServiceConfig } from './bootstrap/config.js';
import { createApp } from './bootstrap/server.js';
import { createCreateReviewFeature } from './features/create-review/index.js';
import { createDecisionMetricsFeature } from './features/decision-metrics/index.js';
import { createDeleteReviewFeature } from './features/delete-review/index.js';
import { createGetDecisionFeature } from './features/get-decision/index.js';
import { createHealthCheckFeature } from './features/health-check/index.js';
import { createListDecisionsFeature } from './features/list-decisions/index.js';
import { createListReviewsFeature } from './features/list-reviews/index.js';
import { createNotifyFraudFeature, type NotifyFraudFeature } from './features/notify-fraud/index.js';
import { createRecordDecisionFeature } from './features/record-decision/index.js';
import { createUpdateReviewFeature } from './features/update-review/index.js';
import { MemoryDatabase, lazySqlPool, type Persistence } from './shared/index.js';

const config = readServiceConfig(process.env);

const persistence: Persistence =
  config.store.kind === 'sql'
    ? { kind: 'sql', pool: lazySqlPool(config.store.connectionString) }
    : { kind: 'memory', database: new MemoryDatabase() };

if (persistence.kind === 'memory') {
  console.warn(
    JSON.stringify({
      event: 'memory_store_enabled',
      message: 'DECISION_STORE=memory: os dados somem ao reiniciar. Uso restrito a desenvolvimento.',
    }),
  );
}

// As duas features dependem uma da outra em tempo de execução: o record-decision
// aciona o alerta e o notify-fraud grava o status pela API do record-decision.
let notifyFraud: NotifyFraudFeature | undefined;

const recordDecision = createRecordDecisionFeature({
  persistence,
  fraudAlert: { decisionDenied: (decision) => notifyFraud!.handleDeniedDecision(decision) },
});

notifyFraud = createNotifyFraudFeature({
  statusWriter: recordDecision.notificationStatusWriter,
  gmail: config.gmail,
  recipients: config.recipients,
});

const app = createApp({
  asyncApiFile: fileURLToPath(new URL('../asyncapi.yaml', import.meta.url)),
  features: [
    createListDecisionsFeature({ persistence }),
    createDecisionMetricsFeature({ persistence }),
    createGetDecisionFeature({ persistence }),
    createCreateReviewFeature({ persistence }),
    createListReviewsFeature({ persistence }),
    createUpdateReviewFeature({ persistence }),
    createDeleteReviewFeature({ persistence }),
    createHealthCheckFeature({ persistence, receiverEnabled: config.serviceBus !== null }),
  ],
});

const receiver = config.serviceBus ? recordDecision.startReceiver(config.serviceBus) : null;

const server = app.listen(config.port, () => {
  console.info(
    JSON.stringify({
      event: 'decisions_service_started',
      port: config.port,
      store: config.store.kind,
      receiver: receiver ? 'enabled' : 'disabled',
      alertChannel: notifyFraud!.channel,
    }),
  );
});

async function shutdown(signal: string): Promise<void> {
  console.info(JSON.stringify({ event: 'decisions_service_stopping', signal }));
  server.close();
  await receiver?.close();
  process.exit(0);
}

process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));
