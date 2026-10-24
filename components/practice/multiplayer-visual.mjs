import {validateOutcome} from './outcomes.mjs';
import {validAmount,validSelection} from './bet-layout.mjs';
// Translate presentation data only. No RNG, credits or wager settlement here.
export function serverPresentation(game,result){
 if(result?.game!==game||!Number.isSafeInteger(result.round)||result.round<1||result.round>999999999999)return null;
 const o={version:1,mode:'practice',roundId:`${game==='craps'?'20000000':'10000000'}-0000-4000-8000-${String(result.round).padStart(12,'0')}`,game,values:game==='craps'?result.dice:[result.number]};
 return validateOutcome(o)?Object.freeze({...o,values:Object.freeze([...o.values])}):null;
}
export function serverTarget(game,selection){
 if(!validSelection(game,selection))return null;
 return game==='roulette'&&/^\d+$/.test(selection)?'number_'+selection:selection;
}
export function serverMarkers(game,publicBets=[]){
 const totals=new Map();
 for(const b of publicBets){const s=game==='roulette'&&/^number_\d+$/.test(b.target)?b.target.slice(7):b.target;
  if(!validSelection(game,s)||!validAmount(b.units))continue;
  const amount=(totals.get(s)||0)+b.units;if(validAmount(amount))totals.set(s,amount);
 }
 return [...totals].map(([selection,amount])=>({selection,amount}));
}
