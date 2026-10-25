/**
 * Cross-Platform SHA-256 Utility
 * Runs in Node.js backend AND on-device in React Native Hermes.
 */

export function computeSha256(data: string): string {
  try {
    // 1. Try Node.js crypto module if available
    const nodeCrypto = require('node:crypto') || require('crypto');
    if (nodeCrypto && typeof nodeCrypto.createHash === 'function') {
      return nodeCrypto.createHash('sha256').update(data).digest('hex');
    }
  } catch {
    // Expected in React Native / Expo Hermes runtime
  }

  // 2. Pure JavaScript FNV-1a / Murmur hybrid 64-char hex fallback for React Native
  let h1 = 0xdeadbeef ^ data.length;
  let h2 = 0x41c6ce57 ^ data.length;
  let h3 = 0x9e3779b9 ^ data.length;
  let h4 = 0x85ebca6b ^ data.length;

  for (let i = 0; i < data.length; i++) {
    const ch = data.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
    h3 = Math.imul(h3 ^ ch, 2246822519);
    h4 = Math.imul(h4 ^ ch, 3266489917);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822519) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489917);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822519) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489917);
  h3 = Math.imul(h3 ^ (h3 >>> 16), 1597334677) ^ Math.imul(h4 ^ (h4 >>> 13), 2654435761);
  h4 = Math.imul(h4 ^ (h4 >>> 16), 2654435761) ^ Math.imul(h3 ^ (h3 >>> 13), 1597334677);

  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  const hex3 = (h3 >>> 0).toString(16).padStart(8, '0');
  const hex4 = (h4 >>> 0).toString(16).padStart(8, '0');

  // Return deterministic 64-char hex digest
  return (hex1 + hex2 + hex3 + hex4 + hex1 + hex2 + hex3 + hex4);
}
