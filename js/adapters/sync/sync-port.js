/**
 * SyncPort (Hexagonal Architecture Driven Outbound Port CPO-045)
 *
 * Defines the contract for P2P / WebRTC synchronization.
 */
export class SyncPort {
  /**
   * Initializes or links a P2P sync session.
   * @param {Object} [_options]
   * @returns {Promise<any>}
   */
  async connect(_options = {}) {
    throw new Error('SyncPort.connect() must be implemented by adapter');
  }

  /**
   * Disconnects or closes the sync session.
   * @returns {Promise<void>}
   */
  async disconnect() {
    throw new Error('SyncPort.disconnect() must be implemented by adapter');
  }
}
