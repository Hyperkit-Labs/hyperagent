// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

// Polyfill for SIWE/crypto in jsdom
import { TextEncoder, TextDecoder } from 'util'
globalThis.TextEncoder = TextEncoder
globalThis.TextDecoder = TextDecoder

// WebCrypto polyfill for jsdom.
// jsdom runs in a separate realm from Node.js, so ArrayBuffer instances created in
// jsdom are not recognized by Node.js's webcrypto (instanceof check fails across realms).
// We wrap webcrypto.subtle to normalize all BufferSource arguments via Buffer.from().
import { webcrypto } from 'crypto'

function toNodeBuffer(value) {
  if (value == null || typeof value.byteLength !== 'number') return value
  if (Buffer.isBuffer(value)) return value
  try {
    if (ArrayBuffer.isView(value)) {
      return Buffer.from(value.buffer, value.byteOffset, value.byteLength)
    }
    return Buffer.from(value)
  } catch {
    return value
  }
}

function normalizeAlgorithm(algo) {
  if (!algo || typeof algo !== 'object') return algo
  const out = { ...algo }
  for (const key of ['iv', 'salt', 'additionalData', 'label', 'counter', 'info', 'public']) {
    if (out[key] != null && typeof out[key].byteLength === 'number') {
      out[key] = toNodeBuffer(out[key])
    }
  }
  return out
}

const realSubtle = webcrypto.subtle
const wrappedSubtle = {
  digest(algo, data) {
    return realSubtle.digest(algo, toNodeBuffer(data))
  },
  importKey(format, keyData, algo, extractable, usages) {
    return realSubtle.importKey(format, toNodeBuffer(keyData), algo, extractable, usages)
  },
  deriveKey(algo, baseKey, derived, extractable, usages) {
    return realSubtle.deriveKey(normalizeAlgorithm(algo), baseKey, derived, extractable, usages)
  },
  deriveBits(algo, baseKey, length) {
    return realSubtle.deriveBits(normalizeAlgorithm(algo), baseKey, length)
  },
  encrypt(algo, key, data) {
    return realSubtle.encrypt(normalizeAlgorithm(algo), key, toNodeBuffer(data))
  },
  decrypt(algo, key, data) {
    return realSubtle.decrypt(normalizeAlgorithm(algo), key, toNodeBuffer(data))
  },
  sign(algo, key, data) {
    return realSubtle.sign(algo, key, toNodeBuffer(data))
  },
  verify(algo, key, signature, data) {
    return realSubtle.verify(algo, key, toNodeBuffer(signature), toNodeBuffer(data))
  },
  generateKey: realSubtle.generateKey.bind(realSubtle),
  exportKey: realSubtle.exportKey.bind(realSubtle),
  wrapKey: realSubtle.wrapKey.bind(realSubtle),
  unwrapKey: realSubtle.unwrapKey.bind(realSubtle),
}

const cryptoShim = {
  subtle: wrappedSubtle,
  getRandomValues: webcrypto.getRandomValues.bind(webcrypto),
  randomUUID: webcrypto.randomUUID?.bind(webcrypto),
}

Object.defineProperty(globalThis, 'crypto', {
  value: cryptoShim,
  writable: true,
  configurable: true,
})
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'crypto', {
    value: cryptoShim,
    writable: true,
    configurable: true,
  })
}
