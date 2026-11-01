import {isPokerGame} from './poker-family.js';
// Keeping setup drafts available does not authorize entry collection or execution.
const matchGames=new Set(['chess','checkers','dominoes','euchre','rummy','hearts','pinochle','battleship','battleship6','words','connectfour','backgammon','spades','reversi','gomoku']);
export function tournamentCapability(game,players,format){
 if(game==='spades')return format==='team_elimination'?{canRun:true,reason:''}:{canRun:false,reason:'Spades tournaments use fixed-partnership team elimination.'};
 if(isPokerGame(game))return format==='poker_freezeout'?{canRun:true,reason:''}:{canRun:false,reason:'Poker tournaments require the freezeout format: carry chips, increase blinds, and play to one winner.'};
 if(!matchGames.has(game))return{canRun:false,reason:'Tournament setup only: this table format does not yet have a tournament execution adapter.'};
 if(players===4&&format!=='swiss')return{canRun:false,reason:'Four-player practice tournaments require Swiss-style pods.'};
 return{canRun:true,reason:''};
}
export const botAuditBoundary=game=>isPokerGame(game)||['blackjack','roulette','craps','baccarat','rummy6'].includes(game)?'round':'match';
