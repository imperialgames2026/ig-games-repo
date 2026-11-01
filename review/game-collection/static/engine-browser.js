import {isPokerGame} from './runtime/games/poker-family.js';
import * as pineapple6 from './runtime/games/pineapple6.js';
import * as crazy6 from './runtime/games/crazy6.js';
import * as lazy6 from './runtime/games/lazy6.js';
import * as stud5 from './runtime/games/stud5.js';
import * as draw5 from './runtime/games/draw5.js';
import * as triple27 from './runtime/games/triple27.js';
import * as progressive5 from './runtime/games/progressive5.js';
import * as omaha2 from './runtime/games/omaha2.js';
import * as omaha4 from './runtime/games/omaha4.js';
import * as omaha6 from './runtime/games/omaha6.js';
import * as omaha7 from './runtime/games/omaha7.js';
import * as omaha8 from './runtime/games/omaha8.js';
import * as omaha9 from './runtime/games/omaha9.js';
import * as poker7 from "./runtime/games/poker7.js";
import * as poker9 from "./runtime/games/poker9.js";

import * as battleship6 from "./runtime/games/battleship6.js";
import * as rummy6 from "./runtime/games/rummy6.js";
import * as poker2 from "./runtime/games/poker2.js";
import * as poker4 from "./runtime/games/poker4.js";
import * as poker6 from "./runtime/games/poker6.js";
import * as poker8 from "./runtime/games/poker8.js";
import * as blackjack from "./runtime/games/blackjack.js";
import * as roulette from "./runtime/games/roulette.js";
import * as craps from "./runtime/games/craps.js";
import * as baccarat from "./runtime/games/baccarat.js";
import * as connectfour from "./runtime/games/connectfour.js";
import * as backgammon from "./runtime/games/backgammon.js";
import * as spades from "./runtime/games/spades.js";
import * as reversi from "./runtime/games/reversi.js";
import * as gomoku from "./runtime/games/gomoku.js";
import * as chess from "./runtime/games/chess.js";
import * as checkers from "./runtime/games/checkers.js";
import * as dominoes from "./runtime/games/dominoes.js";
import * as euchre from "./runtime/games/euchre.js";
import * as rummy from "./runtime/games/rummy.js";
import * as hearts from "./runtime/games/hearts.js";
import * as pinochle from "./runtime/games/pinochle.js";
import * as battleship from "./runtime/games/battleship.js";
import * as words from "./runtime/games/words.js";

