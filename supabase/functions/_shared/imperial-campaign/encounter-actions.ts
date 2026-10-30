/**
 * Server-side validation and state transition for player encounter actions.
 *
 * The Edge Function must load this state from trusted storage and pass the
 * authenticated user ID. The browser never supplies the active actor or rolls.
 */
import { abilityModifier, secureRandomInt } from "./rules.ts";
import { resolveWeaponAttack } from "./combat.ts";

export type AbilityName = "strength" | "dexterity" | "constitution" | "intelligence" | "wisdom" | "charisma";
export type Team = "heroes" | "hostiles";

export interface GridPosition {
  x: number;
  y: number;
}

export interface WeaponDefinition {
  id: string;
  attackAbility: AbilityName;
  damageAbility: AbilityName;
  proficient: boolean;
  attackFlatBonus: number;
  damageFlatBonus: number;
  rangeFeet: number;
  damageDiceCount: number;
  damageDieSides: number;
}

export interface EncounterCombatant {
  id: string;
  ownerUserId: string | null;
  team: Team;
  name: string;
  level: number;
  abilities: Record<AbilityName, number>;
  armorClass: number;
  hitPoints: number;
  maxHitPoints: number;
  position: GridPosition;
  movementPerTurnFeet: number;
  movementRemainingFeet: number;
  actionUsed: boolean;
  weapon: WeaponDefinition | null;
}

export interface EncounterMap {
  width: number;
  height: number;
  tileSizeFeet: number;
  blockedCells: string[];
}

export interface EncounterState {
  id: string;
  revision: number;
  phase: "active" | "awaiting_server_turn" | "completed";
  outcome: "heroes_win" | "hostiles_win" | null;
  map: EncounterMap;
  turnOrder: string[];
  activeTurnIndex: number;
  combatants: EncounterCombatant[];
}

export type PlayerEncounterAction =
  | { type: "move"; path: GridPosition[] }
  | { type: "attack"; targetId: string }
  | { type: "end_turn" };

export interface EncounterEvent {
  kind: PlayerEncounterAction["type"] | "hostile_turn";
  encounterId: string;
  revisionBefore: number;
  revisionAfter: number;
  actorId: string;
  detail: Record<string, unknown>;
}

export interface EncounterActionResult {
  state: EncounterState;
  event: EncounterEvent;
}

export type EncounterActionErrorCode =
  | "INVALID_STATE"
  | "STALE_REVISION"
  | "NOT_PLAYERS_TURN"
  | "INVALID_ACTION"
  | "INVALID_PATH"
  | "INSUFFICIENT_MOVEMENT"
  | "ACTION_ALREADY_USED"
  | "INVALID_TARGET"
  | "NO_WEAPON"
  | "ENCOUNTER_COMPLETE";

export class EncounterActionError extends Error {
  constructor(
    public readonly code: EncounterActionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "EncounterActionError";
  }
}

const fail = (code: EncounterActionErrorCode, message: string): never => {
  throw new EncounterActionError(code, message);
};

const cellKey = (position: GridPosition): string => `${position.x},${position.y}`;

const copyState = (state: EncounterState): EncounterState => ({
  ...state,
  map: { ...state.map, blockedCells: [...state.map.blockedCells] },
  turnOrder: [...state.turnOrder],
  combatants: state.combatants.map((combatant) => ({
    ...combatant,
    abilities: { ...combatant.abilities },
    position: { ...combatant.position },
    weapon: combatant.weapon ? { ...combatant.weapon } : null,
  })),
});

const living = (combatant: EncounterCombatant): boolean => combatant.hitPoints > 0;

const activeCombatant = (state: EncounterState): EncounterCombatant | undefined => {
  const activeId = state.turnOrder[state.activeTurnIndex];
  return state.combatants.find((combatant) => combatant.id === activeId);
};

const combatantById = (state: EncounterState, id: string): EncounterCombatant | undefined =>
  state.combatants.find((combatant) => combatant.id === id);

