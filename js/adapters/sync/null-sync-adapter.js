/**
 * NullSyncAdapter (CPO-045 SyncPort fallback)
 *
 * Safe no-op adapter when synchronization is disabled or in headless environments.
 */
import { SyncPort } from './sync-port.js';

export class NullSyncAdapter extends SyncPort {
  async connect() {
    return {
      step: 'disconnected',
      peerId: null,
      destroy: () => {},
    };
  }

  async disconnect() {}
}