import { byId } from "./runtime/games/catalog.js";
export const modules = {
  pineapple6,crazy6,lazy6,stud5,draw5,progressive5,triple27,
  omaha2, omaha4, omaha6, omaha7, omaha8, omaha9,
  battleship6, poker7, poker9,
  rummy6, poker2, poker4, poker6, poker8, blackjack, roulette, craps, baccarat,
  connectfour,
  backgammon,
  spades,
  reversi,
  gomoku,
  chess,
  checkers,
  dominoes,
  euchre,
  rummy,
  hearts,
  pinochle,
  battleship,
  words,
};
export const dictionary=new Set((await fetch('/game-collection/assets/words.txt').then(r=>{if(!r.ok)throw Error('Local dictionary missing');return r.text();})).trim().split('\n'));
const trie = words.makeTrie(dictionary);
export const createGame = (id, seed) => modules[id].create(seed);
// Local-only rule review: no server fleet commitment is minted or claimed here.
export function applyGame(id,state,action){return id==='words'?modules[id].apply(state,action,dictionary):modules[id].apply(state,action);}
export function botAction(id, state, p = state.turn) {
  const s=structuredClone(state);
  if(id.startsWith("battleship")&&s.phase==="placement")return s.ships[p].length<(s.fleetSize ?? 5)?{type:"auto",player:p}:{type:"ready",player:p};
  return id === "words"
    ? words.bestMove(s, dictionary, trie)
    : id === "hearts" || id.startsWith("battleship")
      ? modules[id].bot(s, p)
      : modules[id].bot(s);
}
export function pendingBot(room) {
  if(room.tournament?.readOnly)return null;
  const s = room.state;
  if (s.over || s.phase === "round") return null;
  if (room.game === "hearts" && s.phase === "pass")
    return s.passed.findIndex((x, p) => !x && !room.seats[p]) < 0
      ? null
      : s.passed.findIndex((x, p) => !x && !room.seats[p]);
  if (room.game.startsWith("battleship") && s.phase === "placement")
    return s.ready.findIndex((x, p) => !x && !room.seats[p]) < 0
      ? null
      : s.ready.findIndex((x, p) => !x && !room.seats[p]);
  return room.seats[s.turn] ? null : s.turn;
}
export function playerView(room, guestId) {
  const seat = room.seats.indexOf(guestId),
    s = structuredClone(room.state),
    game = room.game;
  const counts = s.hands?.map((h) => h.length);
  delete s.seed;
  delete s.initialSeed;
  delete s.positions;
  delete s.kitty;
  delete s.buried;
  delete s.muck;delete s.burned;delete s.discarded;
  if (s.hands) {
    s.handCounts = counts;
    s.hands = s.hands.map((h, p) => ((s.over && !isPokerGame(game)) || p === seat || (isPokerGame(game) && s.revealed?.includes(p)) || (game === "baccarat") || (game === "blackjack" && s.phase === "round") ? h : null));
    if(room.state.variant==='stud5')s.hands=s.hands.map((h,p)=>h||room.state.hands[p].map((c,i)=>i===0?null:c));
  }
  if (game === "blackjack" && s.phase === "play") s.dealerUpcard = room.state.hands[1][0];
  if (s.stock) {
    s.stockCount = s.stock.length;
    delete s.stock;
  }
  if (s.bag) {
    s.bagCount = s.bag.length;
    delete s.bag;
  }
  if (s.passed && game === "hearts") s.passed = s.passed.map(Boolean);
  if (game === "euchre" && s.bidRound === 2) delete s.upcard;
  if (game.startsWith("battleship")) {
    if (s.fleetProofs && !s.over) s.fleetProofs = s.fleetProofs.map(proof => proof ? {version:proof.version, commitment:proof.commitment} : null);
    s.sunk = s.ships.map((fleet, p) =>
      fleet
        .filter((ship) => battleship.isSunk(ship, s.shots[1 - p]))
        .map((ship) => ({ name: ship.name, cells: ship.cells })),
    );
    s.ships = s.ships.map((ships, p) => (s.over || p === seat ? ships : []));
  }
  if (seat >= 0) {
    if (["euchre", "hearts", "pinochle", "spades"].includes(game))
      s.legalCards = modules[game]
        .legalCards(room.state, seat)
        .map((c) => c.id);
    if (["checkers", "connectfour", "backgammon", "reversi"].includes(game))
      s.legalMoves = modules[game].legalMoves(room.state);
    if (game === "dominoes")
      s.legalMoves = dominoes.legalMoves(room.state, seat);
    if (game === "euchre") s.bidOptions = euchre.bidOptions(room.state);
  }
  return {
    id: room.id,
    game: room.game,
    title: room.title,
    version: room.version,
    readOnly:!!room.tournament?.readOnly,
    tournament:room.tournament,
    turnClock: room.turnClock ? {...room.turnClock,serverNow:Date.now()} : null,
    seat,
    owner: room.owner === guestId,
    seats: room.seats.map((g, p) => ({
      index: p,
      name: g ? room.names[g] || "Guest" : `Practice bot ${p + 1}`,
      bot: !g || g.startsWith('bot:') || !!room.tournament?.readOnly,
      you: g === guestId,
    })),
    state: s,
  };
}
export function authorizedAction(room, guestId, action) {
  if(room.tournament?.readOnly)throw new Error('Recorded tournament hands are read-only.');
  const seat = room.seats.indexOf(guestId);
  if (seat < 0) throw new Error("Take a seat to play.");
  const s = room.state;
  if (action.type === "next") {
    if (s.phase !== "round") throw new Error("This hand is still active.");
  } else if (room.game === "hearts" && s.phase === "pass") {
    action = { ...action, player: seat };
  } else if (room.game.startsWith("battleship") && s.phase === "placement") {
    action = { ...action, player: seat };
  } else {
    if (s.turn !== seat) throw new Error("Wait for your turn.");
    action = { ...action, player: seat };
  }
  return applyGame(room.game, s, action);
}