const assertState = (state: EncounterState): void => {
  if (
    !state ||
    typeof state.id !== "string" ||
    state.id.length === 0 ||
    !Number.isSafeInteger(state.revision) ||
    state.revision < 0 ||
    !["active", "awaiting_server_turn", "completed"].includes(state.phase) ||
    !state.map ||
    !Number.isSafeInteger(state.map.width) ||
    !Number.isSafeInteger(state.map.height) ||
    state.map.width < 1 ||
    state.map.height < 1 ||
    !Number.isSafeInteger(state.map.tileSizeFeet) ||
    state.map.tileSizeFeet < 1 ||
    !Array.isArray(state.map.blockedCells) ||
    !Array.isArray(state.turnOrder) ||
    !Array.isArray(state.combatants) ||
    state.turnOrder.length === 0 ||
    state.combatants.length === 0 ||
    !Number.isSafeInteger(state.activeTurnIndex) ||
    state.activeTurnIndex < 0 ||
    state.activeTurnIndex >= state.turnOrder.length
  ) {
    fail("INVALID_STATE", "Encounter state is malformed");
  }

  const ids = new Set(state.combatants.map(({ id }) => id));
  if (
    ids.size !== state.combatants.length ||
    new Set(state.turnOrder).size !== state.turnOrder.length ||
    state.turnOrder.length !== state.combatants.length ||
    state.turnOrder.some((id) => !ids.has(id))
  ) {
    fail("INVALID_STATE", "Encounter combatant IDs or turn order are invalid");
  }

  const teams = new Set(state.combatants.map(({ team }) => team));
  if (!teams.has("heroes") || !teams.has("hostiles")) {
    fail("INVALID_STATE", "An encounter must include heroes and hostiles");
  }
  if (
    (state.phase === "completed" && state.outcome === null) ||
    (state.phase !== "completed" && state.outcome !== null)
  ) {
    fail("INVALID_STATE", "Encounter phase and outcome do not match");
  }

  for (const combatant of state.combatants) {
    if (
      typeof combatant.id !== "string" ||
      combatant.id.length === 0 ||
      !["heroes", "hostiles"].includes(combatant.team) ||
      (combatant.ownerUserId !== null && typeof combatant.ownerUserId !== "string") ||
      !Number.isSafeInteger(combatant.level) ||
      combatant.level < 1 ||
      combatant.level > 20 ||
      !Number.isSafeInteger(combatant.armorClass) ||
      combatant.armorClass < 1 ||
      !Number.isSafeInteger(combatant.maxHitPoints) ||
      combatant.maxHitPoints < 1 ||
      !Number.isSafeInteger(combatant.hitPoints) ||
      combatant.hitPoints < 0 ||
      combatant.hitPoints > combatant.maxHitPoints ||
      !Number.isSafeInteger(combatant.movementPerTurnFeet) ||
      combatant.movementPerTurnFeet < 0 ||
      !Number.isSafeInteger(combatant.movementRemainingFeet) ||
      combatant.movementRemainingFeet < 0 ||
      combatant.movementRemainingFeet > combatant.movementPerTurnFeet ||
      typeof combatant.actionUsed !== "boolean"
    ) {
      fail("INVALID_STATE", "Encounter combatant values are malformed");
    }
    validatePosition(combatant.position, state.map);
    for (const score of Object.values(combatant.abilities)) {
      if (!Number.isSafeInteger(score) || score < 1 || score > 30) {
        fail("INVALID_STATE", "Encounter ability scores are malformed");
      }
    }
  }
};

const validatePosition = (position: GridPosition, map: EncounterMap): void => {
  if (
    !position ||
    !Number.isSafeInteger(position.x) ||
    !Number.isSafeInteger(position.y) ||
    position.x < 0 ||
    position.y < 0 ||
    position.x >= map.width ||
    position.y >= map.height
  ) {
    fail("INVALID_PATH", "Position is outside the encounter map");
  }
};

const findNextLivingTurnIndex = (state: EncounterState, fromIndex: number): number => {
  for (let offset = 1; offset <= state.turnOrder.length; offset += 1) {
    const index = (fromIndex + offset) % state.turnOrder.length;
    const next = combatantById(state, state.turnOrder[index]);
    if (next && living(next)) return index;
  }
  return fromIndex;
};

const finishIfEncounterOver = (state: EncounterState): void => {
  const heroesAlive = state.combatants.some((combatant) => combatant.team === "heroes" && living(combatant));
  const hostilesAlive = state.combatants.some((combatant) => combatant.team === "hostiles" && living(combatant));
  if (!hostilesAlive) {
    state.phase = "completed";
    state.outcome = "heroes_win";
  } else if (!heroesAlive) {
    state.phase = "completed";
    state.outcome = "hostiles_win";
  }
};

