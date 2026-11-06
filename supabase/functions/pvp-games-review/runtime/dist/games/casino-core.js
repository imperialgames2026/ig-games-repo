import {initial,deck,shuffle,reduce,requireThat,log,random} from './common.js';
export const redNumbers=new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
export function create(seed,kind){return {...initial(seed),kind,turn:0,phase:'bet',scores:[],balance:1000,stock:[],hands:[[],[]],result:null,point:null,contract:0,bet:0};}
export function total(hand){let n=hand.reduce((v,c)=>v+(c.r===1?11:Math.min(c.r,10)),0),aces=hand.filter(c=>c.r===1).length;while(n>21&&aces-->0)n-=10;return n;}
function stake(n,a){requireThat(Number.isSafeInteger(a.amount)&&a.amount>=2&&a.amount<=100&&a.amount%2===0&&a.amount<=n.balance,'Use an even number of table chips from 2 to 100, within your balance.');n.bet=a.amount;n.balance-=a.amount;}
function pay(n,mult,label){const paid=n.bet*mult;n.balance+=paid;n.phase='round';n.round++;n.result=label;log(n,label+' · returned '+paid+' table chips.');}
function draw(n){if(!n.stock.length)n.stock=shuffle(deck(undefined,6),n);return n.stock.pop();}
export function blackjackApply(s,a){return reduce(s,a,n=>{
 if(a.type==='next'){requireThat(n.phase==='round','Hand still active.');n.phase='bet';n.hands=[[],[]];n.result=null;return;}
 if(a.type==='bet'){
  requireThat(n.phase==='bet','Hand already started.');stake(n,a);n.stock=shuffle(deck(undefined,6),n);n.hands=[[draw(n),draw(n)],[draw(n),draw(n)]];n.phase='play';
  const player=total(n.hands[0])===21,dealer=total(n.hands[1])===21;
  if(player||dealer)pay(n,player&&dealer?1:player?2.5:0,player&&dealer?'Both blackjack: push':player?'Blackjack pays 3:2':'Dealer blackjack');else log(n,'Hit, stand, or double on your first two cards.');return;
 }
 requireThat(n.phase==='play','Place a bet first.');
 if(a.type==='hit'){n.hands[0].push(draw(n));if(total(n.hands[0])>21)pay(n,0,'Player bust');else log(n,'Player draws.');return;}
 requireThat(['stand','double'].includes(a.type),'Unknown blackjack action.');
 if(a.type==='double'){requireThat(n.hands[0].length===2&&n.balance>=n.bet,'Double needs two cards and matching chips.');n.balance-=n.bet;n.bet*=2;n.hands[0].push(draw(n));if(total(n.hands[0])>21){pay(n,0,'Double down bust');return;}}
 while(total(n.hands[1])<17)n.hands[1].push(draw(n));const p=total(n.hands[0]),d=total(n.hands[1]);pay(n,d>21||p>d?2:p===d?1:0,d>21?'Dealer bust':p>d?'Player wins':p===d?'Push':'Dealer wins');
});}
export function rouletteApply(s,a){return reduce(s,a,n=>{
 if(a.type==='next'){requireThat(n.phase==='round','Spin still active.');n.phase='bet';return;}
 requireThat(n.phase==='bet'&&a.type==='spin','Choose a bet before spinning.');const allowed=['number','red','black','odd','even','low','high','dozen','column'];requireThat(allowed.includes(a.betType),'Unknown roulette bet.');
 if(a.betType==='number')requireThat(a.number==='00'||Number.isInteger(a.number)&&a.number>=0&&a.number<=36,'Pick 0, 00, or 1–36.');
 if(['dozen','column'].includes(a.betType))requireThat([1,2,3].includes(a.group),'Pick group 1, 2, or 3.');stake(n,a);
 const pick=Math.floor(random(n)*38),value=pick===37?'00':pick;n.wheel=value;const ordinary=Number.isInteger(value)&&value>0;
 const wins={number:value===a.number,red:ordinary&&redNumbers.has(value),black:ordinary&&!redNumbers.has(value),odd:ordinary&&value%2===1,even:ordinary&&value%2===0,low:ordinary&&value<=18,high:ordinary&&value>=19,dozen:ordinary&&Math.ceil(value/12)===a.group,column:ordinary&&(value-1)%3+1===a.group};
 pay(n,wins[a.betType]?(a.betType==='number'?36:['dozen','column'].includes(a.betType)?3:2):0,'Ball lands on '+value+(wins[a.betType]?' · winning bet':' · losing bet'));
});}
export function crapsApply(s,a){return reduce(s,a,n=>{
 if(a.type==='next'){requireThat(n.phase==='round','Round active.');n.phase='bet';return;}
 requireThat(a.type==='roll'&&['bet','point'].includes(n.phase),'Roll after choosing a bet.');
 if(n.phase==='bet'){requireThat(['pass','dont','field'].includes(a.betType),'Choose pass, dont pass, or field.');stake(n,a);n.betType=a.betType;}
 n.dice=[1+Math.floor(random(n)*6),1+Math.floor(random(n)*6)];const sum=n.dice[0]+n.dice[1];
 if(n.betType==='field'){pay(n,[2,12].includes(sum)?3:[3,4,9,10,11].includes(sum)?2:0,'Field roll '+sum);return;}
 if(n.point){if(sum===n.point||sum===7){const win=n.betType==='pass'?sum===n.point:sum===7;n.point=null;pay(n,win?2:0,'Roll '+sum+(win?' · line wins':' · line loses'));}else log(n,'Roll '+sum+' · point '+n.point+' remains.');return;}
 if([7,11].includes(sum)){pay(n,n.betType==='pass'?2:0,'Come-out '+sum);return;}
 if([2,3,12].includes(sum)){pay(n,n.betType==='dont'?(sum===12?1:2):0,'Come-out '+sum+(sum===12&&n.betType==='dont'?' · dont pass pushes':''));return;}
 n.point=sum;n.phase='point';log(n,'Point is '+sum+'. Roll until point or seven.');
});}
export function baccaratApply(s,a){return reduce(s,a,n=>{
 if(a.type==='next'){requireThat(n.phase==='round','Round active.');n.phase='bet';n.hands=[[],[]];return;}
 requireThat(n.phase==='bet'&&a.type==='deal','Choose a bet.');requireThat(['player','banker','tie'].includes(a.betType),'Unknown baccarat bet.');
 // Multiples of twenty keep the standard five-percent banker commission exact in whole table chips.
 requireThat(Number.isSafeInteger(a.amount)&&a.amount%20===0,'Baccarat uses multiples of 20 table chips.');stake(n,a);n.stock=shuffle(deck(undefined,8),n);n.hands=[[draw(n),draw(n)],[draw(n),draw(n)]];
 const val=h=>h.reduce((v,c)=>v+(c.r>=10?0:c.r),0)%10;let p=val(n.hands[0]),b=val(n.hands[1]);
 if(p<8&&b<8){let third=null;if(p<=5){const c=draw(n);n.hands[0].push(c);third=c.r>=10?0:c.r;}
  const take=third===null?b<=5:b<=2||b===3&&third!==8||b===4&&third>=2&&third<=7||b===5&&third>=4&&third<=7||b===6&&third>=6&&third<=7;if(take)n.hands[1].push(draw(n));}
 p=val(n.hands[0]);b=val(n.hands[1]);const winner=p===b?'tie':p>b?'player':'banker';pay(n,winner===a.betType?(winner==='tie'?9:winner==='banker'?1.95:2):winner==='tie'&&a.betType!=='tie'?1:0,'Player '+p+' · Banker '+b+' · '+winner+' wins');n.balance=Math.round(n.balance);
});}
export function bot(s){if(s.phase==='bet')return s.kind==='blackjack'?{type:'bet',amount:10}:s.kind==='roulette'?{type:'spin',betType:'red',amount:10}:s.kind==='baccarat'?{type:'deal',betType:'player',amount:20}:{type:'roll',betType:'pass',amount:10};if(s.kind==='craps')return {type:'roll'};return {type:total(s.hands[0])<17?'hit':'stand'};}
