// SPDX-License-Identifier: AGPL-3.0
/**
 * Copio Handoff Cryptographic Primitives (CPO-090 / ADR 0002)
 * 
 * Provides WebCrypto-based:
 * - Ephemeral ECDH key generation on NIST curve P-256 (secp256r1)
 * - Raw SPKI/uncompressed public key export and import
 * - Shared secret derivation and AES-GCM-256 key establishment
 * - Authenticated payload encryption and decryption with 12-byte random IVs
 * - Safe URL-friendly Base64 encoding/decoding for arbitrary buffers
 */

const CRYPTO_CURVE = 'P-256';
const KEY_ALGO = { name: 'ECDH', namedCurve: CRYPTO_CURVE };
const DERIVED_ALGO = { name: 'AES-GCM', length: 256 };
const IV_LENGTH_BYTES = 12;

/**
 * Encodes an ArrayBuffer or Uint8Array into a URL-safe Base64 string.
 * @param {Uint8Array|ArrayBuffer} bytes
 * @returns {string}
 */
export function bytesToBase64Url(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  const chunkSize = 0x8000; // 32768
  for (let i = 0; i < u8.length; i += chunkSize) {
    const chunk = u8.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }
  const b64 = globalThis.btoa(binary);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decodes a URL-safe Base64 string into a Uint8Array.
 * @param {string} b64url
 * @returns {Uint8Array}
 */
export function base64UrlToBytes(b64url) {
  if (typeof b64url !== 'string') {
    throw new TypeError('Expected string for base64url decoding');
  }
  let b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4 !== 0) {
    b64 += '=';
  }
  const binary = globalThis.atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encodes a UTF-8 string into URL-safe Base64.
 * @param {string} str
 * @returns {string}
 */
export function utf8ToBase64Url(str) {
  const bytes = new TextEncoder().encode(str);
  return bytesToBase64Url(bytes);
}

/**
 * Decodes a URL-safe Base64 string into a UTF-8 string.
 * @param {string} b64url
 * @returns {string}
 */
export function base64UrlToUtf8(b64url) {
  const bytes = base64UrlToBytes(b64url);
  return new TextDecoder().decode(bytes);
}

/**
 * Generates an ephemeral ECDH keypair (P-256).
 * @returns {Promise<CryptoKeyPair>}
 */
export async function generateEcdhKeyPair() {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('WebCrypto API (crypto.subtle) is not available');
  }
  return await subtle.generateKey(
    KEY_ALGO,
    true, // extractable public key
    ['deriveKey', 'deriveBits']
  );
}

/**
 * Exports an ECDH public key to a raw uncompressed point encoded as Base64URL.
 * @param {CryptoKey} publicKey
 * @returns {Promise<string>}
 */
export async function exportPublicKey(publicKey) {
  const subtle = globalThis.crypto.subtle;
  const raw = await subtle.exportKey('raw', publicKey);
  return bytesToBase64Url(new Uint8Array(raw));
}

/**
 * Imports an ECDH public key from a Base64URL-encoded raw uncompressed point.
 * @param {string} b64url
 * @returns {Promise<CryptoKey>}
 */
export async function importPublicKey(b64url) {
  const subtle = globalThis.crypto.subtle;
  const rawBytes = base64UrlToBytes(b64url);
  return await subtle.importKey(
    'raw',
    /** @type {BufferSource} */ (rawBytes),
    KEY_ALGO,
    false,
    []
  );
}

/**
 * Derives a 256-bit AES-GCM shared key from a local private key and foreign public key.
 * @param {CryptoKey} privateKey - Local ECDH private key
 * @param {CryptoKey} foreignPublicKey - Remote peer ECDH public key
 * @returns {Promise<CryptoKey>} Derived AES-GCM CryptoKey
 */
export async function deriveSharedKey(privateKey, foreignPublicKey) {
  const subtle = globalThis.crypto.subtle;
  return await subtle.deriveKey(
    { name: 'ECDH', public: foreignPublicKey },
    privateKey,
    DERIVED_ALGO,
    false, // derived key is non-extractable
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts arbitrary binary data, object, or string using AES-256-GCM.
 * @param {CryptoKey} aesKey
 * @param {Uint8Array|ArrayBuffer|string|Object} plaintext
 * @returns {Promise<{ iv: string, ciphertext: string }>}
 */
export async function encryptPayload(aesKey, plaintext) {
  const subtle = globalThis.crypto.subtle;
  let dataBytes;
  if (typeof plaintext === 'string') {
    dataBytes = new TextEncoder().encode(plaintext);
  } else if (plaintext instanceof Uint8Array) {
    dataBytes = plaintext;
  } else if (plaintext instanceof ArrayBuffer) {
    dataBytes = new Uint8Array(plaintext);
  } else {
    dataBytes = new TextEncoder().encode(JSON.stringify(plaintext));
  }

  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));
  const encrypted = await subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    /** @type {BufferSource} */ (dataBytes)
  );

  return {
    iv: bytesToBase64Url(iv),
    ciphertext: bytesToBase64Url(new Uint8Array(encrypted)),
  };
}

/**
 * Decrypts AES-256-GCM ciphertext using the given IV and shared key.
 * @param {CryptoKey} aesKey
 * @param {string|Uint8Array} iv
 * @param {string|Uint8Array} ciphertext
 * @returns {Promise<Uint8Array>} Decrypted bytes
 */
export async function decryptPayload(aesKey, iv, ciphertext) {
  const subtle = globalThis.crypto.subtle;
  const ivBytes = typeof iv === 'string' ? base64UrlToBytes(iv) : iv;
  const cipherBytes = typeof ciphertext === 'string' ? base64UrlToBytes(ciphertext) : ciphertext;

  const decrypted = await subtle.decrypt(
    { name: 'AES-GCM', iv: /** @type {BufferSource} */ (ivBytes) },
    aesKey,
    /** @type {BufferSource} */ (cipherBytes)
  );

  return new Uint8Array(decrypted);
}

/**
 * Decrypts AES-256-GCM ciphertext and parses the result as a UTF-8 string or JSON.
 * @param {CryptoKey} aesKey
 * @param {string|Uint8Array} iv
 * @param {string|Uint8Array} ciphertext
 * @returns {Promise<any>}
 */
export async function decryptJsonPayload(aesKey, iv, ciphertext) {
  const bytes = await decryptPayload(aesKey, iv, ciphertext);
  const text = new TextDecoder().decode(bytes);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
