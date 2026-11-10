import { describe, expect, it } from 'vitest';
import { ServiceConfigError, readServiceConfig } from '../../src/bootstrap/config.js';

const SQL = { SQL_CONNECTION_STRING: 'Server=banco;Database=argos_audit' };
const BUS = {
  SERVICEBUS_CONNECTION: 'Endpoint=sb://exemplo/',
  SERVICEBUS_TOPIC_NAME: 'transaction-scored',
  SERVICEBUS_SUBSCRIPTION_NAME: 'decision-audit',
};

function problemsOf(env: Record<string, string>): string[] {
  try {
    readServiceConfig(env);
  } catch (error) {
    if (error instanceof ServiceConfigError) return error.problems;
    throw error;
  }
  throw new Error('esperava configuração inválida');
}

describe('readServiceConfig', () => {
  it('usa a porta 3002 por padrão e lê PORT quando definida', () => {
    expect(readServiceConfig(SQL).port).toBe(3002);
    expect(readServiceConfig({ ...SQL, PORT: '8080' }).port).toBe(8080);
  });

  it('rejeita PORT inválida', () => {
    expect(problemsOf({ ...SQL, PORT: 'abc' })[0]).toContain('PORT');
    expect(problemsOf({ ...SQL, PORT: '70000' })[0]).toContain('PORT');
  });

  it('exige SQL_CONNECTION_STRING em vez de cair em memória sem avisar', () => {
    expect(problemsOf({})).toEqual([expect.stringContaining('SQL_CONNECTION_STRING é obrigatória')]);
  });

  it('só usa memória quando DECISION_STORE=memory é pedido', () => {
    expect(readServiceConfig({ DECISION_STORE: 'memory' }).store).toEqual({ kind: 'memory' });
    expect(readServiceConfig(SQL).store).toEqual({ kind: 'sql', connectionString: SQL.SQL_CONNECTION_STRING });
    expect(problemsOf({ DECISION_STORE: 'arquivo' })[0]).toContain('DECISION_STORE');
  });

  it('proíbe o armazenamento em memória em produção', () => {
    expect(problemsOf({ DECISION_STORE: 'memory', NODE_ENV: 'production' })[0]).toContain('NODE_ENV=production');
  });

  it('sobe sem o receptor quando nenhuma variável do Service Bus está definida', () => {
    expect(readServiceConfig(SQL).serviceBus).toBeNull();
  });

  it('ativa o receptor com as três variáveis e acusa as que faltam', () => {
    expect(readServiceConfig({ ...SQL, ...BUS }).serviceBus).toEqual({
      connectionString: BUS.SERVICEBUS_CONNECTION,
      topicName: 'transaction-scored',
      subscriptionName: 'decision-audit',
    });
    expect(problemsOf({ ...SQL, SERVICEBUS_CONNECTION: BUS.SERVICEBUS_CONNECTION })[0]).toContain(
      'SERVICEBUS_TOPIC_NAME, SERVICEBUS_SUBSCRIPTION_NAME',
    );
  });

  it('não deixa o receptor gravar em memória', () => {
    expect(problemsOf({ DECISION_STORE: 'memory', ...BUS })[0]).toContain('exige DECISION_STORE=sql');
  });

  it('exige destinatários quando o Gmail está configurado e rejeita credenciais pela metade', () => {
    const gmail = {
      GMAIL_CLIENT_ID: 'id',
      GMAIL_CLIENT_SECRET: 'segredo',
      GMAIL_REFRESH_TOKEN: 'token',
      GMAIL_SENDER: 'alertas@example.com',
    };
    expect(problemsOf({ ...SQL, ...gmail })[0]).toContain('FRAUD_ALERT_RECIPIENTS');
    expect(readServiceConfig({ ...SQL, ...gmail, FRAUD_ALERT_RECIPIENTS: 'a@example.com, b@example.com' }).recipients).toEqual([
      'a@example.com',
      'b@example.com',
    ]);
    expect(problemsOf({ ...SQL, GMAIL_CLIENT_ID: 'id' })[0]).toContain('Credenciais do Gmail incompletas');
  });
});
