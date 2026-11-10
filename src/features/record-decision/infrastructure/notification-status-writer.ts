export type FinalNotificationStatus = 'enviada' | 'falhou';
export type NotificationChannel = 'gmail' | 'log';

export interface NotificationStatusUpdate {
  readonly status: FinalNotificationStatus;
  readonly channel: NotificationChannel;
  readonly error: string | null;
  readonly updatedAt: Date;
}

/**
 * Atualiza `notificacao_status` de uma decisão que ainda está `pendente`.
 * Devolve false quando a decisão não existe ou já saiu de `pendente`.
 */
export interface NotificationStatusWriter {
  updateNotificationStatus(transactionId: string, update: NotificationStatusUpdate): Promise<boolean>;
}

export const MAX_NOTIFICATION_ERROR_LENGTH = 500;
