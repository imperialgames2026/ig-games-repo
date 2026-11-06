import {chipCents,spots,bySpot,reds} from './games/roulette-bets.js';
const usd=c=>'$'+(c/100).toLocaleString('en-US',{minimumFractionDigits:c%100?2:0,maximumFractionDigits:2});
export function rouletteView(room,ui,send,{h,button}){
 const s=room.state,enabled=room.seat===0&&!ui.busy&&s.phase==='bet',out=h('div',{class:'roulette-betting'}),bets=s.bets||{},total=Object.values(bets).reduce((a,b)=>a+b,0);ui.rouletteChip??=100;
 out.append(h('p',{class:'helper'},`Practice balance ${usd(s.balanceCents??1000000)} · USD display · no wallet funds`));
 const rack=h('div',{class:'chip-rack','aria-label':'Select chip denomination'});
 for(const cents of chipCents){const b=button(usd(cents),()=>{ui.rouletteChip=cents;for(const child of rack.children)child.setAttribute('aria-pressed',String(child===b));},!enabled,'denomination '+(cents===100000?'chip-plaque':''));b.setAttribute('aria-label',`Select ${usd(cents)} ${cents===100000?'plaque':'chip'}`);b.setAttribute('aria-pressed',String(ui.rouletteChip===cents));rack.append(b);}
 out.append(rack,h('p',{class:'helper'},'Select a chip, then click a number, line, intersection or outside bet. Every click adds that chip value.'));
 const make=(id,cls='')=>{const spot=bySpot[id],b=button(spot.label+(bets[id]?' · '+usd(bets[id]):''),()=>send({type:'placeChip',spot:id,cents:ui.rouletteChip}),!enabled,'roulette-spot '+cls);b.setAttribute('aria-label',`Bet ${spot.label}${bets[id]?', placed '+usd(bets[id]):''}`);b.title=spot.label+' · pays '+(spot.mult-1)+':1';return b;};
 const board=h('div',{class:'roulette-layout'}),zero=h('div',{class:'roulette-zeros'},make('n0'),make('n00')),numbers=h('div',{class:'roulette-numbers'});
 for(let n=1;n<=36;n++){const b=make('n'+n,reds.has(n)?'red-number':'black-number');b.style.gridColumn=String(Math.ceil(n/3));b.style.gridRow=String(3-(n-1)%3);numbers.append(b);}
 const overlay=(id,x,y,cls)=>{const b=make(id,'line-bet '+cls);b.textContent=bets[id]?usd(bets[id]):'•';b.style.left=x+'%';b.style.top=y+'%';numbers.append(b);};
 for(let r=0;r<12;r++){const f=r*3+1;
 for(let c=0;c<2;c++)overlay(`split${f+c}-${f+c+1}`,(r+.5)/12*100,(2-c)/3*100,'split-bet');
 if(r<11){for(let c=0;c<3;c++)overlay(`split${f+c}-${f+c+3}`,(r+1)/12*100,(2.5-c)/3*100,'split-bet');for(let c=0;c<2;c++)overlay('corner'+(f+c),(r+1)/12*100,(2-c)/3*100,'corner-bet');}
 }
 board.append(zero,numbers,h('div',{class:'roulette-columns'},...[3,2,1].map(g=>make('column'+g))));
 out.append(h('div',{class:'roulette-scroll'},board));
 out.append(h('div',{class:'roulette-outside'},...[1,2,3].map(g=>make('dozen'+g))),h('div',{class:'roulette-outside'},...['low','even','red','black','odd','high'].map(id=>make(id))));
 const extra=h('details',{},h('summary',{},'Street, six-line and zero bets'),h('div',{class:'button-row'},...spots.filter(p=>/^(street|six|trio|basket|split0)/.test(p.id)).map(p=>make(p.id))));out.append(extra);
 out.append(h('p',{class:'bet-total','aria-live':'polite'},'Total bet: '+usd(total)),h('div',{class:'button-row'},button('Undo last chip',()=>send({type:'undoBet'}),!enabled||!total),button('Clear bets',()=>send({type:'clearBets'}),!enabled||!total),button('Spin',()=>send({type:'spinBets'}),!enabled||!total,'primary')));
 const currencies=['USD','EUR','GBP','CAD','AUD','BTC','ETH','SOL','LTC','DOGE','BNB','USDT','USDC'],select=h('select',{'aria-label':'Equivalent currency'},...currencies.map(code=>h('option',{value:code,selected:code===(ui.quoteCurrency||'USD')},code))),quoteText=h('p',{class:'helper',role:'status'});
 const showQuote=()=>{const q=ui.rouletteQuote;if(!q||q.currency!==select.value){quoteText.textContent='Loading market reference…';return;}quoteText.textContent=q.available?`${usd(total)} ≈ ${(total/100/q.usdPerUnit).toLocaleString('en-US',{maximumFractionDigits:q.decimals})} ${q.currency} · ${q.source} · ${new Date(q.asOf).toLocaleString()} · estimate only`:'Conversion unavailable: '+q.reason;};
 async function quote(){ui.quoteCurrency=select.value;const code=select.value;try{const r=await fetch('/api/roulette-quote?currency='+encodeURIComponent(code));const q=await r.json();if(select.value!==code)return;ui.rouletteQuote=q;showQuote();}catch{quoteText.textContent='Conversion unavailable. No exchange rate has been assumed.';}}
 select.onchange=quote;out.append(h('label',{},'Show equivalent in ',select),quoteText,h('p',{class:'helper'},'Market references are for preview only. Live play must accept a server quote and lock the stake in the selected currency; this preview does not convert or transfer funds.'));if(ui.rouletteQuote?.currency===select.value)showQuote();else quote();
 if(s.wheel!==undefined)out.append(h('h3',{},'Winning number: '+s.wheel));if(s.result)out.append(h('p',{role:'status'},s.result));return out;
}
