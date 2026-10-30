/**
 * Imperial Campaign d20 math.
 *
 * Server-only module: import from Supabase Edge Functions, never from browser code.
 * The caller must load authoritative character and target values before resolving.
 */
export type D20Kind = "check" | "save" | "attack";

export interface D20TestInput {
  kind: D20Kind;
  abilityScore: number;
  characterLevel: number;
  proficient: boolean;
  targetNumber: number;
  advantage?: boolean;
  disadvantage?: boolean;
  flatBonus?: number;
}

export interface D20TestResult {
  kind: D20Kind;
  rolls: number[];
  selectedRoll: number;
  abilityModifier: number;
  proficiencyBonus: number;
  proficiencyApplied: number;
  flatBonus: number;
  total: number;
  targetNumber: number;
  success: boolean;
  criticalHit: boolean;
  automaticMiss: boolean;
}

const integerInRange = (name: string, value: unknown, min: number, max: number): number => {
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) {
    throw new TypeError(`${name} must be an integer from ${min} to ${max}`);
  }
  return value as number;
};

/**
 * Uniform integer in [0, upperExclusive), using rejection sampling to avoid modulo bias.
 */
export function secureRandomInt(upperExclusive: number): number {
  integerInRange("upperExclusive", upperExclusive, 1, 1_000_000);
  const range = 0x1_0000_0000;
  const cutoff = Math.floor(range / upperExclusive) * upperExclusive;
  const sample = new Uint32Array(1);

  for (let attempt = 0; attempt < 128; attempt += 1) {
    globalThis.crypto.getRandomValues(sample);
    const value = sample[0];
    if (value < cutoff) return value % upperExclusive;
  }

  throw new Error("Secure random sampling failed");
}

/** Standard ability modifier, rounding down for negative halves. */
export function abilityModifier(score: number): number {
  integerInRange("abilityScore", score, 1, 30);
  return Math.floor((score - 10) / 2);
}

/** Level progression: +2 at levels 1–4, then +1 every four levels, capped at +6. */
export function proficiencyBonus(level: number): number {
  integerInRange("characterLevel", level, 1, 20);
  return Math.min(6, 2 + Math.floor((level - 1) / 4));
}

/**
 * Resolve one ability check, saving throw, or attack roll.
 * If advantage and disadvantage are both present, they cancel and one die is rolled.
 * For attacks only, a selected natural 20 is a critical hit and a selected natural 1 misses.
 */
export function resolveD20Test(
  input: D20TestInput,
  randomInt: (upperExclusive: number) => number = secureRandomInt,
): D20TestResult {
  if (!input || !["check", "save", "attack"].includes(input.kind)) {
    throw new TypeError("kind must be check, save, or attack");
  }
  if (typeof input.proficient !== "boolean") {
    throw new TypeError("proficient must be a boolean");
  }

  const ability = abilityModifier(input.abilityScore);
  const baseProficiency = proficiencyBonus(input.characterLevel);
  const appliedProficiency = input.proficient ? baseProficiency : 0;
  const flatBonus = integerInRange("flatBonus", input.flatBonus ?? 0, -100, 100);
  const targetNumber = integerInRange("targetNumber", input.targetNumber, 1, 1000);
  const advantage = input.advantage === true;
  const disadvantage = input.disadvantage === true;
  const rollCount = advantage === disadvantage ? 1 : 2;

  const rolls = Array.from({ length: rollCount }, () => {
    const value = randomInt(20);
    if (!Number.isSafeInteger(value) || value < 0 || value > 19) {
      throw new RangeError("randomInt must return an integer from 0 to 19");
    }
    return value + 1;
  });

  const selectedRoll = advantage && !disadvantage
    ? Math.max(...rolls)
    : disadvantage && !advantage
      ? Math.min(...rolls)
      : rolls[0];

  const total = selectedRoll + ability + appliedProficiency + flatBonus;
  const automaticMiss = input.kind === "attack" && selectedRoll === 1;
  const criticalHit = input.kind === "attack" && selectedRoll === 20;
  const success = input.kind === "attack"
    ? !automaticMiss && (criticalHit || total >= targetNumber)
    : total >= targetNumber;

  return {
    kind: input.kind,
    rolls,
    selectedRoll,
    abilityModifier: ability,
    proficiencyBonus: baseProficiency,
    proficiencyApplied: appliedProficiency,
    flatBonus,
    total,
    targetNumber,
    success,
    criticalHit,
    automaticMiss,
  };
}
