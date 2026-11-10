import { describe, expect, it } from 'vitest';
import {
  FraudAlertDeliveryError,
  GmailApiFraudAlertSender,
} from '../../../../src/features/notify-fraud/infrastructure/gmail-api-fraud-alert-sender.js';

const credentials = {
  clientId: 'client-id-de-teste',
  clientSecret: 'client-secret-de-teste',
  refreshToken: 'refresh-token-de-teste',
  sender: 'alertas@exemplo.com',
};
const message = { subject: 'Alerta de fraude: transação tx-1 negada', body: 'ID da transação: tx-1\n' };

interface Call {
  url: string;
  init: RequestInit;
}

function fakeFetch(responses: Array<{ status: number; body?: unknown }>) {
  const calls: Call[] = [];
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const next = responses.shift() ?? { status: 500 };
    return new Response(next.body === undefined ? null : JSON.stringify(next.body), { status: next.status });
  }) as typeof fetch;
  return { impl, calls };
}

function decodeRaw(call: Call): string {
  const { raw } = JSON.parse(String(call.init.body)) as { raw: string };
  return Buffer.from(raw, 'base64url').toString('utf8');
}

describe('GmailApiFraudAlertSender', () => {
  it('renova o token com o refresh token e envia a mensagem MIME para os destinatários', async () => {
    const { impl, calls } = fakeFetch([
      { status: 200, body: { access_token: 'access-1', expires_in: 3600 } },
      { status: 200, body: { id: 'msg-1' } },
    ]);
    const sender = new GmailApiFraudAlertSender(credentials, ['camila@exemplo.com', 'compliance@exemplo.com'], impl);

    await sender.send(message);

    expect(calls[0]!.url).toBe('https://oauth2.googleapis.com/token');
    const form = new URLSearchParams(String(calls[0]!.init.body));
    expect(form.get('grant_type')).toBe('refresh_token');
    expect(form.get('refresh_token')).toBe('refresh-token-de-teste');

    expect(calls[1]!.url).toBe('https://gmail.googleapis.com/gmail/v1/users/me/messages/send');
    expect((calls[1]!.init.headers as Record<string, string>).authorization).toBe('Bearer access-1');
    const mime = decodeRaw(calls[1]!);
    expect(mime).toContain('From: alertas@exemplo.com');
    expect(mime).toContain('To: camila@exemplo.com, compliance@exemplo.com');
    expect(mime).toContain(`Subject: =?UTF-8?B?${Buffer.from(message.subject).toString('base64')}?=`);
  });

  it('reaproveita o token até perto de expirar', async () => {
    let now = 0;
    const { impl, calls } = fakeFetch([
      { status: 200, body: { access_token: 'access-1', expires_in: 3600 } },
      { status: 200 },
      { status: 200 },
      { status: 200, body: { access_token: 'access-2', expires_in: 3600 } },
      { status: 200 },
    ]);
    const sender = new GmailApiFraudAlertSender(credentials, ['a@exemplo.com'], impl, () => now);

    await sender.send(message);
    await sender.send(message);
    now = 3_600_000;
    await sender.send(message);

    expect(calls.map((call) => call.url.includes('oauth2'))).toEqual([true, false, false, true, false]);
  });

  it('falha com o status HTTP, sem repassar o corpo da resposta', async () => {
    const { impl } = fakeFetch([
      { status: 200, body: { access_token: 'access-1', expires_in: 3600 } },
      { status: 403, body: { error: { message: 'detalhe interno do Google' } } },
    ]);
    const sender = new GmailApiFraudAlertSender(credentials, ['a@exemplo.com'], impl);

    const error = await sender.send(message).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(FraudAlertDeliveryError);
    expect((error as Error).message).toBe('Gmail API respondeu HTTP 403 ao enviar o alerta.');
  });

  it('falha quando a renovação do token é recusada', async () => {
    const { impl } = fakeFetch([{ status: 400, body: { error: 'invalid_grant' } }]);
    const sender = new GmailApiFraudAlertSender(credentials, ['a@exemplo.com'], impl);

    await expect(sender.send(message)).rejects.toThrow('Renovação do token OAuth2 do Gmail respondeu HTTP 400.');
  });

  it('descarta o token em cache depois de um 401', async () => {
    const { impl, calls } = fakeFetch([
      { status: 200, body: { access_token: 'access-1', expires_in: 3600 } },
      { status: 401 },
      { status: 200, body: { access_token: 'access-2', expires_in: 3600 } },
      { status: 200 },
    ]);
    const sender = new GmailApiFraudAlertSender(credentials, ['a@exemplo.com'], impl);

    await expect(sender.send(message)).rejects.toThrow('HTTP 401');
    await sender.send(message);

    expect((calls[3]!.init.headers as Record<string, string>).authorization).toBe('Bearer access-2');
  });
});
