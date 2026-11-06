import {initial,deck,shuffle,reduce,requireThat,log,finish} from './common.js';
// Five-card ranking, then choose the strongest five of seven. Aces are high except wheel straights.
export function rank5(cards){
 const rs=cards.map(c=>c.r===1?14:c.r).sort((a,b)=>b-a),counts=new Map();for(const r of rs)counts.set(r,(counts.get(r)||0)+1);
 const groups=[...counts].sort((a,b)=>b[1]-a[1]||b[0]-a[0]),flush=cards.every(c=>c.s===cards[0].s),unique=[...new Set(rs)];
 let straight=unique.length===5&&unique[0]-unique[4]===4?unique[0]:unique.join(',')==='14,5,4,3,2'?5:0;
 if(flush&&straight)return [8,straight];if(groups[0][1]===4)return [7,groups[0][0],groups[1][0]];
 if(groups[0][1]===3&&groups[1][1]===2)return [6,groups[0][0],groups[1][0]];if(flush)return [5,...rs];if(straight)return [4,straight];
 if(groups[0][1]===3)return [3,groups[0][0],...groups.slice(1).map(g=>g[0])];
 if(groups[0][1]===2&&groups[1][1]===2)return [2,...groups.slice(0,2).map(g=>g[0]).sort((a,b)=>b-a),groups[2][0]];
 if(groups[0][1]===2)return [1,groups[0][0],...groups.slice(1).map(g=>g[0])];return [0,...rs];
}
export function compare(a,b){for(let i=0;i<Math.max(a.length,b.length);i++){const d=(a[i]||0)-(b[i]||0);if(d)return Math.sign(d);}return 0;}
// Deuce-to-seven reverses ordinary five-card ranks, except A-2-3-4-5
// is ace-high (or an ace-high flush), never a wheel straight.
export function rank27(cards){
 const rank=rank5(cards),rs=cards.map(c=>c.r===1?14:c.r).sort((a,b)=>b-a);
 if(rs.join(',')==='14,5,4,3,2')return cards.every(c=>c.s===cards[0].s)?[5,...rs]:[0,...rs];
 return rank;
}
export function best(cards){let result=[-1];for(let a=0;a<cards.length-4;a++)for(let b=a+1;b<cards.length-3;b++)for(let c=b+1;c<cards.length-2;c++)for(let d=c+1;d<cards.length-1;d++)for(let e=d+1;e<cards.length;e++){const rank=rank5([cards[a],cards[b],cards[c],cards[d],cards[e]]);if(compare(rank,result)>0)result=rank;}return result;}
export function bestOmaha(hole,board){
 requireThat(hole.length===4&&board.length>=3&&board.length<=5,'Omaha requires four hole cards and at least three board cards.');
 let result=[-1];
 for(let a=0;a<4;a++)for(let b=a+1;b<4;b++)for(let c=0;c<board.length-2;c++)for(let d=c+1;d<board.length-1;d++)for(let e=d+1;e<board.length;e++){
  const rank=rank5([hole[a],hole[b],board[c],board[d],board[e]]);if(compare(rank,result)>0)result=rank;
 }
 return result;
}
export function raiseLimit(s,p=s.turn){
 const stackMax=s.bets[p]+s.stacks[p];if(s.betting!=='pot_limit')return stackMax;
 const call=Math.max(0,s.currentBet-s.bets[p]);
 // A short posted blind still counts as a full blind for preflop pot-limit calculations.
 const pot=s.contributions.reduce((a,b)=>a+b,0)+(s.phase==='preflop'?(s.blindShortfall||0):0);
 return Math.min(stackMax,s.bets[p]+pot+2*call);
}
export function bestLimited(hole,board){let rank=[-1];for(let a=0;a<hole.length;a++)for(let b=a+1;b<hole.length;b++){const candidate=best([hole[a],hole[b],...board]);if(compare(candidate,rank)>0)rank=candidate;}return rank;}
export const openingRequirements=['Jacks or better','Queens or better','Three of a kind','Straight','Flush','Full house','Four of a kind','Straight flush','Royal flush'];
export function canOpenProgressive(cards,level=0){
 const rank=rank5(cards),threshold=[[1,11],[1,12],[3],[4],[5],[6],[7],[8],[8,14]][level];
 requireThat(threshold,'Invalid opening requirement.');return compare(rank,threshold)>=0;
}
function variantSettings(variant){requireThat(['holdem','omaha','pineapple','crazy_pineapple','lazy_pineapple','stud5','draw5','progressive_draw','triple27'].includes(variant),'Choose a supported poker variant.');return {variant,betting:variant==='omaha'?'pot_limit':'no_limit',holeCards:variant==='omaha'?4:variant.includes('pineapple')?3:['draw5','progressive_draw','triple27'].includes(variant)?5:2};}
export function create(seed=1,players=6,variant='holdem'){requireThat([2,4,6,7,8,9].includes(players),'Choose 2, 4, 6, 7, 8 or 9 poker seats.');const s={...initial(seed),...variantSettings(variant),players,stacks:Array(players).fill(1000),dealer:players-1,scores:[],smallBlind:5,bigBlind:10};round(s);return s;}
// A tournament hand carries actual surviving stacks; table chips never touch the wallet ledger.
export function createTournamentHand(seed,{stacks,dealer,smallBlind,bigBlind,hand,variant='holdem'}){
 requireThat(Array.isArray(stacks)&&stacks.length>=2&&stacks.length<=9&&stacks.every(n=>Number.isSafeInteger(n)&&n>0),'Invalid tournament stacks.');
 requireThat(Number.isInteger(dealer)&&dealer>=0&&dealer<stacks.length,'Invalid dealer.');
 requireThat(Number.isSafeInteger(smallBlind)&&smallBlind>0&&Number.isSafeInteger(bigBlind)&&bigBlind>=smallBlind,'Invalid tournament blinds.');
 requireThat(Number.isSafeInteger(hand)&&hand>0,'Invalid hand number.');
 const s={...initial(seed),...variantSettings(variant),round:hand-1,players:stacks.length,stacks:[...stacks],dealer:(dealer+stacks.length-1)%stacks.length,scores:[],smallBlind,bigBlind,tournamentChips:true};round(s);return s;
}
function pay(s,p,n){n=Math.min(n,s.stacks[p]);s.stacks[p]-=n;s.bets[p]+=n;s.contributions[p]+=n;return n;}
function next(s,p,predicate){for(let i=1;i<=s.players;i++){const q=(p+i)%s.players;if(predicate(q))return q;}return -1;}
function round(s){
 s.round++;s.stock=shuffle(deck(),s);s.hands=Array.from({length:s.players},()=>[]);s.board=[];s.folded=s.stacks.map(v=>v===0);s.bets=Array(s.players).fill(0);s.contributions=Array(s.players).fill(0);s.acted=Array(s.players).fill(false);s.lastActBet=Array(s.players).fill(null);s.revealed=[];s.awards=[];s.pots=[];s.muck=[];s.burned=[];s.discarded=Array.from({length:s.players},()=>[]);s.discardDone=false;delete s.discardPending;delete s.streetFirst;s.phase='preflop';s.minRaise=s.bigBlind;
 s.drawCount=0;
 const live=p=>!s.folded[p];s.dealer=next(s,s.dealer,live);const count=s.folded.filter(v=>!v).length;
 if(count<2){s.scores=[...s.stacks];finish(s,'Table complete. Seat '+(s.stacks.indexOf(Math.max(...s.stacks))+1)+' wins.');return;}
 for(let k=0;k<(s.holeCards||2);k++)for(let i=1;i<=s.players;i++){const p=(s.dealer+i)%s.players;if(live(p))s.hands[p].push(s.stock.pop());}
 if(s.variant==='progressive_draw'){
  s.openingLevel=0;s.openingDeals=1;s.currentBet=0;s.phase='opening';s.turn=next(s,s.dealer,live);
  log(s,'Progressive Draw · opening bet requires '+openingRequirements[0]+'. No forced bets on unopened deals.');return;
 }
 if(s.variant==='stud5'){
  for(let p=0;p<s.players;p++){const ante=Math.min(s.smallBlind,s.stacks[p]);s.stacks[p]-=ante;s.contributions[p]+=ante;}
  const low=s.hands.map((h,p)=>p).filter(live).sort((a,b)=>{const x=s.hands[a][1],y=s.hands[b][1];return (x.r===1?14:x.r)-(y.r===1?14:y.r)||['C','D','H','S'].indexOf(x.s)-['C','D','H','S'].indexOf(y.s);})[0];
  pay(s,low,s.bigBlind);s.currentBet=s.bigBlind;s.phase='stud2';log(s,'Hand '+s.round+' · ante '+s.smallBlind+' / full bring-in '+s.bigBlind+'. No-limit five-card stud.');advance(s,low);return;
 }
 const sb=count===2?s.dealer:next(s,s.dealer,live),bb=next(s,sb,live);const posted=pay(s,sb,s.smallBlind)+pay(s,bb,s.bigBlind);s.blindShortfall=s.smallBlind+s.bigBlind-posted;s.currentBet=s.bigBlind;s.turn=next(s,bb,p=>live(p)&&s.stacks[p]>0);log(s,'Hand '+s.round+' · blinds '+s.smallBlind+' / '+s.bigBlind+'. Table chips have no cash value.');if(s.variant==='pineapple'){beginChoice(s,'discard','preflop',bb);return;}advance(s,bb);
}
function beginChoice(s,phase,resume,last=s.dealer){s.phase=phase;s.discardResume=resume;s.discardLast=last;s.discardPending=s.folded.map(v=>!v);s.turn=next(s,s.dealer,p=>s.discardPending[p]);}
function resetStreet(s){s.bets.fill(0);s.currentBet=0;s.minRaise=s.bigBlind;s.acted.fill(false);s.lastActBet.fill(null);}
function showingRank(cards){const ranks=cards.map(c=>c.r===1?14:c.r),groups=[...new Set(ranks)].map(r=>[r,ranks.filter(v=>v===r).length]).sort((a,b)=>b[1]-a[1]||b[0]-a[0]);return [groups[0][1]===4?7:groups[0][1]===3?3:groups[0][1]===2?(groups[1]?.[1]===2?2:1):0,...groups.map(g=>g[0])];}
export function settle(s){
 const active=s.folded.map((v,p)=>!v?p:-1).filter(p=>p>=0);s.awards=Array(s.players).fill(0);s.pots=[];
 if(active.length===1){s.awards[active[0]]=s.contributions.reduce((a,b)=>a+b,0);s.pots.push({kind:'uncontested',amount:s.awards[active[0]],eligible:[...active],winners:[...active]});}
 else{
  s.revealed=[...active];const ranks=Object.fromEntries(active.map(p=>[p,s.variant==='triple27'?rank27(s.hands[p]).map(v=>-v):s.variant==='omaha'?bestOmaha(s.hands[p],s.board):s.variant==='lazy_pineapple'?bestLimited(s.hands[p],s.board):best([...s.hands[p],...s.board])])),levels=[...new Set(s.contributions.filter(v=>v>0))].sort((a,b)=>a-b);let prev=0;
  for(const level of levels){const involved=s.contributions.map((v,p)=>v>=level?p:-1).filter(p=>p>=0),pot=(level-prev)*involved.length;prev=level;
   // Uncalled excess returns to its contributor.
   if(involved.length===1){s.awards[involved[0]]+=pot;s.pots.push({kind:'uncalled_return',amount:pot,eligible:[...involved],winners:[...involved]});continue;}
   const eligible=involved.filter(p=>!s.folded[p]);requireThat(eligible.length,'No eligible side-pot winner.');let winners=[eligible[0]];
   for(const p of eligible.slice(1)){const cmp=compare(ranks[p],ranks[winners[0]]);if(cmp>0)winners=[p];else if(cmp===0)winners.push(p);}
   winners.sort((a,b)=>(a-s.dealer-1+s.players)%s.players-(b-s.dealer-1+s.players)%s.players);const each=Math.floor(pot/winners.length);winners.forEach((p,i)=>s.awards[p]+=each+(i<pot%winners.length?1:0));s.pots.push({kind:s.pots.length?'side':'main',amount:pot,cap:level,eligible,winners:[...winners]});
  }
 }
 s.stacks=s.stacks.map((v,p)=>v+s.awards[p]);s.scores=[...s.stacks];s.phase='round';log(s,s.awards.map((v,p)=>v?'Seat '+(p+1)+' receives '+v:'').filter(Boolean).join(' · '));
 if(s.stacks.filter(v=>v>0).length===1)finish(s,'Seat '+(s.stacks.findIndex(v=>v>0)+1)+' wins the table.');
}
function street(s){
 if(['draw5','progressive_draw','triple27'].includes(s.variant)){
  if(s.phase==='postdraw'&&(s.variant!=='triple27'||s.drawCount===3)){settle(s);return;}
  const burn=s.stock.pop();if(burn)s.burned.push(burn);s.drawCount=(s.drawCount||0)+1;beginChoice(s,'draw','postdraw');return;
 }
 if(s.variant==='stud5'){
  const count=Number(s.phase.slice(4));if(count===5){settle(s);return;}
  const burn=s.stock.pop();if(burn)s.burned.push(burn);
  const active=[];for(let i=1;i<=s.players;i++){const p=(s.dealer+i)%s.players;if(!s.folded[p]){s.hands[p].push(s.stock.pop());active.push(p);}}
  s.phase='stud'+(count+1);resetStreet(s);s.streetFirst=active.reduce((a,b)=>compare(showingRank(s.hands[b].slice(1)),showingRank(s.hands[a].slice(1)))>0?b:a);return;
 }
 if(s.phase==='flop'&&s.variant==='crazy_pineapple'&&!s.discardDone){beginChoice(s,'discard','turn');return;}
 if(s.phase==='river'){settle(s);return;}
 s.burned.push(s.stock.pop());const n=s.phase==='preflop'?3:1;for(let i=0;i<n;i++)s.board.push(s.stock.pop());s.phase={preflop:'flop',flop:'turn',turn:'river'}[s.phase];resetStreet(s);
}
function advance(s,last){
 if(s.folded.filter(v=>!v).length===1){settle(s);return;}
 for(;;){
  const canAct=p=>!s.folded[p]&&s.stacks[p]>0,actors=s.stacks.map((_,p)=>p).filter(canAct),need=actors.filter(p=>!s.acted[p]||s.bets[p]<s.currentBet);
  // A lone player may still have to call an all-in; otherwise run the board without meaningless checks.
  if(need.length&&(actors.length>1||s.bets[actors[0]]<s.currentBet)){s.turn=next(s,last,p=>need.includes(p));return;}
  street(s);if(s.phase==='round'||s.phase==='discard'||s.phase==='draw'||s.over)return;last=s.streetFirst!==undefined?(s.streetFirst+s.players-1)%s.players:s.dealer;
 }
}
export function apply(s,a){return reduce(s,a,n=>{
 n.muck??=[];n.burned??=[];n.discarded??=Array.from({length:n.players},()=>[]);
 requireThat(!n.over,'Table finished.');if(a.type==='next'){requireThat(n.phase==='round','Finish this hand first.');round(n);return;}
 if(n.phase==='opening'){
  const p=n.turn;
  if(a.type==='call'){
   n.acted[p]=true;log(n,'Seat '+(p+1)+' passes the opening.');
   const pending=n.stacks.map((v,i)=>v>0&&!n.acted[i]?i:-1).filter(i=>i>=0);
   if(pending.length){n.turn=next(n,p,q=>pending.includes(q));return;}
   n.openingLevel=Math.min(8,n.openingLevel+1);n.openingDeals++;n.stock=shuffle(deck(),n);n.hands=Array.from({length:n.players},()=>[]);n.muck=[];n.burned=[];n.discarded=Array.from({length:n.players},()=>[]);n.acted.fill(false);
   for(let k=0;k<5;k++)for(let i=1;i<=n.players;i++){const q=(n.dealer+i)%n.players;if(n.stacks[q]>0)n.hands[q].push(n.stock.pop());}
   n.turn=next(n,n.dealer,q=>n.stacks[q]>0);log(n,'No opening bet. Deal '+n.openingDeals+' requires '+openingRequirements[n.openingLevel]+'.');return;
  }
  requireThat(a.type==='raise','Pass or make a qualifying opening bet.');requireThat(canOpenProgressive(n.hands[p],n.openingLevel),'Your hand does not meet the opening requirement.');n.phase='preflop';log(n,'Seat '+(p+1)+' opens the betting; normal draw play resumes.');n.acted.fill(false);
 }
 if(n.phase==='discard'||n.phase==='draw'){
  const p=n.turn;requireThat(n.discardPending[p],'Seat already chose.');
  if(n.phase==='discard'){
   requireThat(a.type==='discard'&&Number.isInteger(a.index)&&a.index>=0&&a.index<n.hands[p].length,'Choose one hole card to discard.');n.discarded[p].push(n.hands[p].splice(a.index,1)[0]);log(n,'Seat '+(p+1)+' discards one card.');
  }else{
   requireThat(a.type==='draw'&&Array.isArray(a.indices)&&a.indices.length<=5&&new Set(a.indices).size===a.indices.length&&a.indices.every(i=>Number.isInteger(i)&&i>=0&&i<5),'Choose up to five distinct draw cards.');
   const outgoing=a.indices.map(i=>n.hands[p][i]);
   for(const index of a.indices){if(!n.stock.length){n.stock=shuffle(n.muck,n);n.muck=[];}requireThat(n.stock.length,'Not enough draw cards.');n.hands[p][index]=n.stock.pop();}
   n.muck.push(...outgoing);n.discarded[p].push(...outgoing);log(n,'Seat '+(p+1)+(a.indices.length?' draws '+a.indices.length+' cards.':' stands pat.'));
  }
  n.discardPending[p]=false;if(n.discardPending.some(Boolean)){n.turn=next(n,p,q=>n.discardPending[q]);return;}
  const resume=n.discardResume,last=n.discardLast;delete n.discardPending;
  if(resume==='turn'){n.discardDone=true;n.phase='flop';street(n);advance(n,n.dealer);}
  else if(resume==='postdraw'){n.phase='postdraw';resetStreet(n);advance(n,n.dealer);}
  else{n.phase='preflop';advance(n,last);}return;
 }
 requireThat(['preflop','flop','turn','river','postdraw','stud2','stud3','stud4','stud5'].includes(n.phase),'No active betting round.');const p=n.turn,call=Math.max(0,n.currentBet-n.bets[p]);requireThat(!n.folded[p]&&n.stacks[p]>0,'Seat cannot act.');
 if(a.type==='fold'){n.folded[p]=true;log(n,'Seat '+(p+1)+' folds.');}
 else if(a.type==='call'){const paid=pay(n,p,call);log(n,'Seat '+(p+1)+(call?' calls '+paid+'.':' checks.'));}
 else if(a.type==='raise'){
  const to=Number(a.to),max=n.bets[p]+n.stacks[p];requireThat(Number.isSafeInteger(to)&&to>n.currentBet&&to<=max,'Choose a valid total raise amount.');
  requireThat(to<=raiseLimit(n,p),'Raise exceeds the pot-limit maximum.');
  requireThat(n.lastActBet[p]===null||n.currentBet-n.lastActBet[p]>=n.minRaise,'Betting has not reopened for this seat.');const increment=to-n.currentBet;requireThat(increment>=n.minRaise||to===max,'Raise must meet the minimum unless all-in.');
  pay(n,p,to-n.bets[p]);if(increment>=n.minRaise){n.minRaise=increment;n.acted.fill(false);}n.currentBet=to;log(n,'Seat '+(p+1)+' raises to '+to+'.');
 }else throw Error('Unknown poker action.');n.acted[p]=true;n.lastActBet[p]=n.currentBet;advance(n,p);
});}
export function bot(s){
 const p=s.turn;
 if(s.phase==='opening')return canOpenProgressive(s.hands[p],s.openingLevel)?{type:'raise',to:Math.min(s.bigBlind,s.stacks[p])}:{type:'call'};
 if(s.phase==='discard'){
  let index=0,score=-Infinity,bestRank=null;for(let i=0;i<3;i++){const kept=s.hands[p].filter((_,j)=>i!==j),rs=kept.map(c=>c.r===1?14:c.r);if(s.board.length>=3){const rank=best([...kept,...s.board]);if(!bestRank||compare(rank,bestRank)>0){bestRank=rank;index=i;}}else{const value=(rs[0]===rs[1]?10000:0)+Math.max(...rs)*15+Math.min(...rs);if(value>score){score=value;index=i;}}}
  return {type:'discard',index};
 }
 if(s.phase==='draw'&&s.variant==='triple27'){
  const cards=s.hands[p],rank=rank27(cards);if(rank[0]===0&&rank[1]<=11)return{type:'draw',indices:[]};
  const kept=new Set(),ranks=new Set();for(const {c,i} of cards.map((c,i)=>({c,i})).sort((a,b)=>(a.c.r===1?14:a.c.r)-(b.c.r===1?14:b.c.r))){const r=c.r===1?14:c.r;if(r<=8&&!ranks.has(r)){kept.add(i);ranks.add(r);}}
  if(kept.size===5)kept.delete([...kept].at(-1));return{type:'draw',indices:cards.flatMap((_,i)=>kept.has(i)?[]:[i])};
 }
 if(s.phase==='draw'){const ranks=s.hands[p].map(c=>c.r),pairs=new Set(ranks.filter(r=>ranks.filter(v=>v===r).length>=2));const keep=pairs.size?new Set(ranks.flatMap((r,i)=>pairs.has(r)?[i]:[])):new Set(s.hands[p].map((c,i)=>({i,r:c.r===1?14:c.r})).sort((a,b)=>b.r-a.r).slice(0,2).map(v=>v.i));return{type:'draw',indices:ranks.flatMap((_,i)=>keep.has(i)?[]:[i])};}
 return {type:'call'};
}