/**
 * Apply a player-intent action to a trusted encounter snapshot.
 * Persistence, idempotency, row locking, and immutable event insertion belong
 * in the caller's single database transaction.
 */
export function resolvePlayerEncounterAction(
  current: EncounterState,
  authenticatedUserId: string,
  expectedRevision: number,
  action: PlayerEncounterAction,
  randomInt: (upperExclusive: number) => number = secureRandomInt,
): EncounterActionResult {
  assertState(current);

  if (current.phase === "completed") {
    fail("ENCOUNTER_COMPLETE", "Encounter is already complete");
  }
  if (current.phase !== "active") {
    fail("NOT_PLAYERS_TURN", "Encounter is waiting for a server-controlled turn");
  }
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision !== current.revision) {
    fail("STALE_REVISION", "Encounter revision is stale");
  }
  if (!authenticatedUserId || typeof authenticatedUserId !== "string") {
    fail("NOT_PLAYERS_TURN", "Authenticated player identity is required");
  }

  const actor = activeCombatant(current);
  if (!actor || !living(actor) || actor.ownerUserId !== authenticatedUserId || actor.team !== "heroes") {
    fail("NOT_PLAYERS_TURN", "Authenticated player does not control the active hero");
  }
  if (!action || !["move", "attack", "end_turn"].includes(action.type)) {
    fail("INVALID_ACTION", "Action type is not supported");
  }

  const next = copyState(current);
  const nextActor = combatantById(next, actor.id)!;
  const revisionBefore = next.revision;
  let detail: Record<string, unknown> = {};

  if (action.type === "move") {
    if (!Array.isArray(action.path) || action.path.length === 0 || action.path.length > 200) {
      fail("INVALID_PATH", "Movement path must contain between 1 and 200 cells");
    }

    const blocked = new Set(next.map.blockedCells);
    const occupied = new Set(
      next.combatants.filter((c) => living(c) && c.id !== nextActor.id).map((c) => cellKey(c.position)),
    );
    let previous = nextActor.position;
    let distanceFeet = 0;

    for (const position of action.path) {
      validatePosition(position, next.map);
      const stepDistance = Math.abs(position.x - previous.x) + Math.abs(position.y - previous.y);
      if (stepDistance !== 1 || blocked.has(cellKey(position)) || occupied.has(cellKey(position))) {
        fail("INVALID_PATH", "Movement path crosses an invalid or occupied cell");
      }
      distanceFeet += next.map.tileSizeFeet;
      previous = position;
    }

    if (distanceFeet > nextActor.movementRemainingFeet) {
      fail("INSUFFICIENT_MOVEMENT", "Movement exceeds the hero's remaining movement");
    }

    nextActor.position = { ...previous };
    nextActor.movementRemainingFeet -= distanceFeet;
    detail = {
      path: action.path.map((position) => ({ ...position })),
      distanceFeet,
      movementRemainingFeet: nextActor.movementRemainingFeet,
    };
  } else if (action.type === "attack") {
    if (nextActor.actionUsed) {
      fail("ACTION_ALREADY_USED", "The hero has already used an action this turn");
    }
    const target = combatantById(next, action.targetId);
    if (!target || !living(target) || target.team === nextActor.team || !nextActor.weapon) {
      fail("INVALID_TARGET", "Target is invalid or the hero has no usable weapon");
    }

    const distanceFeet =
      (Math.abs(nextActor.position.x - target.position.x) +
        Math.abs(nextActor.position.y - target.position.y)) *
      next.map.tileSizeFeet;

    const attack = resolveWeaponAttack(
      {
        attackerLevel: nextActor.level,
        attackAbilityScore: nextActor.abilities[nextActor.weapon.attackAbility],
        proficientWithWeapon: nextActor.weapon.proficient,
        attackFlatBonus: nextActor.weapon.attackFlatBonus,
        targetArmorClass: target.armorClass,
        distanceFeet,
        weaponRangeFeet: nextActor.weapon.rangeFeet,
        weaponId: nextActor.weapon.id,
        damageDiceCount: nextActor.weapon.damageDiceCount,
        damageDieSides: nextActor.weapon.damageDieSides,
        damageAbilityModifier: abilityModifier(nextActor.abilities[nextActor.weapon.damageAbility]),
        damageFlatBonus: nextActor.weapon.damageFlatBonus,
      },
      randomInt,
    );

    nextActor.actionUsed = true;
    const targetHpBefore = target.hitPoints;
    target.hitPoints = Math.max(0, target.hitPoints - attack.damage);
    finishIfEncounterOver(next);
    detail = {
      targetId: target.id,
      targetHpBefore,
      targetHpAfter: target.hitPoints,
      attack,
      outcome: target.hitPoints === 0 ? "target_down" : attack.hit ? "hit" : "miss",
    };
  } else {
    const nextIndex = findNextLivingTurnIndex(next, next.activeTurnIndex);
    if (nextIndex === next.activeTurnIndex && !living(combatantById(next, next.turnOrder[nextIndex])!)) {
      finishIfEncounterOver(next);
    } else {
      next.activeTurnIndex = nextIndex;
      const followingActor = combatantById(next, next.turnOrder[nextIndex])!;
      followingActor.movementRemainingFeet = followingActor.movementPerTurnFeet;
      followingActor.actionUsed = false;
      next.phase = followingActor.team === "heroes" ? "active" : "awaiting_server_turn";
      detail = { nextActorId: followingActor.id, serverTurnRequired: next.phase === "awaiting_server_turn" };
    }
    if (Object.keys(detail).length === 0) detail = { nextActorId: null, serverTurnRequired: false };
  }

  next.revision += 1;
  const event: EncounterEvent = {
    kind: action.type,
    encounterId: next.id,
    revisionBefore,
    revisionAfter: next.revision,
    actorId: actor.id,
    detail,
  };

  return { state: next, event };
}


