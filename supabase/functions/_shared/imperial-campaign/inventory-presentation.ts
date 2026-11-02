/** Public display metadata. All ownership, eligibility and mutation authority stays in SQL. */
const details: Record<string, string> = {
  practice_sword: 'A one-handed training blade. Requires a Martial symbol.',
  practice_staff: 'A practice focus for an Arcane hero.',
  travel_coat: 'A sturdy travel cloak worn over your current outfit.',
  spark_rune: 'Spark Burst: 1 mana and one action, up to 30 feet. Requires Arcane and trained Arcana.',
  oath_ward: 'Guarding Vow: 1 mana and one action; +2 defense until your next turn. Requires an Oath symbol.',
  trailcraft: 'Unlocks Read Trail when equipped. Requires Field and trained Survival.',
  advanced_brewing: 'Unlocks Brew Mana after level 2 and Potions rank 2. Recipes and crafting come later.',
};
const abilityNames: Record<string, string> = {
  spark_burst: 'Spark Burst', guarding_vow: 'Guarding Vow', read_trail: 'Read Trail', brew_mana: 'Brew Mana',
};
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
export function skillRankEntries(value: unknown): { skill: string; rank: number }[] {
  if (!record(value)) return [];
  return Object.entries(value)
    .filter(([, rank]) => Number.isSafeInteger(rank) && Number(rank) >= 0)
    .map(([skill, rank]) => ({ skill, rank: Number(rank) }));
}
function character(value: unknown): unknown {
  if (!record(value) || !record(value.characterData)) return value;
  return { ...value, characterData: { ...value.characterData, skillRanksEntries: skillRankEntries(value.characterData.skillRanks) } };
}
export function presentCampaignResult(value: unknown): unknown {
  if (!record(value)) return value;
  if (Array.isArray(value.characters)) return { ...value, characters: value.characters.map(character) };
  if (record(value.character)) return { ...value, character: character(value.character) };
  if (!Array.isArray(value.items)) return value;
  return { ...value, items: value.items.map(item => {
    if (!record(item)) return item;
    const known = item.definitionVersion === 1 && typeof item.definitionId === 'string' && Object.hasOwn(details, item.definitionId);
    return { ...item,
      description: known ? details[String(item.definitionId)] : 'No item description is available in this version.',
      skillRequirements: skillRankEntries(item.requiredSkillRanks),
      grantedAbilityNames: Array.isArray(item.grantedAbilityIds) ? item.grantedAbilityIds.filter((id): id is string => typeof id === 'string').map(id => Object.hasOwn(abilityNames, id) ? abilityNames[id] : id) : [],
    };
  }) };
}
