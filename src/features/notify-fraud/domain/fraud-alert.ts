export interface DeniedDecision {
  readonly transactionId: string;
  readonly amount: number;
  readonly fraudScore: number;
  readonly mcc: string;
  readonly transactionAt: Date;
}

export interface FraudAlertMessage {
  readonly subject: string;
  readonly body: string;
}

export type AlertChannel = 'gmail' | 'log';
export type NotificationStatus = 'enviada' | 'falhou';

const amountFormat = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const scoreFormat = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatUtc(date: Date): string {
  return `${date.toISOString().slice(0, 19).replace('T', ' ')} UTC`;
}

/**
 * Monta o alerta de fraude. O conteúdo é fechado: ID da transação, valor,
 * score, MCC e horário da transação. Dado de cliente, comerciante ou
 * terminal não entra no e-mail.
 */
export function composeFraudAlert(decision: DeniedDecision): FraudAlertMessage {
  return {
    subject: `Alerta de fraude: transação ${decision.transactionId} negada`,
    body: [
      'Uma transação foi negada pelo Argos por suspeita de fraude.',
      '',
      `ID da transação: ${decision.transactionId}`,
      `Valor: ${amountFormat.format(decision.amount)}`,
      `Score de fraude: ${scoreFormat.format(decision.fraudScore)}`,
      `MCC: ${decision.mcc}`,
      `Horário da transação: ${formatUtc(decision.transactionAt)}`,
      '',
    ].join('\n'),
  };
}
