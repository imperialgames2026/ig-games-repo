/**
 * Server-side weapon attack and damage resolution.
 *
 * Call only after the trusted action handler loads authoritative actor, weapon,
 * target, range, turn, and encounter values. This module does not persist state.
 */
import { resolveD20Test, secureRandomInt, type D20TestResult } from "./rules.ts";

export interface WeaponAttackInput {
  attackerLevel: number;
  attackAbilityScore: number;
  proficientWithWeapon: boolean;
  attackFlatBonus?: number;
  advantage?: boolean;
  disadvantage?: boolean;
  targetArmorClass: number;
  distanceFeet: number;
  weaponRangeFeet: number;
  weaponId: string;
  damageDiceCount: number;
  damageDieSides: number;
  damageAbilityModifier: number;
  damageFlatBonus?: number;
}

export interface WeaponAttackResult {
  rulesVersion: "imperial-d20-v1";
  weaponId: string;
  attack: D20TestResult;
  damageDice: number[];
  damageAbilityModifier: number;
  damageFlatBonus: number;
  damage: number;
  targetArmorClass: number;
  hit: boolean;
  criticalHit: boolean;
}

const integerInRange = (name: string, value: unknown, min: number, max: number): number => {
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) {
    throw new TypeError(`${name} must be an integer from ${min} to ${max}`);
  }
  return value as number;
};

/**
 * Resolve one weapon attack. Natural 1/20 behavior comes from resolveD20Test.
 * Critical attacks roll weapon damage dice twice; flat modifiers apply once.
 */
export function resolveWeaponAttack(
  input: WeaponAttackInput,
  randomInt: (upperExclusive: number) => number = secureRandomInt,
): WeaponAttackResult {
  if (!input || typeof input.weaponId !== "string" || input.weaponId.trim().length === 0) {
    throw new TypeError("weaponId must be a non-empty string");
  }
  if (typeof input.proficientWithWeapon !== "boolean") {
    throw new TypeError("proficientWithWeapon must be a boolean");
  }

  const attackerLevel = integerInRange("attackerLevel", input.attackerLevel, 1, 20);
  const attackFlatBonus = integerInRange("attackFlatBonus", input.attackFlatBonus ?? 0, -100, 100);
  const targetArmorClass = integerInRange("targetArmorClass", input.targetArmorClass, 1, 1000);
  const distanceFeet = integerInRange("distanceFeet", input.distanceFeet, 0, 100_000);
  const weaponRangeFeet = integerInRange("weaponRangeFeet", input.weaponRangeFeet, 1, 100_000);
  const damageDiceCount = integerInRange("damageDiceCount", input.damageDiceCount, 1, 20);
  const damageDieSides = integerInRange("damageDieSides", input.damageDieSides, 2, 100);
  const damageAbilityModifier = integerInRange("damageAbilityModifier", input.damageAbilityModifier, -100, 100);
  const damageFlatBonus = integerInRange("damageFlatBonus", input.damageFlatBonus ?? 0, -100, 100);

  if (distanceFeet > weaponRangeFeet) {
    throw new RangeError("Target is outside weapon range");
  }

  const attack = resolveD20Test(
    {
      kind: "attack",
      abilityScore: input.attackAbilityScore,
      characterLevel: attackerLevel,
      proficient: input.proficientWithWeapon,
      targetNumber: targetArmorClass,
      advantage: input.advantage,
      disadvantage: input.disadvantage,
      flatBonus: attackFlatBonus,
    },
    randomInt,
  );

  const criticalHit = attack.criticalHit;
  const damageDice = attack.success
    ? Array.from({ length: damageDiceCount * (criticalHit ? 2 : 1) }, () => {
        const roll = randomInt(damageDieSides);
        if (!Number.isSafeInteger(roll) || roll < 0 || roll >= damageDieSides) {
          throw new RangeError(`randomInt must return an integer from 0 to ${damageDieSides - 1}`);
        }
        return roll + 1;
      })
    : [];

  const damage = attack.success
    ? Math.max(0, damageDice.reduce((sum, roll) => sum + roll, 0) + damageAbilityModifier + damageFlatBonus)
    : 0;

  return {
    rulesVersion: "imperial-d20-v1",
    weaponId: input.weaponId,
    attack,
    damageDice,
    damageAbilityModifier: attack.success ? damageAbilityModifier : 0,
    damageFlatBonus: attack.success ? damageFlatBonus : 0,
    damage,
    targetArmorClass,
    hit: attack.success,
    criticalHit,
  };
}
