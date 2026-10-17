import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const url = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '';
const forbidden = new Set(['api','legacy-entity','update-profile']);
const privileged = /(?:wallet|balance|credit|debit|gift|transfer|deposit|withdraw|payment|checkout|webhook|settle|outcome|blackjack|spin|dice|reward|staking|admin|superadmin|payout|refund)/i;
const allowed = new Set<string>([]); // Enable individually only after migration and authorization tests.

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({error:'Method not allowed'},{status:405});
  const authorization = req.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ') || !anonKey) return Response.json({error:'Unauthorized'},{status:401});
  const client = createClient(url,anonKey,{global:{headers:{Authorization:authorization}}});
  const {data:{user},error} = await client.auth.getUser(authorization.slice(7));
  if (error || !user) return Response.json({error:'Unauthorized'},{status:401});
  const {data:profile,error:profileError} = await client.from('profiles').select('role,is_excluded').eq('id',user.id).single();
  if (profileError || !profile || profile.is_excluded) return Response.json({error:'Account unavailable'},{status:403});
  let body:any;
  try { body = await req.json(); } catch { return Response.json({error:'Invalid JSON'},{status:400}); }
  const name = String(body?.functionName || '');
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(name) || forbidden.has(name)) return Response.json({error:'Invalid function'},{status:400});
  // A missing conversion must fail closed. Never forward user requests to unreviewed
  // functions, especially any operation involving money or a game outcome.
  if (privileged.test(name) || !allowed.has(name)) return Response.json({error:'Legacy operation unavailable pending secure migration'},{status:501});
  return Response.json({error:'Operation unavailable'},{status:501});
});
