import type { Response } from 'express';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export interface InvalidField {
  readonly field: string;
  readonly reason: string;
}

export function sendInvalidRequest(response: Response, invalidFields: readonly InvalidField[]): void {
  response.status(400).json({
    error: 'invalid_request',
    message: 'Campos ausentes ou em formato incorreto.',
    invalid_fields: invalidFields,
  });
}

export function sendInvalidId(response: Response, name: string): void {
  sendInvalidRequest(response, [{ field: name, reason: 'deve ser um UUID' }]);
}

export function sendNotFound(response: Response, message: string): void {
  response.status(404).json({ error: 'not_found', message });
}

export interface ReviewView {
  readonly id: string;
  readonly decisionId: string;
  readonly analyst: { readonly name: string; readonly email: string };
  readonly incorrect: boolean;
  readonly comment: string | null;
  readonly reviewedAt: Date;
  readonly updatedAt: Date | null;
}

export function reviewToJson(review: ReviewView) {
  return {
    id: review.id,
    decisionId: review.decisionId,
    analyst: { name: review.analyst.name, email: review.analyst.email },
    incorrect: review.incorrect,
    comment: review.comment,
    reviewedAt: review.reviewedAt.toISOString(),
    updatedAt: review.updatedAt?.toISOString() ?? null,
  };
}
