import { presentCampaignResult } from './inventory-presentation.ts';
import { validateCharacterBuild, IMPERIAL_ARCHETYPES, IMPERIAL_ORIGINS, IMPERIAL_SKILLS, type CharacterBuildInput } from './character-build.ts';

interface ServiceDependencies {
  authenticate(token: string): Promise<{ id: string; isAnonymous?: boolean } | null>;
  rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { code?: string } | null }>;
}
const headers = {
  'content-type': 'application/json', 'cache-control': 'no-store',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
};
const json = (status: number, data: unknown) => new Response(JSON.stringify(data), { status, headers });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const keysMatch = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).length === keys.length && keys.every(k => Object.hasOwn(value, k));
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

async function body(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new TypeError('Request body required');
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 16384) { await reader.cancel(); throw new RangeError('Request too large'); }
    chunks.push(value);
  }
  const all = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(all));
}

export function createCharacterHandler(deps: ServiceDependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return json(405, { error: 'POST required' });
    const token = request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
    if (!token) return json(401, { error: 'Sign in required' });
    let user;
    try { user = await deps.authenticate(token); } catch { return json(503, { error: 'Sign-in service unavailable' }); }
    if (!user || user.isAnonymous) return json(401, { error: 'Invalid session' });

    let input: unknown;
    try { input = await body(request); }
    catch (error) { return json(error instanceof RangeError ? 413 : 400, { error: error instanceof RangeError ? 'Request too large' : 'Invalid JSON' }); }
    if (!record(input)) return json(400, { error: 'Invalid request' });
    if (input.action === 'catalog' && keysMatch(input, ['action']))
      return json(200, { origins: IMPERIAL_ORIGINS, archetypes: IMPERIAL_ARCHETYPES, skills: IMPERIAL_SKILLS });

    let name: string;
    let args: Record<string, unknown>;
    if (input.action === 'list' && keysMatch(input, ['action'])) {
      name = 'ig_campaign_characters_list_v1';
      args = { p_user_id: user.id };
    } else if (input.action === 'create' && keysMatch(input, ['action', 'requestId', 'character'])) {
      if (typeof input.requestId !== 'string' || !uuid.test(input.requestId) || !record(input.character))
        return json(400, { error: 'Character and unique request ID required' });
      const character = input.character;
      if (!keysMatch(character, ['name', 'originId', 'archetypeId', 'abilityScores', 'proficientSkills']) ||
          !record(character.abilityScores) || !keysMatch(character.abilityScores, ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma']))
        return json(400, { error: 'Unexpected character fields' });
      let validated;
      try { validated = validateCharacterBuild(character as unknown as CharacterBuildInput); }
      catch { return json(400, { error: 'Choose a valid name, origin, archetype, ability array and two allowed skills' }); }
      const visualId = validated.archetypeId === 'wildscout' ? 'scout' : validated.archetypeId === 'spellweaver' ? 'spellweaver' : 'knight';
      name = 'ig_campaign_character_create_v1';
      args = { p_user_id: user.id, p_request_id: input.requestId, p_character_data: { ...validated, visualId } };
    } else if (['inventory', 'claim_starter', 'equip', 'unequip'].includes(String(input.action))) {
      const mutation = input.action === 'equip' || input.action === 'unequip';
      const fields = ['action', 'characterId', ...(mutation ? ['expectedRevision', 'slot'] : []), ...(input.action === 'equip' ? ['itemId'] : [])];
      const slots = ['main_hand','off_hand','head','body','feet','accessory','skill_1','skill_2','skill_3'];
      if (!keysMatch(input, fields) || typeof input.characterId !== 'string' || !uuid.test(input.characterId) ||
          (mutation && (!Number.isSafeInteger(input.expectedRevision) || Number(input.expectedRevision) < 0 || !slots.includes(String(input.slot)))) ||
          (input.action === 'equip' && (typeof input.itemId !== 'string' || !uuid.test(input.itemId))))
        return json(400, { error: 'Invalid inventory request' });
      name = 'ig_campaign_inventory_v1';
      args = { p_user_id: user.id, p_character_id: input.characterId, p_action: input.action,
        p_expected_revision: mutation ? input.expectedRevision : null,
        p_slot: mutation ? input.slot : null, p_item_id: input.action === 'equip' ? input.itemId : null };
    } else return json(400, { error: 'Unsupported action or unexpected fields' });
    try {
      const result = await deps.rpc(name, args);
      if (result.error) {
        if (name === 'ig_campaign_inventory_v1') {
          const failures: Record<string, [number, string]> = {
            '40001': [409, 'Loadout changed. Refresh inventory and try again.'],
            P0002: [404, 'Hero or item unavailable.'],
            P0003: [409, 'Item or loadout is locked or unavailable.'],
            P0004: [422, 'Hero does not meet the item requirements, or skill is already equipped.'],
            '22023': [400, 'Invalid inventory request.'],
          };
          const failure = failures[result.error.code ?? ''];
          if (failure) return json(failure[0], { error: failure[1] });
        }
        if (result.error.code === '22023') return json(409, { error: 'Creation request conflicts with an earlier request' });
        if (result.error.code === '23514') return json(409, { error: 'Character limit reached' });
        return json(503, { error: 'Character service unavailable' });
      }
      return json(200, presentCampaignResult(result.data));
    } catch { return json(503, { error: 'Character service unavailable' }); }
  };
}
