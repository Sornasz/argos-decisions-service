import { describe, expect, it } from 'vitest';
import { composeFraudAlert } from '../../../../src/features/notify-fraud/domain/fraud-alert.js';

const decision = {
  transactionId: 'tx-3330991687',
  amount: 9505.97,
  fraudScore: 1,
  mcc: '7802',
  transactionAt: new Date('2026-03-14T05:15:12Z'),
};

describe('composeFraudAlert', () => {
  it('leva ID, valor, score, MCC e horário da transação', () => {
    const message = composeFraudAlert(decision);

    expect(message.subject).toBe('Alerta de fraude: transação tx-3330991687 negada');
    expect(message.body).toBe(
      [
        'Uma transação foi negada pelo Argos por suspeita de fraude.',
        '',
        'ID da transação: tx-3330991687',
        'Valor: 9.505,97',
        'Score de fraude: 1,00',
        'MCC: 7802',
        'Horário da transação: 2026-03-14 05:15:12 UTC',
        '',
      ].join('\n'),
    );
  });

  it('não inclui nenhum outro dado além dos cinco campos', () => {
    const dataLines = composeFraudAlert(decision).body.split('\n').filter((line) => line.includes(': '));

    expect(dataLines.map((line) => line.split(': ')[0])).toEqual([
      'ID da transação',
      'Valor',
      'Score de fraude',
      'MCC',
      'Horário da transação',
    ]);
  });
});
