import type { SkillFamily } from './character-build.ts';

export type EquipmentSlot = 'main_hand' | 'off_hand' | 'head' | 'body' | 'feet' | 'accessory' | 'skill_1' | 'skill_2' | 'skill_3';
export interface ItemDefinition {
  id: string;
  version: number;
  kind: 'weapon' | 'gear' | 'skill' | 'consumable' | 'material';
  allowedSlots: EquipmentSlot[];
  requiredSymbols: SkillFamily[];
  minimumLevel: number;
  requiredSkillRanks: Record<string, number>;
  grantedAbilityIds: string[];
  visualId: string;
}
/** Only populate from trusted inventory storage and chain verification, never a request body. */
export interface InventoryInstance {
  id: string;
  ownerUserId: string;
  definitionId: string;
  definitionVersion: number;
  state: 'available' | 'equipped' | 'listed' | 'reserved' | 'consumed';
  activeEncounterLocks: string[];
  source: 'practice' | 'solana';
  chainOwnership: 'verified' | 'pending' | 'revoked' | null;
}
export interface LoadoutCharacter {
  id: string;
  ownerUserId: string;
  level: number;
  compatibilitySymbols: SkillFamily[];
  skillRanks: Record<string, number>;
  activeEncounterId: string | null;
}
export type LoadoutReason = 'allowed' | 'not_owner' | 'unavailable' | 'nontransferable' | 'ownership_unverified' | 'encounter_locked' | 'definition_mismatch' | 'incompatible_slot' | 'missing_symbol' | 'level_too_low' | 'missing_skill_rank';
export interface LoadoutDecision { allowed: boolean; reason: LoadoutReason }
const reject = (reason: LoadoutReason): LoadoutDecision => ({ allowed: false, reason });

function assetEligibility(userId: string, item: InventoryInstance): LoadoutDecision {
  if (!userId || item.ownerUserId !== userId) return reject('not_owner');
  if (item.state !== 'available') return reject('unavailable');
  if (item.activeEncounterLocks.length > 0) return reject('encounter_locked');
  if (item.source === 'solana' && item.chainOwnership !== 'verified') return reject('ownership_unverified');
  return { allowed: true, reason: 'allowed' };
}

/** A decision only. Inventory, slot, and listing changes must commit atomically in storage. */
export function canEquipItem(userId: string, character: LoadoutCharacter, item: InventoryInstance, definition: ItemDefinition, slot: EquipmentSlot): LoadoutDecision {
  if (character.ownerUserId !== userId) return reject('not_owner');
  if (character.activeEncounterId !== null) return reject('encounter_locked');
  const eligible = assetEligibility(userId, item);
  if (!eligible.allowed) return eligible;
  if (item.definitionId !== definition.id || item.definitionVersion !== definition.version) return reject('definition_mismatch');
  if (!definition.allowedSlots.includes(slot)) return reject('incompatible_slot');
  if (!Number.isSafeInteger(character.level) || character.level < definition.minimumLevel) return reject('level_too_low');
  if (definition.requiredSymbols.some(symbol => !character.compatibilitySymbols.includes(symbol))) return reject('missing_symbol');
  for (const [skill, minimum] of Object.entries(definition.requiredSkillRanks)) {
    const rank = character.skillRanks[skill] ?? 0;
    if (!Number.isSafeInteger(rank) || rank < minimum) return reject('missing_skill_rank');
  }
  return { allowed: true, reason: 'allowed' };
}

/** Listing requires an unequipped, unreserved asset whose chain ownership is verified. */
export function canListItem(userId: string, item: InventoryInstance): LoadoutDecision {
  if (item.source !== 'solana') return reject('nontransferable');
  return assetEligibility(userId, item);
}
