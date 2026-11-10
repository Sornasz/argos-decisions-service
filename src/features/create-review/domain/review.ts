export interface Review {
  readonly id: string;
  readonly decisionId: string;
  readonly analyst: { readonly name: string; readonly email: string };
  readonly incorrect: boolean;
  readonly comment: string | null;
  readonly reviewedAt: Date;
  readonly updatedAt: Date | null;
}

export interface NewReview {
  readonly analyst: { readonly name: string; readonly email: string };
  readonly incorrect: boolean;
  readonly comment: string | null;
}
