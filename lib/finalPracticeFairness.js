import {sha256Hex} from './practiceFairDice.js';
const encoder=new TextEncoder();
export const dartTables={easy:[[.5,.8,1.2,1.5,2.7,8.5],[34,26,18,12,7,3]],medium:[[.4,.6,1.3,3.1,6,16],[35,25,18,12,7,3]],hard:[[.2,.5,2.5,3.6,8.8,63],[38,24,17,11,7,3]],expert:[[.1,.5,4.8,9.6,42,500],[40,25,16,10,7,2]]};
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export async function finalSample(seed,client,game,step,bound){
 if(!/^[a-f0-9]{64}$/.test(seed)||typeof client!=='string'||!client.length||client.length>128||!Number.isInteger(step)||step<0||!Number.isInteger(bound)||bound<1||bound>100)throw Error('Invalid proof inputs');
 const key=await crypto.subtle.importKey('raw',encoder.encode(seed),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 for(let attempt=0;attempt<64;attempt++){
  const mac=new DataView(await crypto.subtle.sign('HMAC',key,encoder.encode(`final-v1:${game}:${client}:${step}:${attempt}`)));const n=mac.getUint32(0,false);
  if(n<Math.floor(4294967296/bound)*bound)return n%bound;
 }throw Error('Sampling failed');
}
export async function finalCard(seed,client,step){const n=await finalSample(seed,client,'hilo',step,52);return {rank:Math.floor(n/4)+1,suit:n%4};}
export async function towerLayout(seed,client,difficulty){
 if(!['easy','hard'].includes(difficulty))throw Error('Invalid difficulty');
 const rows=[];for(let level=0;level<9;level++){const tiles=[0,1,2],count=difficulty==='easy'?1:2;
  for(let i=0;i<count;i++){const j=i+await finalSample(seed,client,'towers',level*3+i,3-i);[tiles[i],tiles[j]]=[tiles[j],tiles[i]];}rows.push(tiles.slice(0,count));
 }return rows;
}
export async function verifyFinalRound(commit,state){
 try{
  if(!commit||!state||state.phase!=='ended'||commit.roundId!==state.roundId||commit.game!==state.game||!['darts','dicezone','hilo','towers'].includes(state.game)||commit.algorithm!=='hmac-sha256-final-v1'||state.algorithm!==commit.algorithm||commit.practiceOnly!==true||state.practiceOnly!==true||!commit.clientSeed||commit.clientSeed!==state.clientSeed||commit.serverSeedHash!==state.serverSeedHash||!equal(commit.options,state.options)||await sha256Hex(state.serverSeed)!==commit.serverSeedHash||!Array.isArray(state.history)||!Number.isInteger(state.version))return false;
  const {game,serverSeed:seed,clientSeed:client,history,options,outcome,endReason}=state;
  if(state.version!==(['darts','dicezone'].includes(game)?1:history.length+(endReason==='stopped'?2:1)))return false;
  if(game==='darts'){
   if(!dartTables[options.difficulty]||Object.keys(options).length!==1)return false;
   const [mult,weights]=dartTables[options.difficulty],n=await finalSample(seed,client,game,0,100);let total=0,zone=0;
   while(zone<weights.length){total+=weights[zone];if(n<total)break;zone++;}
   return history.length===0&&endReason==='completed'&&Object.keys(outcome).length===2&&outcome.zone===zone&&outcome.multiplier===mult[zone];
  }
  if(game==='dicezone'){
   if(Object.keys(options).length!==2||!Number.isInteger(options.start)||!Number.isInteger(options.end)||options.start<1||options.end>100||options.start>options.end)return false;
   const roll=1+await finalSample(seed,client,game,0,100);
   return history.length===0&&endReason==='completed'&&Object.keys(outcome).length===2&&outcome.roll===roll&&outcome.won===(roll>=options.start&&roll<=options.end);
  }
  let lost=false;
  if(game==='towers'){
   const layout=await towerLayout(seed,client,options.difficulty);if(Object.keys(options).length!==1||!equal(layout,state.layout)||history.length>9||outcome!==null)return false;
   for(let i=0;i<history.length;i++){const h=history[i];if(lost||Object.keys(h).length!==2||!Number.isInteger(h.tile)||h.tile<0||h.tile>2||h.safe!==!layout[i].includes(h.tile))return false;lost=!h.safe;}
  }else{
   if(Object.keys(options).length||history.length>50)return false;let card=await finalCard(seed,client,0);
   for(let i=0;i<history.length;i++){const h=history[i],next=await finalCard(seed,client,i+1);
    if(lost||Object.keys(h).length!==3||!['higherOrSame','lowerOrSame','same'].includes(h.choice)||h.card.rank!==next.rank||h.card.suit!==next.suit||Object.keys(h.card).length!==2)return false;
    const won=h.choice==='same'?next.rank===card.rank:h.choice==='higherOrSame'?next.rank>=card.rank:next.rank<=card.rank;
    if(h.won!==won)return false;lost=!won;card=next;
   }if(outcome.rank!==card.rank||outcome.suit!==card.suit||Object.keys(outcome).length!==2)return false;
  }
  return endReason==='lost'?lost:endReason==='cleared'?!lost&&history.length===(game==='towers'?9:50):endReason==='stopped'&&!lost&&history.length<(game==='towers'?9:50);
 }catch{return false;}
}
