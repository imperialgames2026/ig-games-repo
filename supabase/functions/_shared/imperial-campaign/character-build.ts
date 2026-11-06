/**
 * Original Imperial Campaign character build and skill compatibility rules.
 *
 * This module validates server-loaded content and player build choices. NFT
 * ownership and transfers are deliberately handled by a later asset service.
 */
import type { AbilityName } from "./encounter-actions.ts";

export type SkillFamily =
  | "MARTIAL"
  | "ARCANE"
  | "OATH"
  | "DIVINE"
  | "FIELD"
  | "ALCHEMY"
  | "SCHOLAR";

export interface SkillDefinition {
  id: string;
  name: string;
  ability: AbilityName;
  family: SkillFamily;
  subskills: string[];
}

export interface OriginDefinition {
  id: string;
  name: string;
  compatibilitySymbols: SkillFamily[];
  description: string;
}

export interface ArchetypeDefinition {
  id: string;
  name: string;
  hitDie: 6 | 8 | 10;
  primaryAbilities: AbilityName[];
  compatibilitySymbols: SkillFamily[];
  selectableSkills: string[];
  description: string;
}

export interface CharacterBuildInput {
  name: string;
  originId: string;
  archetypeId: string;
  abilityScores: Record<AbilityName, number>;
  proficientSkills: string[];
  level?: number;
}

export interface ValidatedCharacterBuild extends CharacterBuildInput {
  level: number;
  compatibilitySymbols: SkillFamily[];
}

export interface SkillAddonDefinition {
  id: string;
  name: string;
  family: SkillFamily;
  requiredLevel: number;
  abilityId: string;
  compatibleArchetypes?: string[];
  description: string;
}

export interface SkillAddonCompatibility {
  compatible: boolean;
  reason: "compatible" | "missing_family_symbol" | "level_too_low" | "wrong_archetype" | "already_equipped";
}

export const IMPERIAL_STARTING_ABILITY_ARRAY = [15, 14, 13, 12, 10, 8] as const;

export const IMPERIAL_SKILLS: readonly SkillDefinition[] = [
  { id: "acrobatics", name: "Acrobatics", ability: "dexterity", family: "FIELD", subskills: ["balance", "tumbling"] },
  { id: "arcana", name: "Arcana", ability: "intelligence", family: "ARCANE", subskills: ["runes", "arcane_creatures"] },
  { id: "athletics", name: "Athletics", ability: "strength", family: "MARTIAL", subskills: ["climbing", "swimming", "lifting"] },
  { id: "foraging", name: "Foraging", ability: "wisdom", family: "ALCHEMY", subskills: ["herbs", "minerals", "fungi"] },
  { id: "insight", name: "Insight", ability: "wisdom", family: "FIELD", subskills: ["intent", "composure"] },
  { id: "lore", name: "Lore", ability: "intelligence", family: "SCHOLAR", subskills: ["history", "customs", "maps"] },
  { id: "medicine", name: "Medicine", ability: "wisdom", family: "DIVINE", subskills: ["first_aid", "diagnosis"] },
  { id: "perception", name: "Perception", ability: "wisdom", family: "FIELD", subskills: ["hearing", "tracking_signs"] },
  { id: "persuasion", name: "Persuasion", ability: "charisma", family: "OATH", subskills: ["negotiate", "inspire"] },
  { id: "stealth", name: "Stealth", ability: "dexterity", family: "FIELD", subskills: ["hide", "move_silently"] },
  { id: "survival", name: "Survival", ability: "wisdom", family: "FIELD", subskills: ["navigation", "tracking", "weather"] },
  { id: "alchemy", name: "Alchemy", ability: "intelligence", family: "ALCHEMY", subskills: ["potions", "poisons", "reagents"] },
];

export const IMPERIAL_ORIGINS: readonly OriginDefinition[] = [
  { id: "ridgeborn", name: "Ridgeborn", compatibilitySymbols: ["FIELD", "MARTIAL"], description: "Raised among high passes and hard trails." },
  { id: "tideborn", name: "Tideborn", compatibilitySymbols: ["FIELD", "ALCHEMY"], description: "Raised among shifting coasts and working harbors." },
  { id: "emberkin", name: "Emberkin", compatibilitySymbols: ["ARCANE", "SCHOLAR"], description: "A lineage associated with old fire and unusual study." },
  { id: "stonebound", name: "Stonebound", compatibilitySymbols: ["OATH", "MARTIAL"], description: "A lineage shaped by steadfast craft and sworn duty." },
];

export const IMPERIAL_ARCHETYPES: readonly ArchetypeDefinition[] = [
  {
    id: "vanguard",
    name: "Vanguard",
    hitDie: 10,
    primaryAbilities: ["strength", "constitution"],
    compatibilitySymbols: ["MARTIAL", "FIELD"],
    selectableSkills: ["athletics", "insight", "perception", "survival"],
    description: "A durable front-line fighter who protects space and controls threats.",
  },
  {
    id: "spellweaver",
    name: "Spellweaver",
    hitDie: 6,
    primaryAbilities: ["intelligence", "charisma"],
    compatibilitySymbols: ["ARCANE", "SCHOLAR"],
    selectableSkills: ["arcana", "insight", "lore", "perception"],
    description: "A flexible caster who shapes a small set of learned magical abilities.",
  },
  {
    id: "oathkeeper",
    name: "Oathkeeper",
    hitDie: 10,
    primaryAbilities: ["strength", "charisma"],
    compatibilitySymbols: ["MARTIAL", "OATH", "DIVINE"],
    selectableSkills: ["athletics", "insight", "medicine", "persuasion"],
    description: "A sworn defender whose vows support allies and punish threats.",
  },
  {
    id: "wildscout",
    name: "Wildscout",
    hitDie: 8,
    primaryAbilities: ["dexterity", "wisdom"],
    compatibilitySymbols: ["FIELD", "MARTIAL", "ALCHEMY"],
    selectableSkills: ["acrobatics", "foraging", "perception", "stealth", "survival"],
    description: "A mobile explorer skilled at finding routes, resources, and openings.",
  },
];

