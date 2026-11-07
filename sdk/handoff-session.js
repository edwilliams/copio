// SPDX-License-Identifier: AGPL-3.0
/**
 * Copio SDK - Phone-to-Desktop Handoff Session (CPO-090 / ADR 0002)
 */

export {
  HandoffSession,
  LoopbackTransport,
  randomHandoffId,
  encodeSessionToken,
  decodeSessionToken,
  buildHandoffUrl,
  parseHandoffUrl,
  HANDOFF_DEFAULT_CHUNK_SIZE,
  HANDOFF_DEFAULT_TTL_MS,
} from '../js/services/handoff-session.js';

export {
  generateEcdhKeyPair,
  exportPublicKey,
  importPublicKey,
  deriveSharedKey,
  encryptPayload,
  decryptPayload,
} from '../js/services/handoff-crypto.js';
