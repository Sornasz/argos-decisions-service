import { describe, expect, it } from 'vitest';
import { buildMimeMessage, toBase64Url } from '../../../../src/features/notify-fraud/infrastructure/mime-message.js';

describe('buildMimeMessage', () => {
  it('codifica assunto com acento e corpo em base64 UTF-8', () => {
    const mime = buildMimeMessage({ from: 'a@exemplo.com', to: ['b@exemplo.com'], subject: 'transação', body: 'Horário: 12:00\n' });
    const [headers, body] = mime.split('\r\n\r\n');

    expect(headers).toContain('Subject: =?UTF-8?B?dHJhbnNhw6fDo28=?=');
    expect(headers).toContain('Content-Type: text/plain; charset=UTF-8');
    expect(Buffer.from(body!.replace(/\r\n/g, ''), 'base64').toString('utf8')).toBe('Horário: 12:00\n');
  });

  it('remove quebras de linha dos cabeçalhos', () => {
    const mime = buildMimeMessage({
      from: 'a@exemplo.com\r\nBcc: intruso@exemplo.com',
      to: ['b@exemplo.com'],
      subject: 'x',
      body: '',
    });

    expect(mime.split('\r\n').filter((line) => line.startsWith('Bcc:'))).toEqual([]);
  });
});

describe('toBase64Url', () => {
  it('não usa os caracteres + e /', () => {
    expect(toBase64Url('??>>')).not.toMatch(/[+/=]/);
  });
});
