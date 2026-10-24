import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-supabase-api-version' };
const json = (status: number, data: unknown) => new Response(JSON.stringify(data), { status, headers });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return json(405, { error: 'POST required' });
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (url !== 'https://qonqemhljgxlwpghkxhn.supabase.co' || !key || !secret) return json(503, { error: 'Staging service unavailable' });
  const token = request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) return json(401, { error: 'Sign in to play' });
  const auth = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await auth.auth.getUser(token);
  if (authError || !user || user.is_anonymous) return json(401, { error: 'Registered account required' });
 if(!hasCompletedMfa(user,token))return json(403,{error:'Two-step verification required',code:'mfa_required'});
  let body: Record<string, unknown>;
  try { const raw = await request.text(); if (raw.length > 2048) return json(413, { error: 'Request too large' }); body = JSON.parse(raw); }
  catch { return json(400, { error: 'Invalid JSON' }); }
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      !['coin','hashdice','limbo','plinko','wheel'].includes(String(body.game))) return json(400, { error: 'Invalid game' });
  const fields = body.action === 'commit' ? ['action','game','requestId'] :
    body.action === 'reveal' ? ['action','game','roundId','clientSeed'] : body.action === 'history' ? ['action','game'] : [];
  if (!fields.length || fields.some(k => !Object.hasOwn(body, k)) || Object.keys(body).some(k => !fields.includes(k)))
    return json(400, { error: 'Unexpected or missing fields' });
  const round = body.action === 'commit' ? body.requestId : body.roundId;
  if (body.action !== 'history' && (typeof round !== 'string' || !uuid.test(round))) return json(400, { error: 'Invalid round ID' });
  if (body.action === 'reveal' && (typeof body.clientSeed !== 'string' || body.clientSeed.length < 1 || body.clientSeed.length > 128))
    return json(400, { error: 'Client seed must have 1 to 128 characters' });
  const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.rpc('ig_originals_practice', {
    p_actor: user.id, p_action: body.action, p_game: body.game, p_round: round ?? null, p_client_seed: body.clientSeed ?? null,
  });
  if (error) {
    const code = ({ '42501': 403, '23505': 409, '22023': 400, 'P0002': 404, '54000': 429 } as Record<string, number>)[error.code];
    return json(code || 503, { error: code === 429 ? 'Round limit reached. Retry your pending round or wait a minute.' :
      code === 403 ? 'Account is not eligible to play' : code === 409 ? 'Round request conflicts with an earlier request' : 'Round unavailable. Retry the same round.' });
  }
  return json(200, data);
});

// BEGIN GENERATED MFA GUARD
// SERVER ONLY: call exclusively AFTER Auth getUser validates this EXACT token.
// Never use decoded claims as standalone authentication. Auth supplies factors;
// user_metadata and request bodies cannot choose whether MFA is required.
function hasCompletedMfa(user, verifiedAccessToken) {
  if (!user?.id) return false;
  if (!user.factors?.some(factor => factor.status === 'verified')) return true;
  try {
    const part = verifiedAccessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(part.padEnd(Math.ceil(part.length / 4) * 4, '=')));
    return claims.sub === user.id && claims.aal === 'aal2';
  } catch { return false; }
}
// END GENERATED MFA GUARD
