export type StoreKind = 'sql' | 'memory';

export interface HealthStatus {
  readonly status: 'ok' | 'unavailable';
  readonly store: StoreKind;
  readonly receiver: 'enabled' | 'disabled';
  readonly reason: string | null;
}
