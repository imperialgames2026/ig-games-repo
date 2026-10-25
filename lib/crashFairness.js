import {sha256Hex} from './practiceFairDice.js';
const key = round => `imperial-crash-proof:v1:${round}`;
export function rememberCrashCommitment(state,storage=localStorage) {
  if (!Number.isSafeInteger(state?.round) || !/^[a-f0-9]{64}$/.test(state.commitment)) throw Error('Invalid Crash commitment');
  const saved=JSON.parse(storage.getItem(key(state.round)) || 'null');
  if (saved && saved.commitment !== state.commitment) throw Error('The original Crash commitment changed. Round rejected.');
  if (!saved && state.phase==='betting') storage.setItem(key(state.round),JSON.stringify({round:state.round,commitment:state.commitment}));
}
export async function verifyCrashRound(proof,storage=localStorage) {
  const {round,serverSeed,crashPoint,durationMs,commitment}=proof || {};
  if (!Number.isSafeInteger(round) || round<1 || typeof serverSeed!=='string' || !/^[a-f0-9]{64}$/.test(commitment) ||
      typeof crashPoint!=='number' || !Number.isFinite(crashPoint) || crashPoint<0 || crashPoint>12000 ||
      !Number.isSafeInteger(durationMs) || durationMs<500 || durationMs>40000) throw Error('Invalid Crash proof');
  const canonical=await sha256Hex(`${serverSeed}:${crashPoint.toFixed(2)}:${durationMs}`);
  // Old queues used PostgreSQL's unscaled literal at these two boundaries.
  const legacy=(crashPoint===0 || crashPoint===12000) && await sha256Hex(`${serverSeed}:${crashPoint}:${durationMs}`)===commitment;
  if (canonical!==commitment && !legacy) throw Error('Crash commitment mismatch. Round rejected.');
  const saved=JSON.parse(storage.getItem(key(round)) || 'null');
  if (saved && saved.commitment!==commitment) throw Error('The reveal differs from the saved preflight commitment. Round rejected.');
  return {valid:true,preflightVerified:!!saved};
}
