import {formatChips,unitScale} from './poker-preferences.js';
import {raiseLimit,canOpenProgressive,openingRequirements} from './games/poker-core.js';
import {rouletteView} from './roulette-view.js';
export function pokerView(room,ui,send,{h,button,card}){
 const s=room.state,p=room.seat,own=p>=0&&p===s.turn&&!s.over&&!ui.busy&&!room.readOnly&&s.phase!=='round',out=h('div',{class:'poker-table-view'});
 if(s.variant==='omaha')out.append(h('p',{class:'helper'},'Pot-Limit Omaha · four hole cards · use exactly two with exactly three board cards · high only'));
 if(s.variant==='triple27')out.append(h('p',{class:'helper'},`2–7 Triple Draw · no-limit · ${s.drawCount?'draw '+s.drawCount+' of 3':'initial betting'} · aces high · straights and flushes hurt · mixed-suit 7-5-4-3-2 is best`));
 if(s.variant==='progressive_draw')out.append(h('p',{class:'helper'},s.phase==='opening'?`Deal ${s.openingDeals} · opening bet requires ${openingRequirements[s.openingLevel]}. Pass or bet with a qualifying hand. No forced bets on unopened deals.`:'The opening bet was made. Normal five-card draw play is in progress.'));
 if(room.tournament)out.append(h('p',{class:'helper'},`Recorded tournament hand ${room.tournament.hand} · table ${room.tournament.table} · level ${room.tournament.level} · ${s.variant==='stud5'?'ante / full bring-in':s.variant==='progressive_draw'?'betting references (no forced blinds)':'blinds'} ${s.smallBlind} / ${s.bigBlind}. Bots control all seats for this test. Tournament chips have no cash value. No per-hand rake.`));
 const board=h('div',{class:'poker-board-strip'},h('span',{class:'poker-pot'},(s.phase==='round'||s.over?'Pot awarded · ':'Pot · ')+formatChips(s.contributions.reduce((a,b)=>a+b,0),s)),h('div',{class:'community-cards','aria-label':'Community cards'},s.board.length?s.board.map(c=>card(c,{disabled:true})):h('span',{class:'helper'},['stud5','draw5','progressive_draw','triple27'].includes(s.variant)?'No community board':'Waiting for the flop')));
 const hand=h('div',{class:'poker-own-hand'},h('span',{class:'helper'},p>=0?'Your cards':'Spectating'),h('div',{class:'hand'},p>=0?(s.hands[p]||[]).map(c=>card(c,{disabled:true})):[]));
 out.append(board);if(!room.replay)out.append(hand);
 if(room.replay)out.append(h('div',{class:'poker-replay-seats'},h('table',{},h('thead',{},h('tr',{},['Player','Stack','Committed this hand','Cards / status'].map(t=>h('th',{},t)))),h('tbody',{},room.seats.map((seat,i)=>h('tr',{},h('td',{},seat.name+(seat.you?' · YOU':'')),h('td',{},formatChips(s.stacks[i],s)),h('td',{},formatChips(s.contributions[i],s)),h('td',{},s.hands[i]?h('div',{class:'hand'},s.hands[i].map(c=>c?card(c,{disabled:true}):h('span',{class:'card-back'},'?'))):h('span',{},'Hidden'),s.folded[i]?' · Folded':s.stacks[i]===0&&s.phase!=='round'&&!s.over?' · All-in':'')))))));
 if(room.replay&&s.pots?.length)out.append(h('div',{},h('h3',{},'Pot awards'),h('ol',{},s.pots.map(pot=>h('li',{},`${({main:'Main pot',side:'Side pot',uncalled_return:'Uncalled chips returned',uncontested:'Uncontested pot'})[pot.kind]} · ${formatChips(pot.amount,s)} · ${pot.winners.map(i=>room.seats[i].name).join(' / ')}`)))));
 if(p>=0&&!s.over&&!room.replay&&s.phase==='discard')out.append(h('div',{class:'poker-actions'},h('p',{},own?'Choose one card to discard':'Waiting for a discard'),h('div',{class:'poker-card-choices'},s.hands[p].map((c,index)=>card(c,{disabled:!own,onclick:()=>send({type:'discard',index})})))));
 if(p>=0&&!s.over&&!room.replay&&s.phase==='draw'){
  const indices=new Set(),submit=button('Stand pat',()=>send({type:'draw',indices:[...indices].sort((a,b)=>a-b)}),!own);
  out.append(h('div',{class:'poker-actions'},h('p',{},(s.variant==='triple27'?'Draw '+s.drawCount+' of 3 · ':'')+'Select cards to replace, or stand pat'),h('div',{class:'poker-card-choices'},s.hands[p].map((c,index)=>{let node;node=card(c,{disabled:!own,onclick:()=>{if(indices.has(index))indices.delete(index);else indices.add(index);node.classList.toggle('selected',indices.has(index));submit.textContent=indices.size?'Draw '+indices.size+' cards':'Stand pat';}});return node;})),submit));
 }
 if(p>=0&&!s.over&&!['round','discard','draw'].includes(s.phase)&&!room.replay){
  const due=Math.max(0,s.currentBet-s.bets[p]),stackMax=s.bets[p]+s.stacks[p],max=raiseLimit(s,p),minimum=Math.min(s.currentBet+s.minRaise,stackMax),scale=unitScale(s),pot=s.contributions.reduce((a,b)=>a+b,0);
  const reopened=s.lastActBet[p]===null||s.currentBet-s.lastActBet[p]>=s.minRaise,canRaise=own&&max>s.currentBet&&max>=minimum&&reopened&&(s.phase!=='opening'||canOpenProgressive(s.hands[p],s.openingLevel));
  let selected=minimum;
  const amount=h('input',{type:'number',min:minimum/scale,max:max/scale,step:1/scale,value:selected/scale,'aria-label':scale===1?'Raise to total chips':'Raise to total BB',disabled:!canRaise});
  const slider=h('input',{type:'range',min:minimum,max,step:1,value:selected,'aria-label':'Bet or raise amount',disabled:!canRaise});
  const raise=button('',()=>send(max<=s.currentBet?{type:'call'}:{type:'raise',to:selected}),!canRaise);
  function select(value){
   selected=Math.min(max,Math.max(minimum,Math.round(Number(value)||minimum)));
   amount.value=String(Number((selected/scale).toFixed(8)));slider.value=String(selected);
   raise.textContent=(s.currentBet?'Raise to ':'Bet ')+formatChips(selected,s);
  }
  amount.addEventListener('input',()=>{if(amount.value!==''&&Number(amount.value)*scale>=minimum)select(Number(amount.value)*scale)});
  amount.addEventListener('change',()=>select(Number(amount.value)*scale));
  slider.addEventListener('input',()=>select(slider.value));
  select(selected);
  const presets=h('div',{class:'poker-bet-presets'},[.25,.5,.75].map(f=>{
   const preset=button((f*100)+'%',()=>select(s.currentBet+Math.round(pot*f)),!canRaise);
   preset.title=(f*100)+'% of the current pot; raises add this to the current bet, subject to minimum raise and your stack';return preset;
  }),button(s.betting==='pot_limit'&&max<stackMax?'Pot':'All-in',()=>{select(max);raise.disabled=!own||(max>s.currentBet&&!canRaise);raise.textContent=(max<stackMax?'Pot to '+formatChips(max,s):'All-in '+formatChips(s.stacks[p],s));},!own||(max>s.currentBet&&!canRaise)));
  out.append(h('div',{class:'poker-actions'+(own?' is-your-turn':''),'aria-label':'Betting controls'},presets,
   h('div',{class:'poker-raise-adjust'},button('−',()=>select(selected-1),!canRaise),slider,button('+',()=>select(selected+1),!canRaise),amount),
   h('div',{class:'poker-decision-buttons'},button('Fold',()=>send({type:'fold'}),!own||s.phase==='opening'),button(s.phase==='opening'?'Pass opening':due?'Call '+formatChips(Math.min(due,s.stacks[p]),s):'Check',()=>send({type:'call'}),!own),raise)));
 }

 return out;
}
export function casinoView(room,ui,send,{h,button,card}){
 if(room.game==='roulette')return rouletteView(room,ui,send,{h,button});
 const s=room.state,own=room.seat===0&&!ui.busy,out=h('div',{class:'casino-table-view'});out.append(h('p',{class:'helper'},'Local table chips: '+s.balance+' · no cash value · not wallet funds'));
 if(room.game==='blackjack'||room.game==='baccarat'){
  out.append(h('h3',{},room.game==='baccarat'?'Banker':'Dealer'),h('div',{class:'hand'},(s.hands[1]||[s.dealerUpcard].filter(Boolean)).map(c=>card(c,{disabled:true})),s.phase==='play'?h('span',{class:'card-back'},'?'):null),h('h3',{},'Player'),h('div',{class:'hand'},(s.hands[0]||[]).map(c=>card(c,{disabled:true}))));
 }
 if(room.game==='roulette'&&s.wheel!==undefined)out.append(h('div',{class:'roulette-result'},String(s.wheel)));
 if(s.dice)out.append(h('div',{class:'dice-display'},s.dice.map(n=>['','⚀','⚁','⚂','⚃','⚄','⚅'][n]).join(' ')),h('p',{},s.point?'Point: '+s.point:s.result||''));
 if(s.phase==='bet'&&own){const amount=h('input',{type:'number',min:room.game==='baccarat'?20:2,max:100,step:room.game==='baccarat'?20:2,value:room.game==='baccarat'?20:10,'aria-label':'Practice table chip amount'});out.append(h('label',{},'Table chips ',amount));
  const act=(label,type,extra={})=>button(label,()=>send({type,amount:Number(amount.value),...extra}));
  if(room.game==='blackjack')out.append(act('Deal blackjack','bet'));
  if(room.game==='baccarat')out.append(h('div',{class:'button-row'},['player','banker','tie'].map(betType=>act('Bet '+betType,'deal',{betType}))));
  if(room.game==='craps')out.append(h('div',{class:'button-row'},['pass','dont','field'].map(betType=>act('Roll · '+betType,'roll',{betType}))));
  if(room.game==='roulette'){
   out.append(h('div',{class:'button-row'},['red','black','odd','even','low','high'].map(betType=>act('Spin · '+betType,'spin',{betType}))));
   const numbers=h('select',{'aria-label':'Roulette number'},[0,'00',...Array.from({length:36},(_,i)=>i+1)].map(n=>h('option',{value:n},n)));
   out.append(numbers,button('Bet straight-up',()=>send({type:'spin',amount:Number(amount.value),betType:'number',number:numbers.value==='00'?'00':Number(numbers.value)})));
   out.append(h('div',{class:'button-row'},[1,2,3].flatMap(group=>['dozen','column'].map(betType=>act(betType+' '+group,'spin',{betType,group})))));
  }
 }
 if(s.phase==='play'&&own)out.append(h('div',{class:'button-row'},['hit','stand','double'].map(type=>button(type[0].toUpperCase()+type.slice(1),()=>send({type}),type==='double'&&(s.hands[0].length!==2||s.balance<s.bet)))));
 if(s.phase==='point'&&own)out.append(button('Roll for point '+s.point,()=>send({type:'roll'})));
 if(s.result)out.append(h('p',{role:'status'},s.result));return out;
}
