import type { GmailCredentials } from '../features/notify-fraud/index.js';

type Env = Readonly<Record<string, string | undefined>>;

export type StoreConfig = { readonly kind: 'sql'; readonly connectionString: string } | { readonly kind: 'memory' };

export interface ServiceBusConfig {
  readonly connectionString: string;
  readonly topicName: string;
  readonly subscriptionName: string;
}

export interface ServiceConfig {
  readonly port: number;
  readonly store: StoreConfig;
  /** null quando as variáveis do Service Bus não foram definidas: a API sobe sem o receptor. */
  readonly serviceBus: ServiceBusConfig | null;
  readonly gmail: GmailCredentials | null;
  readonly recipients: string[];
}

export class ServiceConfigError extends Error {
  constructor(readonly problems: string[]) {
    super(`Configuração inválida do decisions-service:\n- ${problems.join('\n- ')}`);
    this.name = 'ServiceConfigError';
  }
}

export const DEFAULT_PORT = 3002;
const GMAIL_VARIABLES = ['GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN', 'GMAIL_SENDER'] as const;
const SERVICE_BUS_VARIABLES = ['SERVICEBUS_CONNECTION', 'SERVICEBUS_TOPIC_NAME', 'SERVICEBUS_SUBSCRIPTION_NAME'] as const;
const EMAIL_PATTERN = /^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]+$/;

function value(env: Env, name: string): string | undefined {
  const raw = env[name]?.trim();
  return raw ? raw : undefined;
}

function readPort(env: Env, problems: string[]): number {
  const raw = value(env, 'PORT');
  if (raw === undefined) return DEFAULT_PORT;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    problems.push(`PORT deve ser um inteiro entre 1 e 65535 (recebido "${raw}").`);
    return DEFAULT_PORT;
  }
  return port;
}

/**
 * O armazenamento em memória só existe se for pedido por DECISION_STORE=memory
 * e nunca em produção. A ausência de SQL_CONNECTION_STRING é um erro, não um
 * motivo para cair em memória sem avisar.
 */
function readStore(env: Env, problems: string[]): StoreConfig {
  const kind = value(env, 'DECISION_STORE') ?? 'sql';
  if (kind === 'memory') {
    if (value(env, 'NODE_ENV') === 'production') {
      problems.push('DECISION_STORE=memory é só para desenvolvimento e não pode ser usado com NODE_ENV=production.');
    }
    return { kind: 'memory' };
  }
  if (kind !== 'sql') {
    problems.push(`DECISION_STORE deve ser "sql" ou "memory" (recebido "${kind}").`);
    return { kind: 'memory' };
  }
  const connectionString = value(env, 'SQL_CONNECTION_STRING');
  if (!connectionString) {
    problems.push('SQL_CONNECTION_STRING é obrigatória (ou use DECISION_STORE=memory, só em desenvolvimento).');
    return { kind: 'memory' };
  }
  return { kind: 'sql', connectionString };
}

function readServiceBus(env: Env, store: StoreConfig, problems: string[]): ServiceBusConfig | null {
  const present = SERVICE_BUS_VARIABLES.filter((name) => value(env, name) !== undefined);
  if (present.length === 0) return null;
  if (present.length < SERVICE_BUS_VARIABLES.length) {
    const missing = SERVICE_BUS_VARIABLES.filter((name) => !present.includes(name));
    problems.push(`Configuração do Service Bus incompleta; faltam: ${missing.join(', ')}.`);
    return null;
  }
  if (store.kind === 'memory') {
    problems.push('O receptor do Service Bus exige DECISION_STORE=sql: mensagens concluídas não podem ir para a memória.');
    return null;
  }
  return {
    connectionString: value(env, 'SERVICEBUS_CONNECTION')!,
    topicName: value(env, 'SERVICEBUS_TOPIC_NAME')!,
    subscriptionName: value(env, 'SERVICEBUS_SUBSCRIPTION_NAME')!,
  };
}

function readGmail(env: Env, problems: string[]): GmailCredentials | null {
  const present = GMAIL_VARIABLES.filter((name) => value(env, name) !== undefined);
  if (present.length === 0) return null;
  if (present.length < GMAIL_VARIABLES.length) {
    const missing = GMAIL_VARIABLES.filter((name) => !present.includes(name));
    problems.push(`Credenciais do Gmail incompletas; faltam: ${missing.join(', ')}.`);
    return null;
  }
  return {
    clientId: value(env, 'GMAIL_CLIENT_ID')!,
    clientSecret: value(env, 'GMAIL_CLIENT_SECRET')!,
    refreshToken: value(env, 'GMAIL_REFRESH_TOKEN')!,
    sender: value(env, 'GMAIL_SENDER')!,
  };
}

function readRecipients(env: Env, problems: string[]): string[] {
  const recipients = (value(env, 'FRAUD_ALERT_RECIPIENTS') ?? '')
    .split(',')
    .map((address) => address.trim())
    .filter((address) => address.length > 0);
  const invalid = recipients.filter((address) => !EMAIL_PATTERN.test(address));
  if (invalid.length > 0) problems.push(`FRAUD_ALERT_RECIPIENTS contém endereço inválido: ${invalid.join(', ')}.`);
  return recipients;
}

export function readServiceConfig(env: Env): ServiceConfig {
  const problems: string[] = [];
  const port = readPort(env, problems);
  const store = readStore(env, problems);
  const serviceBus = readServiceBus(env, store, problems);
  const gmail = readGmail(env, problems);
  const recipients = readRecipients(env, problems);
  if (gmail && recipients.length === 0) {
    problems.push('FRAUD_ALERT_RECIPIENTS é obrigatória quando as credenciais do Gmail estão configuradas.');
  }
  if (gmail && !EMAIL_PATTERN.test(gmail.sender)) problems.push('GMAIL_SENDER deve ser um endereço de e-mail.');

  if (problems.length > 0) throw new ServiceConfigError(problems);
  return { port, store, serviceBus, gmail, recipients };
}