interface PathNode {
  position: GridPosition;
  path: GridPosition[];
}

const gridDistanceFeet = (a: GridPosition, b: GridPosition, tileSizeFeet: number): number =>
  (Math.abs(a.x - b.x) + Math.abs(a.y - b.y)) * tileSizeFeet;

/**
 * Find the shortest walkable path to weapon range. When no in-range tile is
 * reachable, return a path to the closest reachable tile, with stable tie-breaks.
 */
const findHostileApproachPath = (
  state: EncounterState,
  actor: EncounterCombatant,
  target: EncounterCombatant,
): GridPosition[] => {
  const start = { ...actor.position };
  if (!actor.weapon || gridDistanceFeet(start, target.position, state.map.tileSizeFeet) <= actor.weapon.rangeFeet) {
    return [];
  }

  const blocked = new Set(state.map.blockedCells);
  const occupied = new Set(
    state.combatants.filter((combatant) => living(combatant) && combatant.id !== actor.id)
      .map((combatant) => cellKey(combatant.position)),
  );
  const directions = [
    { x: 0, y: -1 },
    { x: -1, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
  ];
  const queue: PathNode[] = [{ position: start, path: [] }];
  const visited = new Set([cellKey(start)]);
  let closestPath: GridPosition[] = [];
  let closestDistance = gridDistanceFeet(start, target.position, state.map.tileSizeFeet);

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const node = queue[cursor];
    const distance = gridDistanceFeet(node.position, target.position, state.map.tileSizeFeet);
    if (distance <= actor.weapon.rangeFeet) return node.path;
    if (distance < closestDistance) {
      closestDistance = distance;
      closestPath = node.path;
    }

    for (const direction of directions) {
      const position = { x: node.position.x + direction.x, y: node.position.y + direction.y };
      if (
        position.x < 0 ||
        position.y < 0 ||
        position.x >= state.map.width ||
        position.y >= state.map.height
      ) continue;

      const key = cellKey(position);
      if (visited.has(key) || blocked.has(key) || occupied.has(key)) continue;
      visited.add(key);
      queue.push({ position, path: [...node.path, position] });
    }
  }

  return closestPath;
};

/**
 * Resolve one server-controlled hostile turn. The simple first-slice behavior
 * approaches the nearest living hero and attacks when the weapon is in range.
 * The AI chooses actions only; combat math and random rolls stay in shared code.
 */
