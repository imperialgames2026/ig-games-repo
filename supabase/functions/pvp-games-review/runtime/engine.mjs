import {create as createPoker} from './dist/games/poker-core.js';
import * as poker2 from "./dist/games/poker2.js";
import * as poker4 from "./dist/games/poker4.js";
import * as poker6 from "./dist/games/poker6.js";
import * as poker7 from "./dist/games/poker7.js";
import * as poker8 from "./dist/games/poker8.js";
import * as poker9 from "./dist/games/poker9.js";
import * as omaha2 from "./dist/games/omaha2.js";
import * as omaha4 from "./dist/games/omaha4.js";
import * as omaha6 from "./dist/games/omaha6.js";
import * as omaha7 from "./dist/games/omaha7.js";
import * as omaha8 from "./dist/games/omaha8.js";
import * as omaha9 from "./dist/games/omaha9.js";
import * as pineapple6 from "./dist/games/pineapple6.js";
import * as crazy6 from "./dist/games/crazy6.js";
import * as lazy6 from "./dist/games/lazy6.js";
import * as stud5 from "./dist/games/stud5.js";
import * as draw5 from "./dist/games/draw5.js";
import * as triple27 from "./dist/games/triple27.js";
import * as blackjack from "./dist/games/blackjack.js";
import * as roulette from "./dist/games/roulette.js";
import * as craps from "./dist/games/craps.js";
import * as baccarat from "./dist/games/baccarat.js";
import {dictionary} from "./dictionary.mjs";
import * as checkers from "./dist/games/checkers.js";
import * as dominoes from "./dist/games/dominoes.js";
import * as euchre from "./dist/games/euchre.js";
import * as hearts from "./dist/games/hearts.js";
import * as pinochle from "./dist/games/pinochle.js";
import * as connectfour from "./dist/games/connectfour.js";
import * as backgammon from "./dist/games/backgammon.js";
import * as reversi from "./dist/games/reversi.js";
import * as gomoku from "./dist/games/gomoku.js";
import * as words from "./dist/games/words.js";
import {createHash,randomBytes,randomUUID} from "node:crypto";
import {isPokerGame} from "./dist/games/poker-family.js";
import * as chess from "./dist/games/chess.js";
import * as rummy from "./dist/games/rummy.js";
import * as rummy6 from "./dist/games/rummy6.js";
import * as spades from "./dist/games/spades.js";
import * as battleship from "./dist/games/battleship.js";
import * as battleship6 from "./dist/games/battleship6.js";
export const modules={poker2,poker4,poker6,poker7,poker8,poker9,omaha2,omaha4,omaha6,omaha7,omaha8,omaha9,pineapple6,crazy6,lazy6,stud5,draw5,triple27,blackjack,roulette,craps,baccarat,chess,rummy,rummy6,spades,battleship,battleship6,checkers,dominoes,euchre,hearts,pinochle,connectfour,backgammon,reversi,gomoku,words};
export const createGame = (id, seed, players) => {
  if(players===7&&/^(poker|omaha)(8|9)$/.test(id))return createPoker(seed,7,id.startsWith('omaha')?'omaha':'holdem');
  const state = modules[id].create(seed);
  if (id.startsWith('battleship')) state.deploymentId = randomUUID();
  return state;
};
export function applyGame(id, state, action) {
  if (id.startsWith("battleship")) {
    const next = modules[id].apply(state, action);
    if (action.type === "ready") {
      const player = action.player ?? state.turn;
      next.fleetProofs ??= [null, null];
      const nonce = randomBytes(32).toString("hex");
      const payload = JSON.stringify({version:1, player, deploymentId:next.deploymentId ?? null, fleetSize:next.fleetSize ?? 5, ships:next.ships[player]});
      next.fleetProofs[player] = {version:1, commitment:createHash("sha256").update(nonce + ":" + payload).digest("hex"), nonce, payload};
    }
    return next;
  }
  return id === "words" ? words.apply(state,action,dictionary) : modules[id].apply(state,action);
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
