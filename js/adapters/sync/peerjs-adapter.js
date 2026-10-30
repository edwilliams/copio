/**
 * PeerJsAdapter (CPO-045 SyncPort implementation)
 * 
 * Implements SyncPort using PeerJS WebRTC P2P sync.
 */
import { SyncPort } from './sync-port.js';
import { SyncManager } from '../../services/sync-service.js';

export class PeerJsAdapter extends SyncPort {
  #manager = null;
  #repo = null;
  #onStateChange = null;

  /**
   * @param {Object} [repo]
   * @param {Function} [onStateChange]
   */
  constructor(repo = null, onStateChange = null) {
    super();
    this.#repo = repo;
    this.#onStateChange = onStateChange;
  }

  async connect(options = {}) {
    const repo = options.repo || this.#repo;
    const onStateChange = options.onStateChange || this.#onStateChange;
    this.#manager = new SyncManager(repo, onStateChange);
    return this.#manager;
  }

  async disconnect() {
    if (this.#manager && typeof this.#manager.destroy === 'function') {
      this.#manager.destroy();
      this.#manager = null;
    }
  }
}
