export interface StoreProbe {
  /** Rejeita quando o armazenamento não responde. */
  ping(): Promise<void>;
}
