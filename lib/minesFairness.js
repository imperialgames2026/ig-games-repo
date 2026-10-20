import { sha256Hex } from './practiceFairDice.js';
export async function calculateMinesBoard(seed, clientSeed, mineCount) {
 if (!/^[0-9a-f]{64}$/.test(seed) || typeof clientSeed !== 'string' || !clientSeed.length || clientSeed.length > 128 ||
  !Number.isInteger(mineCount) || mineCount < 1 || mineCount > 24) throw new TypeError('Invalid Mines proof inputs');
 const encoder = new TextEncoder();
 const key = await crypto.subtle.importKey('raw',encoder.encode(seed),{ name: 'HMAC', hash: 'SHA-256' },false,['sign']);
 const deck = Array.from({ length: 25 },(_,i) => i);
 for (let i = 0; i < mineCount; i++) {
  const bound = 25-i, limit = Math.floor(4294967296/bound)*bound;
  let accepted = false;
  for (let attempt = 0; attempt < 64; attempt++) {
   const digest = await crypto.subtle.sign('HMAC',key,encoder.encode(`mines-v1:${mineCount}:${clientSeed}:${i}:${attempt}`));
   const value = new DataView(digest).getUint32(0,false);
   if (value >= limit) continue;
   const j = i+value%bound;
   [deck[i],deck[j]] = [deck[j],deck[i]];
   accepted = true; break;
  }
  if (!accepted) throw new Error('Proof sampling failed');
 }
 return deck.slice(0,mineCount).sort((a,b) => a-b);
}
export async function verifyMinesRound(commit, state) {
 if (!commit || !state || state.phase !== 'ended' || commit.roundId !== state.roundId || commit.mineCount !== state.mineCount ||
  commit.algorithm !== 'hmac-sha256-mines-v1' || state.algorithm !== commit.algorithm || state.practiceOnly !== true || commit.practiceOnly !== true ||
  state.serverSeedHash !== commit.serverSeedHash || !commit.clientSeed || state.clientSeed !== commit.clientSeed || !/^[0-9a-f]{64}$/.test(state.serverSeed) ||
  !Number.isInteger(state.mineCount) || state.mineCount < 1 || state.mineCount > 24 ||
  typeof state.clientSeed !== 'string' || !state.clientSeed.length || state.clientSeed.length > 128 ||
  !Array.isArray(state.mines) || !Array.isArray(state.picks) || new Set(state.picks).size !== state.picks.length ||
  state.picks.some(n => !Number.isInteger(n) || n < 0 || n > 24)) return false;
 if (await sha256Hex(state.serverSeed) !== commit.serverSeedHash) return false;
 const expected = await calculateMinesBoard(state.serverSeed,state.clientSeed,state.mineCount);
 if (JSON.stringify(expected) !== JSON.stringify(state.mines)) return false;
 const hit = state.picks.filter(n => expected.includes(n));
 if (state.endReason === 'mine') return hit.length === 1 && hit[0] === state.picks.at(-1);
 if (state.endReason === 'cleared') return hit.length === 0 && state.picks.length === 25-state.mineCount;
 return state.endReason === 'stopped' && hit.length === 0 && state.picks.length < 25-state.mineCount;
}
