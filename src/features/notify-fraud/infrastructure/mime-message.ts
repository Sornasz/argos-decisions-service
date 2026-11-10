export interface PlainTextEmail {
  readonly from: string;
  readonly to: readonly string[];
  readonly subject: string;
  readonly body: string;
}

/** Remove quebras de linha para impedir injeção de cabeçalhos. */
function headerValue(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

/** Codificação RFC 2047, necessária para acentos no assunto. */
function encodedWord(value: string): string {
  return `=?UTF-8?B?${Buffer.from(headerValue(value), 'utf8').toString('base64')}?=`;
}

function wrapBase64(value: string): string {
  return value.match(/.{1,76}/g)?.join('\r\n') ?? '';
}

export function buildMimeMessage(email: PlainTextEmail): string {
  return [
    `From: ${headerValue(email.from)}`,
    `To: ${email.to.map(headerValue).join(', ')}`,
    `Subject: ${encodedWord(email.subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    wrapBase64(Buffer.from(email.body, 'utf8').toString('base64')),
  ].join('\r\n');
}

export function toBase64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}
