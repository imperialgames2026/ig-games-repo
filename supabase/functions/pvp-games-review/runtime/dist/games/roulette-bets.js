import {requireThat,reduce,random,log} from './common.js';
export const chipCents=[10,25,100,500,2500,5000,10000,50000,100000];
export const reds=new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const all=Array.from({length:36},(_,i)=>i+1);
export const spots=[];
const add=(id,label,numbers,mult)=>spots.push({id,label,numbers,mult});
for(const n of [0,'00',...all])add('n'+n,String(n),[n],36);
for(const [id,label,nums] of [['red','Red',all.filter(n=>reds.has(n))],['black','Black',all.filter(n=>!reds.has(n))],['odd','Odd',all.filter(n=>n%2)],['even','Even',all.filter(n=>!(n%2))],['low','1–18',all.slice(0,18)],['high','19–36',all.slice(18)]])add(id,label,nums,2);
for(let g=1;g<=3;g++){add('dozen'+g,`${g} dozen`,all.slice((g-1)*12,g*12),3);add('column'+g,`Column ${g}`,all.filter(n=>(n-1)%3===g-1),3);}
for(let row=0;row<12;row++){
 const first=row*3+1;add('street'+row,`Street ${first}–${first+2}`,[first,first+1,first+2],12);
 for(let c=0;c<2;c++)add(`split${first+c}-${first+c+1}`,`Split ${first+c}/${first+c+1}`,[first+c,first+c+1],18);
 if(row<11){for(let c=0;c<3;c++)add(`split${first+c}-${first+c+3}`,`Split ${first+c}/${first+c+3}`,[first+c,first+c+3],18);
 for(let c=0;c<2;c++)add(`corner${first+c}`,`Corner ${first+c}/${first+c+1}/${first+c+3}/${first+c+4}`,[first+c,first+c+1,first+c+3,first+c+4],9);
 add('six'+row,`Six line ${first}–${first+5}`,Array.from({length:6},(_,i)=>first+i),6);}
}
for(const [id,nums] of [['split0-00',[0,'00']],['split0-1',[0,1]],['split0-2',[0,2]],['split00-2',['00',2]],['split00-3',['00',3]]])add(id,`Split ${nums.join('/')}`,nums,18);
add('trio0','Trio 0/1/2',[0,1,2],12);add('trio00','Trio 00/2/3',['00',2,3],12);add('basket','First five',[0,'00',1,2,3],7);
export const bySpot=Object.fromEntries(spots.map(s=>[s.id,s]));
export function rouletteBetsApply(s,a){return reduce(s,a,n=>{
 n.balanceCents??=1000000;n.bets??={};n.placements??=[];
 const total=()=>Object.values(n.bets).reduce((x,y)=>x+y,0);
 if(a.type==='next'){requireThat(n.phase==='round','Finish the spin first.');n.phase='bet';n.bets={};n.placements=[];n.result=null;return;}
 requireThat(n.phase==='bet','Bets are closed for this spin.');
 if(a.type==='placeChip'){requireThat(Object.hasOwn(bySpot,a.spot)&&chipCents.includes(a.cents),'Choose a valid chip and betting spot.');requireThat(total()+a.cents<=n.balanceCents,'Not enough practice balance.');n.bets[a.spot]=(n.bets[a.spot]||0)+a.cents;n.placements.push({spot:a.spot,cents:a.cents});return;}
 if(a.type==='undoBet'){const p=n.placements.pop();if(p){n.bets[p.spot]-=p.cents;if(!n.bets[p.spot])delete n.bets[p.spot];}return;}
 if(a.type==='clearBets'){n.bets={};n.placements=[];return;}
 requireThat(a.type==='spinBets'&&total()>0,'Place a chip before spinning.');const stake=total();requireThat(Number.isSafeInteger(stake)&&stake<=n.balanceCents,'Invalid stake.');
 const pick=Math.floor(random(n)*38);n.wheel=pick===37?'00':pick;
 n.betResults=Object.entries(n.bets).map(([id,cents])=>({id,cents,returnedCents:bySpot[id].numbers.includes(n.wheel)?cents*bySpot[id].mult:0}));
 n.returnedCents=n.betResults.reduce((sum,b)=>sum+b.returnedCents,0);n.stakeCents=stake;n.balanceCents+=n.returnedCents-stake;n.phase='round';n.round++;
 n.result=`Ball ${n.wheel} · Staked ${(stake/100).toFixed(2)} · Returned ${(n.returnedCents/100).toFixed(2)} practice chips · practice only`;log(n,n.result);
 });}
