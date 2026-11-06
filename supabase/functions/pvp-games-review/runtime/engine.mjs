import {createHash,randomBytes,randomUUID} from "node:crypto";
import {isPokerGame} from "./dist/games/poker-family.js";
import * as chess from "./dist/games/chess.js";
import * as rummy from "./dist/games/rummy.js";
import * as rummy6 from "./dist/games/rummy6.js";
import * as spades from "./dist/games/spades.js";
import * as battleship from "./dist/games/battleship.js";
import * as battleship6 from "./dist/games/battleship6.js";
export const modules={chess,rummy,rummy6,spades,battleship,battleship6};
export const createGame = (id, seed) => {
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
  return modules[id].apply(state, action);
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
