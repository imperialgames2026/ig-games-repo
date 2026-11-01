export function outcome(game,resigned=null){
 if(resigned)return {over:true,result:resigned==='w'?'0-1':'1-0',title:`${resigned==='w'?'Black':'White'} wins`,detail:`${resigned==='w'?'White':'Black'} resigned.`};
 if(game.isCheckmate())return {over:true,result:game.turn()==='w'?'0-1':'1-0',title:`${game.turn()==='w'?'Black':'White'} wins`,detail:'Checkmate. The king has no escape.'};
 let draw=game.isStalemate()?'Stalemate.':game.isThreefoldRepetition()?'Draw by threefold repetition.':game.isInsufficientMaterial()?'Draw by insufficient material.':game.isDrawByFiftyMoves()?'Draw by the 50-move rule.':null;
 if(draw)return {over:true,result:'1/2-1/2',title:'Draw',detail:draw};
 return {over:false,result:'*',title:`${game.turn()==='w'?'White':'Black'} to move`,detail:game.isCheck()?'Check — protect your king.':'Select a piece, then choose a highlighted square.'};
}
export function undoCount(game,mode){return mode==='engine'&&game.turn()==='w'?Math.min(2,game.history().length):Math.min(1,game.history().length);}
export function pgnFor(game,resigned=null){for(const [key,value] of Object.entries({Event:'Imperial Chess · Local practice',White:'White',Black:'Black',Result:outcome(game,resigned).result}))game.setHeader(key,value);return game.pgn();}
