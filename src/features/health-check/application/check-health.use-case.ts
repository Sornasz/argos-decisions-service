import type { HealthStatus, StoreKind } from '../domain/health-status.js';
import type { StoreProbe } from './ports/store-probe.js';

export interface CheckHealthUseCase {
  execute(): Promise<HealthStatus>;
}

export interface CheckHealthDependencies {
  readonly probe: StoreProbe;
  readonly store: StoreKind;
  readonly receiverEnabled: boolean;
}

/** O serviço só está saudável quando o armazenamento responde. */
export class CheckHealth implements CheckHealthUseCase {
  constructor(private readonly deps: CheckHealthDependencies) {}

  async execute(): Promise<HealthStatus> {
    const base = { store: this.deps.store, receiver: this.deps.receiverEnabled ? ('enabled' as const) : ('disabled' as const) };
    try {
      await this.deps.probe.ping();
      return { status: 'ok', ...base, reason: null };
    } catch (error) {
      return { status: 'unavailable', ...base, reason: error instanceof Error ? error.name : 'erro desconhecido' };
    }
  }
}
