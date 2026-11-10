import type { StoreProbe } from '../application/ports/store-probe.js';

export const memoryStoreProbe: StoreProbe = { ping: async () => undefined };
