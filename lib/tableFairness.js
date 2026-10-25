import {sha256Hex} from './practiceFairDice.js';
import {saveDeviceProof} from './deviceProofStorage.js';

export const TABLE_ALGORITHM='hmac-sha256-table-v1';
const games=['blackjack','baccarat','craps','roulette'];
const encoder=new TextEncoder();
const key=(g,r)=>`imperial-table-proof:qonqemhljgxlwpghkxhn:v1:${g}:${r}`;
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const reject=message=>{const error=Error(message || 'Table fairness proof mismatch. Result rejected.');error.name='FairnessError';throw error;};
const prefix=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length<=b.length&&a.every((c,i)=>c===b[i]);
export const savedTableCommitment=(game,round,storage=localStorage)=>JSON.parse(storage.getItem(key(game,round))||'null');

export async function tableSampler(seed,game,round) {
 if(!/^[a-f0-9]{64}$/.test(seed)||!games.includes(game)||!Number.isSafeInteger(round)||round<1)reject();
 const hmac=await crypto.subtle.importKey('raw',encoder.encode(seed),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return async(step,bound)=>{
  for(let attempt=0;attempt<64;attempt++){
   const bytes=new DataView(await crypto.subtle.sign('HMAC',hmac,encoder.encode(`table-fair-v1|${game}|${round}|${step}|${attempt}`)));
   const n=bytes.getUint32(0,false);if(n<Math.floor(4294967296/bound)*bound)return n%bound;
  }reject('Proof sampling failed');
 };
}
export async function tableDeck(seed,game,round) {
 const sample=await tableSampler(seed,game,round);
 const size=game==='blackjack'?312:416;
 const deck=Array.from({length:size},(_,i)=>game==='blackjack'?i%52:i%13+1);
 for(let i=0;i<(game==='blackjack'?311:6);i++){const j=i+await sample(i,size-i);[deck[i],deck[j]]=[deck[j],deck[i]];}
 return deck;
}
export const blackjackTotal=cards=>{
 let total=0,aces=0;for(const c of cards){const rank=c%13+1;total+=rank===1?11:Math.min(rank,10);if(rank===1)aces++;}
 while(total>21&&aces>0){total-=10;aces--;}return total;
};
const reds=[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
export async function expectedTableOutcome(proof) {
 const {game,round,serverSeed}=proof,sample=await tableSampler(serverSeed,game,round);
 if(game==='roulette'){const number=await sample(0,37);return {number,color:number===0?'green':reds.includes(number)?'red':'black'};}
 if(game==='craps'){const dice=[1+await sample(0,6),1+await sample(1,6)];return {dice,total:dice[0]+dice[1]};}
 const deck=await tableDeck(serverSeed,game,round);
 if(game==='baccarat'){
  const playerCards=[deck[0],deck[2]],bankerCards=[deck[1],deck[3]],value=c=>c>=10?0:c;
  const total=cards=>cards.reduce((n,c)=>n+value(c),0)%10;
  let p=total(playerCards),b=total(bankerCards),third=null;
  if(p<8&&b<8){
   if(p<=5){playerCards.push(deck[4]);third=value(deck[4]);p=total(playerCards);}
   if(third===null?b<=5:b<=2||b===3&&third!==8||b===4&&third>=2&&third<=7||b===5&&third>=4&&third<=7||b===6&&third>=6&&third<=7){bankerCards.push(deck[third===null?4:5]);b=total(bankerCards);}
  }
  return {playerCards,bankerCards,playerTotal:p,bankerTotal:b,winner:p>b?'player':p<b?'banker':'tie'};
 }
 const plan=proof.layout;
 if(!Array.isArray(plan)||plan.length<1||plan.length>7||plan.some((p,i)=>!Number.isInteger(p.seat)||p.seat<0||p.seat>6||(i>0&&p.seat<=plan[i-1].seat)||!Number.isInteger(p.mainBet)||p.mainBet<1||p.mainBet>100||!Number.isInteger(p.pairsBet)||p.pairsBet<0||p.pairsBet>100))reject();
 const result=proof.outcome;
 if(!Array.isArray(result?.seats)||result.seats.length!==plan.length||!Array.isArray(result.dealerCards))reject();
 let index=0;const hands=plan.map(()=>[]),dealer=[];
 for(let pass=0;pass<2;pass++){hands.forEach(h=>h.push(deck[index++]));dealer.push(deck[index++]);}
 const dealerNatural=blackjackTotal(dealer)===21;
 for(let i=0;i<plan.length;i++){
  const actual=result.seats[i];if(actual.seat!==plan[i].seat||!Array.isArray(actual.playerCards)||actual.playerCards.length<2||actual.playerCards.length>22)reject();
  while(hands[i].length<actual.playerCards.length){if(dealerNatural||blackjackTotal(hands[i])>=21)reject();hands[i].push(deck[index++]);}
  if(!equal(hands[i],actual.playerCards))reject();
 }
 while(blackjackTotal(dealer)<17)dealer.push(deck[index++]);
 const dealerTotal=blackjackTotal(dealer),dealerBlackjack=dealer.length===2&&dealerTotal===21;
 const seats=plan.map((p,i)=>{
  const cards=hands[i],score=blackjackTotal(cards),natural=cards.length===2&&score===21;
  let status='lose',returned=0,pairsReturned=0;
  if(score>21)status='bust';else if(dealerBlackjack&&natural){status='push';returned=p.mainBet;}
  else if(dealerBlackjack)status='lose';else if(natural){status='blackjack';returned=Math.floor(p.mainBet*2.5);}
  else if(dealerTotal>21||score>dealerTotal){status='win';returned=p.mainBet*2;}
  else if(score===dealerTotal){status='push';returned=p.mainBet;}
  if(cards[0]%13===cards[1]%13){const a=Math.floor(cards[0]/13),b=Math.floor(cards[1]/13);pairsReturned=p.pairsBet*(a===b?26:([0,3].includes(a)===[0,3].includes(b)?13:6));}
  return {seat:p.seat,status,playerCards:cards,playerTotal:score,returned,pairsReturned};
 });
 return {dealerCards:dealer,dealerTotal,seats};
}
const checked=new Map();
export async function verifyTableRound(proof,saved) {
 if(!proof||proof.algorithm!==TABLE_ALGORITHM||proof.practiceOnly!==true||proof.phase!=='revealed'||!games.includes(proof.game)||!Number.isSafeInteger(proof.round)||proof.round<1||!/^[a-f0-9]{64}$/.test(proof.serverSeedHash)||!/^[a-f0-9]{64}$/.test(proof.serverSeed))reject();
 if(saved&&saved.hash!==proof.serverSeedHash)reject('The revealed table commitment changed. Result rejected.');
 if(saved?.layout&&!equal(saved.layout,proof.layout))reject('The Blackjack seat plan changed. Result rejected.');
 const outcome=proof.outcome;
 if(!outcome||outcome.round!==proof.round||(outcome.game!==undefined&&outcome.game!==proof.game))reject();
 if(saved?.result&&!equal(saved.result,outcome))reject('The previously displayed table result changed. Result rejected.');
 if(proof.game==='blackjack'){
  if(saved?.dealer&&!prefix(saved.dealer,outcome.dealerCards))reject('The dealer cards changed. Result rejected.');
  for(const [seat,cards] of Object.entries(saved?.cards||{}))if(!prefix(cards,outcome.seats?.find(s=>s.seat===Number(seat))?.playerCards))reject('A displayed Blackjack card changed. Result rejected.');
 }
 const fingerprint=JSON.stringify(canonical(proof));
 if(!checked.has(fingerprint)){
  if(await sha256Hex(`table-fair-v1|${proof.game}|${proof.round}|${proof.serverSeed}`)!==proof.serverSeedHash)reject();
  const expected=await expectedTableOutcome(proof);
  for(const field of Object.keys(expected))if(!equal(expected[field],outcome[field]))reject();
  if(proof.game==='craps'){
   const before=outcome.pointBefore;if(before!==null&&![4,5,6,8,9,10].includes(before))reject();
   if(saved&&Object.hasOwn(saved,'point')&&saved.point!==before)reject('The observed Craps point changed');
   const after=before===null?([4,5,6,8,9,10].includes(expected.total)?expected.total:null):(expected.total===before||expected.total===7?null:before);
   if(outcome.pointAfter!==after)reject();
  }
  checked.set(fingerprint,true);if(checked.size>64)checked.delete(checked.keys().next().value);
 }
 return {valid:true,preflightVerified:saved?.preflight===true};
}
async function acceptTableFairnessInner(state,game,storage) {
 if(state?.game!==game||!games.includes(game))reject('Game/table identity changed');
 const read=r=>JSON.parse(storage.getItem(key(game,r))||'null');
 const save=(r,v)=>saveDeviceProof(storage,key(game,r),v,`imperial-table-proof:qonqemhljgxlwpghkxhn:v1:${game}`);
 const current=state.fairness;
 if(!current){if(read(state.round))reject('The table commitment disappeared');}
 else {
  if(current.game!==game||current.round!==state.round||current.algorithm!==TABLE_ALGORITHM||current.phase!=='committed'||current.practiceOnly!==true||!/^[a-f0-9]{64}$/.test(current.serverSeedHash)||Object.hasOwn(current,'serverSeed')||Object.hasOwn(current,'outcome'))reject('Invalid or prematurely revealed table commitment');
  let saved=read(state.round);
  if(saved&&saved.hash!==current.serverSeedHash)reject('The original table commitment changed');
  const preflight=game==='blackjack'||game==='roulette'?state.phase==='betting':state.lastResult?.round!==state.round;
  saved ||= {hash:current.serverSeedHash,preflight};
  if(current.layout){if(saved.layout&&!equal(saved.layout,current.layout))reject('The seat plan changed');saved.layout=current.layout;}
  if(game==='blackjack'){
   const cards={...(saved.cards||{})};
   for(const p of state.players||[]){if(!p.cards?.length)continue;const old=cards[p.seat]||[];if(!prefix(old,p.cards)&&!prefix(p.cards,old))reject('A displayed Blackjack card changed');if(p.cards.length>=old.length)cards[p.seat]=p.cards;}
   const dealer=state.dealerCards||[];if(saved.dealer&&!prefix(saved.dealer,dealer)&&!prefix(dealer,saved.dealer))reject('A displayed dealer card changed');
   saved={...saved,cards,dealer:dealer.length>=(saved.dealer?.length||0)?dealer:saved.dealer};
  }
  if(game==='craps'){
   if(Object.hasOwn(saved,'point')&&saved.point!==state.point)reject('The observed Craps point changed');
   saved.point=state.point;
  }
  save(state.round,saved);
 }
 if(state.lastResult){const r=state.lastResult.round,saved=read(r);if(saved){if(saved.result&&!equal(saved.result,state.lastResult))reject('The displayed result changed');save(r,{...saved,result:state.lastResult});}}
 const results=[];
 for(const proof of state.fairnessHistory||[]){
  if(proof.game!==game)reject('A proof belongs to a different game');
  const saved=read(proof.round),verified=await verifyTableRound(proof,saved);
  save(proof.round,{...saved,hash:proof.serverSeedHash,result:proof.outcome,preflight:saved?.preflight===true});
  results.push({round:proof.round,...verified});
 }
 return {...state,fairnessChecks:results};
}

export async function acceptTableFairness(state,game,storage=localStorage) {
 try{return await acceptTableFairnessInner(state,game,storage);}
 catch(error){if(error.name==='FairnessError')throw error;reject('Invalid table proof or saved device record. Result rejected.');}
}
