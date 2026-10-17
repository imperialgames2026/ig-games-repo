/**
 * Cryptographic Randomness Utility
 * Uses Web Crypto API for true random number generation
 */

async function hashSeed(seed) {
  const encoder = new TextEncoder();
  const data = encoder.encode(seed);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateSeed() {
  return crypto.randomUUID() + Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/**
 * Generate a cryptographically secure random number between 0 and 1
 * Uses Web Crypto API instead of weak hash-based randomness
 */
function generateCryptoRandom() {
  const randomArray = new Uint32Array(1);
  crypto.getRandomValues(randomArray);
  return randomArray[0] / (0xFFFFFFFF + 1);
}

/**
 * Generate N random numbers for batch operations
 */
function generateCryptoRandoms(count) {
  const randomArray = new Uint32Array(count);
  crypto.getRandomValues(randomArray);
  return Array.from(randomArray).map(val => val / (0xFFFFFFFF + 1));
}

/**
 * Select a weighted option using crypto random
 */
function selectWeightedOption(weights, random = null) {
  const r = random !== null ? random : generateCryptoRandom();
  const symbols = Object.keys(weights);
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  const target = r * totalWeight;
  
  let cumulative = 0;
  for (const symbol of symbols) {
    cumulative += weights[symbol];
    if (target <= cumulative) return symbol;
  }
  
  return symbols[symbols.length - 1];
}

/**
 * Default house edge: 7% (93% RTP)
 * This ensures players receive 93% of wagered money back on average
 */
const HOUSE_EDGE = 0.07;

export { hashSeed, generateSeed, generateCryptoRandom, generateCryptoRandoms, selectWeightedOption, HOUSE_EDGE };