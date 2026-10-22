import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-supabase-api-version' };
const reply = (status: number, value: unknown) => new Response(JSON.stringify(value), { status, headers });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fields: Record<string,string[]> = {
 current: ['action'], state: ['action','roundId'], commit: ['action','roundId','mineCount'],
 start: ['action','roundId','requestId','version','clientSeed'],
 pick: ['action','roundId','requestId','version','cell'], finish: ['action','roundId','requestId','version'],
};
Deno.serve(async (request: Request) => {
 if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
 if (request.method !== 'POST') return reply(405, { error: 'POST required' });
 const url = Deno.env.get('SUPABASE_URL'), key = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY'), secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if (url !== 'https://qonqemhljgxlwpghkxhn.supabase.co' || !key || !secret) return reply(503, { error: 'Staging service unavailable' });
 const token = request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
 if (!token) return reply(401, { error: 'Sign in to play' });
 const auth = createClient(url,key,{ auth: { persistSession: false, autoRefreshToken: false } });
 const { data: { user }, error: authError } = await auth.auth.getUser(token);
 if (authError || !user || user.is_anonymous) return reply(401, { error: 'Registered account required' });
 if(!hasCompletedMfa(user,token))return reply(403,{error:'Two-step verification required',code:'mfa_required'});
 let body: Record<string,unknown>;
 try { const raw = await request.text(); if (raw.length > 2048) return reply(413, { error: 'Request too large' }); body = JSON.parse(raw); }
 catch { return reply(400, { error: 'Invalid JSON' }); }
 if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.action !== 'string' || !Object.hasOwn(fields,body.action)) return reply(400, { error: 'Invalid action' });
 const allowed = fields[body.action];
 if (allowed.some(k => !Object.hasOwn(body,k)) || Object.keys(body).some(k => !allowed.includes(k))) return reply(400, { error: 'Unexpected or missing fields' });
 for (const key of ['roundId','requestId']) if (Object.hasOwn(body,key) && (typeof body[key] !== 'string' || !uuid.test(String(body[key])))) return reply(400, { error: 'Invalid request ID' });
 if (Object.hasOwn(body,'version') && (!Number.isInteger(body.version) || Number(body.version) < 0 || Number(body.version) > 27)) return reply(400, { error: 'Invalid round version' });
 if (body.action === 'commit' && (!Number.isInteger(body.mineCount) || Number(body.mineCount) < 1 || Number(body.mineCount) > 24)) return reply(400, { error: 'Choose 1 to 24 mines' });
 if (body.action === 'start' && (typeof body.clientSeed !== 'string' || body.clientSeed.length < 1 || body.clientSeed.length > 128)) return reply(400, { error: 'Invalid client seed' });
 if (body.action === 'pick' && (!Number.isInteger(body.cell) || Number(body.cell) < 0 || Number(body.cell) > 24)) return reply(400, { error: 'Invalid tile' });
 const db = createClient(url,secret,{ auth: { persistSession: false, autoRefreshToken: false } });
 const { data, error } = await db.rpc('ig_mines_practice', { p_actor: user.id, p_action: body.action,
  p_round: body.roundId ?? null, p_request: body.requestId ?? null, p_version: body.version ?? null,
  p_cell: body.cell ?? null, p_mine_count: body.mineCount ?? null, p_client_seed: body.clientSeed ?? null });
 if (error) {
  const status = ({ '42501': 403, '23505': 409, 'P0002': 404, '22023': 422, '54000': 429 } as Record<string,number>)[error.code] || 503;
  return reply(status, { error: status === 403 ? 'Account is not eligible to play' : status === 409 ? 'Round changed or request conflicts. Refresh the round.' :
   status === 429 ? 'Too many pending rounds. Resume your round or wait.' : status === 422 ? 'This move is not available in the current round.' : 'Round unavailable. Retry the same request.' });
 }
 return reply(200, { state: data });
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
