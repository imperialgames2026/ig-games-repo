import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const url = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '';
const forbidden = new Set(['api', 'legacy-entity', 'update-profile']);
const privileged = /(?:wallet|balance|credit|debit|gift|transfer|deposit|withdraw|payment|checkout|webhook|settle|outcome|blackjack|spin|dice|reward|staking|admin|superadmin|payout|refund)/i;
const allowed = new Set<string>([]);
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};
const json = (data: unknown, status: number) => new Response(JSON.stringify(data), { status, headers: cors });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const authorization = req.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ') || !anonKey) return json({ error: 'Unauthorized' }, 401);
  const client = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: { user }, error } = await client.auth.getUser(authorization.slice(7));
  if (error || !user) return json({ error: 'Unauthorized' }, 401);
  const { data: profile, error: profileError } = await client.from('profiles').select('role,is_excluded').eq('id', user.id).single();
  if (profileError || !profile || profile.is_excluded) return json({ error: 'Account unavailable' }, 403);
  let body: unknown;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  if (!body || typeof body !== 'object') return json({ error: 'Invalid payload' }, 400);
  const name = String((body as Record<string, unknown>).functionName || '');
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(name) || forbidden.has(name)) return json({ error: 'Invalid function' }, 400);
  // Only explicitly reviewed operations may be enabled. Financial and game mutations
  // require atomic SQL settlement, idempotency and independent authorization tests.
  if (privileged.test(name) || !allowed.has(name)) return json({ error: 'Legacy operation unavailable pending secure migration' }, 501);
  return json({ error: 'Operation unavailable' }, 501);
});
