import { initial, random, log, finish, requireThat, reduce } from "./common.js";
export const fleet = [
  { name: "Carrier", length: 5 },
  { name: "Battleship", length: 4 },
  { name: "Cruiser", length: 3 },
  { name: "Submarine", length: 3 },
  { name: "Patrol", length: 2 },
];
export const extendedFleet = [...fleet, { name: "Destroyer", length: 2 }];
export function fleetFor(count = 5) {
  requireThat(count === 5 || count === 6, "Choose a five- or six-ship fleet.");
  return count === 6 ? extendedFleet : fleet;
}
export function shipCells(index, length, vertical) {
  const row = Math.floor(index / 10),
    col = index % 10;
  if (
    !Number.isInteger(index) || !Number.isInteger(length) || length < 1 || length > 10 ||
    index < 0 ||
    index >= 100 ||
    (vertical ? row + length > 10 : col + length > 10)
  )
    return [];
  return Array.from({ length }, (_, i) => index + i * (vertical ? 10 : 1));
}
export function placementLegal(ships, cells) {
  return (
    cells.length > 0 &&
    !ships.some((ship) => ship.cells.some((i) => cells.includes(i)))
  );
}
export function randomFleet(s) {
  const ships = [];
  for (const f of fleetFor(s.fleetSize ?? 5)) {
    let cells = [];
    do {
      cells = shipCells(Math.floor(random(s) * 100), f.length, random(s) < 0.5);
    } while (!placementLegal(ships, cells));
    ships.push({ ...f, cells });
  }
  return ships;
}
export function create(seed = 1, fleetSize = 5) {
  fleetFor(fleetSize);
  const s = {
    ...initial(seed),
    phase: "placement",
    fleetSize,
    sunk: [[], []],
    winner: null,
    shotHistory: [],
    ships: [[], []],
    shots: [Array(100).fill(null), Array(100).fill(null)],
    ready: [false, false],
    turn: 0,
  };
  s.ships[1] = randomFleet(s);
  log(
    s,
    `Place your ${fleetSize} ships, then deploy. Rotate between horizontal and vertical.`,
  );
  return s;
}
export function isSunk(ship, shots) {
  return ship.cells.every((i) => shots[i] === "hit");
}
export function apply(s, a) {
  return reduce(s, a, (n, a) => {
    requireThat(!n.over, "Match finished.");
    const p = a.player ?? n.turn;
    requireThat(p === 0 || p === 1, "Choose a valid player seat.");
    const specs = fleetFor(n.fleetSize ?? 5);
    if (a.type === "place") {
      requireThat(
        n.phase === "placement" && !n.ready[p] && n.ships[p].length < specs.length,
        "Finish ship placement before deployment.",
      );
      const f = specs[n.ships[p].length],
        cells = shipCells(a.index, f.length, !!a.vertical);
      requireThat(
        placementLegal(n.ships[p], cells),
        "Ships must fit inside the grid without overlapping.",
      );
      n.ships[p].push({ ...f, cells });
    } else if (a.type === "clear") {
      requireThat(
        n.phase === "placement" && !n.ready[p],
        "Placement is locked.",
      );
      n.ships[p] = [];
    } else if (a.type === "auto") {
      requireThat(
        n.phase === "placement" && !n.ready[p],
        "Placement is locked.",
      );
      n.ships[p] = randomFleet(n);
    } else if (a.type === "ready") {
      requireThat(
        n.phase === "placement" && !n.ready[p] && n.ships[p].length === specs.length,
        `Place all ${specs.length} ships before deploying.`,
      );
      n.ready[p] = true;
      if (n.ready.every(Boolean)) {
        n.phase = "play";
        n.turn = 0;
        log(n, "Fleets deployed. South fires first.");
      }
    } else if (a.type === "fire") {
      requireThat(n.phase === "play" && p === n.turn, "Wait for your turn.");
      requireThat(
        Number.isInteger(a.index) &&
          a.index >= 0 &&
          a.index < 100 &&
          n.shots[p][a.index] === null,
        "Choose an untried coordinate.",
      );
      const ship = n.ships[1 - p].find((ship) => ship.cells.includes(a.index));
      n.shots[p][a.index] = ship ? "hit" : "miss";
      const sunk = !!ship && isSunk(ship, n.shots[p]);
      n.sunk ??= [[], []];
      if (sunk) n.sunk[1 - p].push({name: ship.name, cells: [...ship.cells]});
      n.shotHistory ??= [];
      n.shotHistory.push({number: n.shotHistory.length + 1, player: p, index: a.index, result: ship ? "hit" : "miss", sunk: sunk ? ship.name : null});
      const coord =
        String.fromCharCode(65 + Math.floor(a.index / 10)) +
        ((a.index % 10) + 1);
      log(
        n,
        `${p === 0 ? "South" : "North"} fires ${coord}: ${ship ? (isSunk(ship, n.shots[p]) ? ship.name + " sunk" : "hit") : "miss"}.`,
      );
      if (n.ships[1 - p].every((ship) => isSunk(ship, n.shots[p]))) {
        n.winner = p;
        n.scores = p === 0 ? [1, 0] : [0, 1];
        finish(
          n,
          `${p === 0 ? "South" : "North"} wins — enemy fleet destroyed.`,
        );
        return;
      }
      n.turn = 1 - p;
    } else throw new Error("Unknown action.");
  });
}
export function bot(s, p = s.turn) {
  if (s.over) return null;
  if (s.phase === "placement") return { type: s.ships[p].length < (s.fleetSize ?? 5) ? "auto" : "ready", player: p };
  const shots = s.shots[p],
    sunk = new Set(
      (s.sunk?.[1 - p] || []).flatMap((ship) => ship.cells),
    );
  const targets = [];
  shots.forEach((v, i) => {
    if (v !== "hit" || sunk.has(i)) return;
    const r = Math.floor(i / 10),
      c = i % 10;
    for (const j of [
      r > 0 ? i - 10 : -1,
      r < 9 ? i + 10 : -1,
      c > 0 ? i - 1 : -1,
      c < 9 ? i + 1 : -1,
    ])
      if (j >= 0 && shots[j] === null) targets.push(j);
  });
  const unknown = shots
      .map((v, i) => (v === null ? i : -1))
      .filter((i) => i >= 0),
    hunt = unknown.filter((i) => (Math.floor(i / 10) + (i % 10)) % 2 === 0);
  const pool = targets.length ? targets : hunt.length ? hunt : unknown;
  return {
    type: "fire",
    index: pool[Math.floor(random(s) * pool.length)],
    player: p,
  };
}