export const IMPERIAL_SKILL_ADDONS: readonly SkillAddonDefinition[] = [
  {
    id: "arcane_spark",
    name: "Arcane Spark",
    family: "ARCANE",
    requiredLevel: 1,
    abilityId: "spark_burst",
    compatibleArchetypes: ["spellweaver"],
    description: "Unlocks a short-range magical attack.",
  },
  {
    id: "oath_ward",
    name: "Oath Ward",
    family: "OATH",
    requiredLevel: 1,
    abilityId: "guarding_vow",
    compatibleArchetypes: ["oathkeeper"],
    description: "Unlocks a defensive action that can protect a nearby ally.",
  },
  {
    id: "field_medic",
    name: "Field Medic",
    family: "DIVINE",
    requiredLevel: 1,
    abilityId: "field_treatment",
    compatibleArchetypes: ["oathkeeper", "vanguard"],
    description: "Unlocks a limited-use recovery action.",
  },
  {
    id: "reagent_lore",
    name: "Reagent Lore",
    family: "ALCHEMY",
    requiredLevel: 1,
    abilityId: "identify_reagent",
    compatibleArchetypes: ["wildscout"],
    description: "Unlocks identification of common alchemy materials.",
  },
];

const ABILITY_NAMES: readonly AbilityName[] = [
  "strength",
  "dexterity",
  "constitution",
  "intelligence",
  "wisdom",
  "charisma",
];

const skillById = (id: string): SkillDefinition | undefined =>
  IMPERIAL_SKILLS.find((skill) => skill.id === id);

const originById = (id: string): OriginDefinition | undefined =>
  IMPERIAL_ORIGINS.find((origin) => origin.id === id);

const archetypeById = (id: string): ArchetypeDefinition | undefined =>
  IMPERIAL_ARCHETYPES.find((archetype) => archetype.id === id);

/**
 * Validate a level-one build using the Imperial starting score array.
 * Players assign those six values to abilities and select two archetype skills.
 */
export function validateCharacterBuild(input: CharacterBuildInput): ValidatedCharacterBuild {
  if (!input || typeof input.name !== "string" || input.name.trim().length < 1 || input.name.trim().length > 32) {
    throw new TypeError("Character name must contain 1 to 32 characters");
  }

  const origin = originById(input.originId);
  const archetype = archetypeById(input.archetypeId);
  if (!origin || !archetype) {
    throw new TypeError("Origin or archetype is not in the published campaign catalog");
  }

  if (!input.abilityScores || typeof input.abilityScores !== "object") {
    throw new TypeError("Ability scores are required");
  }
  const assignedScores = ABILITY_NAMES.map((ability) => input.abilityScores[ability]).sort((a, b) => a - b);
  const startingScores = [...IMPERIAL_STARTING_ABILITY_ARRAY].sort((a, b) => a - b);
  if (
    assignedScores.some((score) => !Number.isSafeInteger(score)) ||
    assignedScores.some((score, index) => score !== startingScores[index])
  ) {
    throw new RangeError("Assign each value from the Imperial starting ability array exactly once");
  }

  const level = input.level ?? 1;
  if (!Number.isSafeInteger(level) || level !== 1) {
    throw new RangeError("Character creation starts at level 1");
  }
  if (!Array.isArray(input.proficientSkills) || input.proficientSkills.length !== 2) {
    throw new RangeError("Choose exactly two archetype skills");
  }

  const selected = new Set(input.proficientSkills);
  if (
    selected.size !== input.proficientSkills.length ||
    input.proficientSkills.some((id) => !archetype.selectableSkills.includes(id) || !skillById(id))
  ) {
    throw new TypeError("Choose two different skills allowed by the selected archetype");
  }

  const compatibilitySymbols = [...new Set([...origin.compatibilitySymbols, ...archetype.compatibilitySymbols])];
  return {
    ...input,
    name: input.name.trim(),
    level,
    proficientSkills: [...input.proficientSkills],
    compatibilitySymbols,
  };
}

/**
 * Check whether a skill add-on can attach to the character's compatibility
 * symbols. The same family symbol can later be printed on an NFT profile.
 */
export function checkSkillAddonCompatibility(
  character: Pick<ValidatedCharacterBuild, "archetypeId" | "level" | "compatibilitySymbols">,
  addon: SkillAddonDefinition,
  equippedAddonIds: readonly string[] = [],
): SkillAddonCompatibility {
  if (equippedAddonIds.includes(addon.id)) {
    return { compatible: false, reason: "already_equipped" };
  }
  if (character.level < addon.requiredLevel) {
    return { compatible: false, reason: "level_too_low" };
  }
  if (addon.compatibleArchetypes && !addon.compatibleArchetypes.includes(character.archetypeId)) {
    return { compatible: false, reason: "wrong_archetype" };
  }
  if (!character.compatibilitySymbols.includes(addon.family)) {
    return { compatible: false, reason: "missing_family_symbol" };
  }
  return { compatible: true, reason: "compatible" };
}
