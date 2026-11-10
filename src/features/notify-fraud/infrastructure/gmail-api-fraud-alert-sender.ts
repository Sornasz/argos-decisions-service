import type { FraudAlertSender } from '../application/ports/fraud-alert-sender.js';
import type { FraudAlertMessage } from '../domain/fraud-alert.js';
import { buildMimeMessage, toBase64Url } from './mime-message.js';

export interface GmailCredentials {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly refreshToken: string;
  readonly sender: string;
}

export class FraudAlertDeliveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FraudAlertDeliveryError';
  }
}

type Fetch = typeof fetch;

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const SEND_ENDPOINT = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
const REQUEST_TIMEOUT_MS = 10_000;
const TOKEN_EXPIRY_MARGIN_MS = 60_000;

/**
 * Envia o alerta pela Gmail API com OAuth2 (refresh token). As mensagens de
 * erro levam só o status HTTP, porque vão para o banco e para o log.
 */
export class GmailApiFraudAlertSender implements FraudAlertSender {
  readonly channel = 'gmail' as const;
  private accessToken: { value: string; expiresAt: number } | null = null;

  constructor(
    private readonly credentials: GmailCredentials,
    private readonly recipients: readonly string[],
    private readonly fetchImpl: Fetch = fetch,
    private readonly nowMs: () => number = Date.now,
  ) {}

  async send(message: FraudAlertMessage): Promise<void> {
    const token = await this.token();
    const raw = toBase64Url(
      buildMimeMessage({ from: this.credentials.sender, to: this.recipients, subject: message.subject, body: message.body }),
    );
    const response = await this.fetchImpl(SEND_ENDPOINT, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ raw }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (response.status === 401) this.accessToken = null;
    if (!response.ok) {
      throw new FraudAlertDeliveryError(`Gmail API respondeu HTTP ${response.status} ao enviar o alerta.`);
    }
  }

  private async token(): Promise<string> {
    if (this.accessToken && this.accessToken.expiresAt > this.nowMs()) return this.accessToken.value;

    const response = await this.fetchImpl(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.credentials.clientId,
        client_secret: this.credentials.clientSecret,
        refresh_token: this.credentials.refreshToken,
        grant_type: 'refresh_token',
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new FraudAlertDeliveryError(`Renovação do token OAuth2 do Gmail respondeu HTTP ${response.status}.`);
    }
    const body = (await response.json()) as { access_token?: unknown; expires_in?: unknown };
    if (typeof body.access_token !== 'string') {
      throw new FraudAlertDeliveryError('Resposta de token OAuth2 do Gmail sem access_token.');
    }
    const lifetimeMs = typeof body.expires_in === 'number' ? body.expires_in * 1000 : 0;
    this.accessToken = { value: body.access_token, expiresAt: this.nowMs() + lifetimeMs - TOKEN_EXPIRY_MARGIN_MS };
    return body.access_token;
  }
}
