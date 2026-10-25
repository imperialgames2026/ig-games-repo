import { finalCard } from './finalPracticeFairness.js';

const equal = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const fail = () => { throw Error('The cards or moves changed from what this device observed. Round rejected.'); };

// Keep the longest observed prefix, including across refreshes and uncertain retries.
export async function observeRound(known,state,game,request) {
  const field = game === 'mines' ? 'picks' : 'history';
  const steps = state[field];
  if (!Array.isArray(steps) || !Number.isSafeInteger(state.version)) fail();
  const previous = known.observed?.steps || [];
  for (let i=0;i<Math.min(previous.length,steps.length);i++) if (!equal(previous[i],steps[i])) fail();
  if (state.phase === 'ended' && steps.length < previous.length) fail();
  if (request && request.roundId !== state.roundId) fail();
  if (request && ['pick','move','finish'].includes(request.action) && state.version !== request.version+1) fail();
  if (request && ['pick','move'].includes(request.action) && steps.length !== request.version) fail();
  if (request?.action === 'finish' && (state.phase!=='ended' || state.endReason!=='stopped' || steps.length!==request.version-1)) fail();
  if (request?.action === 'start' && state.version!==1) fail();
  if (request?.action === 'pick' && steps[request.version-1] !== request.cell) fail();
  if (request?.action === 'move') {
    const move = steps[request.version-1];
    if (!move || (game === 'towers' ? move.tile !== Number(request.choice) : move.choice !== request.choice)) fail();
  }
  let initialCard = known.observed?.initialCard;
  if (game === 'hilo') {
    if (state.phase === 'active' && steps.length === 0) {
      if (initialCard && !equal(initialCard,state.outcome)) fail();
      initialCard = state.outcome;
    }
    if (state.phase === 'ended' && (!initialCard || !equal(initialCard,await finalCard(state.serverSeed,state.clientSeed,0)))) fail();
    if (state.phase === 'active' && steps.length && !equal(state.outcome,steps.at(-1)?.card)) fail();
  }
  return {...known,observed:{steps:steps.length>=previous.length ? structuredClone(steps) : previous,
    version:Math.max(known.observed?.version ?? 0,state.version),...(initialCard ? {initialCard} : {})}};
}
