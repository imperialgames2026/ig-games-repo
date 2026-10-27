import assert from 'node:assert/strict';
export function total(cards){let n=0,aces=0;for(const c of cards){assert.ok(Number.isInteger(c)&&c>=0&&c<52);const rank=c%13+1;n+=rank===1?11:Math.min(rank,10);if(rank===1)aces++;}while(n>21&&aces-->0)n-=10;return n;}
export function blackjackExpected(player,dealer,mainUnits,pairUnits){
 const p=total(player),d=total(dealer),natural=player.length===2&&p===21,dealerNatural=dealer.length===2&&d===21;
 let status,main=0;
 if(p>21)status='bust';else if(dealerNatural&&natural){status='push';main=mainUnits;}else if(dealerNatural)status='lose';else if(natural){status='blackjack';main=Math.floor(mainUnits*2.5);}else if(d>21||p>d){status='win';main=mainUnits*2;}else if(p===d){status='push';main=mainUnits;}else status='lose';
 let pair=0,pairKind='miss';if(player.length>=2&&player[0]%13===player[1]%13){const a=Math.floor(player[0]/13),b=Math.floor(player[1]/13);pairKind=a===b?'perfect':([0,3].includes(a)&&[0,3].includes(b)||[1,2].includes(a)&&[1,2].includes(b))?'colored':'mixed';pair=pairUnits*({perfect:26,colored:13,mixed:6}[pairKind]);}
 return {status,main,pair,pairKind};
}
export function coverage(records){const set=key=>[...new Set(records.map(r=>r[key]))].sort();const main=set('status'),pairs=set('pairKind');return {mainStatuses:main,pairKinds:pairs,mainPositive:records.some(r=>r.main>0),mainZero:records.some(r=>r.main===0),sidePositive:records.some(r=>r.pair>0),sideZero:records.some(r=>r.pair===0),unobservedMain:['bust','lose','push','blackjack','win'].filter(s=>!main.includes(s)),unobservedPairs:['miss','mixed','colored','perfect'].filter(s=>!pairs.includes(s))};}