export function resolveServerHostileTurn(
  current: EncounterState,
  expectedRevision: number,
  randomInt: (upperExclusive: number) => number = secureRandomInt,
): EncounterActionResult {
  assertState(current);

  if (current.phase === "completed") {
    fail("ENCOUNTER_COMPLETE", "Encounter is already complete");
  }
  if (current.phase !== "awaiting_server_turn") {
    fail("NOT_PLAYERS_TURN", "Encounter is not waiting for a server-controlled turn");
  }
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision !== current.revision) {
    fail("STALE_REVISION", "Encounter revision is stale");
  }

  const actor = activeCombatant(current);
  if (!actor || !living(actor) || actor.team !== "hostiles" || actor.ownerUserId !== null) {
    fail("INVALID_STATE", "Active server turn is not assigned to a hostile combatant");
  }

  const next = copyState(current);
  const nextActor = combatantById(next, actor.id)!;
  const heroes = next.combatants.filter((combatant) => combatant.team === "heroes" && living(combatant));
  if (heroes.length === 0) {
    next.phase = "completed";
    next.outcome = "hostiles_win";
  }

  const target = heroes
    .slice()
    .sort((a, b) =>
      gridDistanceFeet(nextActor.position, a.position, next.map.tileSizeFeet) -
        gridDistanceFeet(nextActor.position, b.position, next.map.tileSizeFeet) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    )[0];

  const movementPath: GridPosition[] = [];
  let attack: ReturnType<typeof resolveWeaponAttack> | null = null;
  let targetHpBefore: number | null = null;

  if (target && next.phase !== "completed") {
    const proposedPath = findHostileApproachPath(next, nextActor, target);
    const maxSteps = Math.floor(nextActor.movementRemainingFeet / next.map.tileSizeFeet);
    movementPath.push(...proposedPath.slice(0, maxSteps));
    if (movementPath.length > 0) {
      const destination = movementPath[movementPath.length - 1];
      nextActor.position = { ...destination };
      const movedFeet = movementPath.length * next.map.tileSizeFeet;
      nextActor.movementRemainingFeet -= movedFeet;
    }

    const distanceFeet = gridDistanceFeet(nextActor.position, target.position, next.map.tileSizeFeet);
    if (nextActor.weapon && distanceFeet <= nextActor.weapon.rangeFeet) {
      attack = resolveWeaponAttack(
        {
          attackerLevel: nextActor.level,
          attackAbilityScore: nextActor.abilities[nextActor.weapon.attackAbility],
          proficientWithWeapon: nextActor.weapon.proficient,
          attackFlatBonus: nextActor.weapon.attackFlatBonus,
          targetArmorClass: target.armorClass,
          distanceFeet,
          weaponRangeFeet: nextActor.weapon.rangeFeet,
          weaponId: nextActor.weapon.id,
          damageDiceCount: nextActor.weapon.damageDiceCount,
          damageDieSides: nextActor.weapon.damageDieSides,
          damageAbilityModifier: abilityModifier(nextActor.abilities[nextActor.weapon.damageAbility]),
          damageFlatBonus: nextActor.weapon.damageFlatBonus,
        },
        randomInt,
      );
      targetHpBefore = target.hitPoints;
      target.hitPoints = Math.max(0, target.hitPoints - attack.damage);
      nextActor.actionUsed = true;
      finishIfEncounterOver(next);
    }
  }

  let nextActorId: string | null = null;
  if (next.phase !== "completed") {
    const nextIndex = findNextLivingTurnIndex(next, next.activeTurnIndex);
    next.activeTurnIndex = nextIndex;
    const followingActor = combatantById(next, next.turnOrder[nextIndex])!;
    followingActor.movementRemainingFeet = followingActor.movementPerTurnFeet;
    followingActor.actionUsed = false;
    next.phase = followingActor.team === "heroes" ? "active" : "awaiting_server_turn";
    nextActorId = followingActor.id;
  }

  const revisionBefore = next.revision;
  next.revision += 1;
  const event: EncounterEvent = {
    kind: "hostile_turn",
    encounterId: next.id,
    revisionBefore,
    revisionAfter: next.revision,
    actorId: actor.id,
    detail: {
      movementPath,
      targetId: target?.id ?? null,
      targetHpBefore,
      targetHpAfter: target?.hitPoints ?? null,
      attack,
      outcome: next.outcome ?? (attack?.hit ? "attack_hit" : attack ? "attack_missed" : "approach"),
      nextActorId,
      serverTurnRequired: next.phase === "awaiting_server_turn",
    },
  };

  return { state: next, event };
}
