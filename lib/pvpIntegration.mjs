// Hosted private practice registry. The frontend activation switch is build-time.
const definitions = [
 ['poker2',"NLHE · 2-max",2],
 ['poker4',"NLHE · 4-max",4],
 ['poker6',"NLHE · 6-max",6],
 ['poker8',"NLHE · 8-max",8],
 ['poker9',"NLHE · 9-max",9],
 ['omaha2',"Omaha PLO · 2-max",2],
 ['omaha4',"Omaha PLO · 4-max",4],
 ['omaha6',"Omaha PLO · 6-max",6],
 ['omaha8',"Omaha PLO · 8-max",8],
 ['omaha9',"Omaha PLO · 9-max",9],
 ['pineapple6',"Classic Pineapple · 6-max",6],
 ['crazy6',"Crazy Pineapple · 6-max",6],
 ['lazy6',"Lazy Pineapple · 6-max",6],
 ['stud5',"Five-card Stud · 6-max",6],
 ['draw5',"Five-card Draw · 6-max",6],
 ['triple27',"2–7 Triple Draw · 6-max",6],
 ['blackjack',"Blackjack",1],
 ['roulette',"American Roulette",1],
 ['craps',"Craps",1],
 ['baccarat',"Baccarat",1],

 ['chess','Chess',2],['rummy','Straight Rummy',2],['rummy6','Straight Rummy',6],
 ['spades','Spades',4],['battleship','Fleet Command · five ships',2],
 ['battleship6','Fleet Command · six ships',2],
['checkers','Checkers',2],['dominoes','Dominoes',2],['euchre','Euchre',4],['hearts','Hearts',4],['pinochle','Pinochle',4],['connectfour','Connect Four',2],['backgammon','Backgammon',2],['reversi','Reversi',2],['gomoku','Gomoku',2],['words','Imperial Wordcraft',2],
];
export const pendingPvpGames = Object.freeze(definitions.map(([id,name,seats])=>Object.freeze({id,name,seats,available:true})));
export function pvpGameStatus(id) {
 const game=pendingPvpGames.find(game=>game.id===id);
 if(!game)throw new Error('Unknown pending PvP game');
 return game;
}
export function requirePvpService(id) { return pvpGameStatus(id); }
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const revision=value=>Number.isSafeInteger(value)&&value>=0&&value<Number.MAX_SAFE_INTEGER;
// Proposed transport envelope, not permission to send it. Actor is never accepted
// from a form; a future service derives it from verified Auth on every operation.
export function preparePvpAction(input) {
 if(!input||Object.keys(input).sort().join(',')!=='action,expectedRevision,requestId,roomId')throw new Error('Invalid PvP envelope fields');
 const {roomId,requestId,expectedRevision,action}=input;
 if(!uuid(roomId)||!uuid(requestId)||!revision(expectedRevision))throw new Error('Invalid PvP envelope identity or revision');
 if(!action||Object.getPrototypeOf(action)!==Object.prototype||typeof action.type!=='string'||!/^[a-z][a-z_]{0,39}$/.test(action.type))throw new Error('Invalid PvP action');
 // Rules and payload validation belong to the authoritative per-game backend.
 // Reject caller authorization/financial claims even in this unwired proposal.
 const forbidden=new Set(['actor','actorId','userId','role','token','wallet','balance','payout','credits','amount']);
 function inspect(value,depth=0){
  if(depth>12)throw new Error('Oversized PvP action');
  if(value===null||typeof value==='string'||typeof value==='boolean')return;
  if(typeof value==='number'&&Number.isSafeInteger(value))return;
  if(typeof value!=='object')throw new Error('Invalid PvP action value');
  if(!Array.isArray(value)&&Object.getPrototypeOf(value)!==Object.prototype)throw new Error('Invalid PvP action object');
  for(const [key,child]of Object.entries(value)){if(forbidden.has(key))throw new Error('Caller authority is forbidden');inspect(child,depth+1);}
 }
 inspect(action);const encoded=JSON.stringify(action);if(encoded.length>8192)throw new Error('Oversized PvP action');
 return {protocol:'ig.pvp.action.v1',roomId,requestId,expectedRevision,action:JSON.parse(encoded)};
}
// UI freshness filter only, NOT authorization or hidden-information filtering.
// viewerId must come from canonical Auth; server emits a private projection for it.
export function acceptPvpSnapshot(current,incoming,{roomId,viewerId}={}) {
 if(!uuid(roomId)||!uuid(viewerId))return current;
 const valid=s=>s?.protocol==='ig.pvp.snapshot.v1'&&s.roomId===roomId&&s.viewerId===viewerId&&revision(s.revision);
 if(!valid(incoming))return current;
 if(valid(current)&&incoming.revision<=current.revision)return current;
 return incoming;
}
