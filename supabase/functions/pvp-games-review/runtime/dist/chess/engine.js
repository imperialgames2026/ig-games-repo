import {Chess} from './vendor/chess.js';
const value={p:100,n:320,b:335,r:500,q:900,k:0};
function evaluate(game){let sum=0;for(const row of game.board())for(const p of row){if(!p)continue;const file=p.square.charCodeAt(0)-97,rank=Number(p.square[1])-1;const advance=p.color==='w'?rank:7-rank;const center=3.5-Math.abs(3.5-file)+3.5-Math.abs(3.5-rank);const bonus=p.type==='p'?advance*7+center*2:['n','b'].includes(p.type)?center*8:0;sum+=(p.color==='w'?1:-1)*(value[p.type]+bonus);}return sum*(game.turn()==='w'?1:-1);}
const TIMEOUT=Symbol('timeout');
export function chooseMove(fen,depth=2,budget=1400){
 const game=new Chess(fen),deadline=performance.now()+budget;let nodes=0;
 const ordered=()=>game.moves({verbose:true}).sort((a,b)=>((value[b.captured]||0)*10-value[b.piece]+(b.promotion?800:0))-((value[a.captured]||0)*10-value[a.piece]+(a.promotion?800:0)));
 const root=ordered();if(!root.length)return null;let best=root[0];
 function search(d,alpha,beta,ply){if((++nodes&31)===0&&performance.now()>deadline)throw TIMEOUT;if(game.isCheckmate())return -100000+ply;if(game.isDraw())return 0;if(d===0)return evaluate(game);let score=-Infinity;for(const m of ordered()){game.move(m);let n;try{n=-search(d-1,-beta,-alpha,ply+1);}finally{game.undo();}score=Math.max(score,n);alpha=Math.max(alpha,n);if(alpha>=beta)break;}return score;}
 for(let d=1;d<=depth;d++){let candidate=best,score=-Infinity;try{for(const m of root){if(performance.now()>deadline)throw TIMEOUT;game.move(m);let s;try{s=-search(d-1,-Infinity,-score,1);}finally{game.undo();}if(s>score){score=s;candidate=m;}}best=candidate;}catch(e){if(e!==TIMEOUT)throw e;break;}}
 return {from:best.from,to:best.to,...(best.promotion?{promotion:best.promotion}:{})};
}
