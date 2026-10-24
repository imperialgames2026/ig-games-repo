import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const url = Deno.env.get('SUPABASE_URL') || '';
const publishable = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '';
const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, {status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info, x-supabase-api-version','Access-Control-Allow-Methods':'POST, OPTIONS'}});
  const headers = {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'};
  const reply = (status:number, payload:unknown) => new Response(JSON.stringify(payload),{status,headers});
  if (req.method !== 'POST') return reply(405,{error:'Method not allowed'});
  if (url !== 'https://qonqemhljgxlwpghkxhn.supabase.co' || !publishable || !secret) return reply(503,{error:'Staging service not configured'});
  const bearer = req.headers.get('Authorization')?.match(/^Bearer (\S+)$/i)?.[1];
  if (!bearer) return reply(401,{error:'Authentication required'});
  const auth = createClient(url,publishable);
  const {data:{user},error:authError} = await auth.auth.getUser(bearer);
  if (authError || !user || user.is_anonymous) return reply(401,{error:'Invalid session'});
 if(!hasCompletedMfa(user,bearer))return reply(403,{error:'Two-step verification required',code:'mfa_required'});
  let input: Record<string,unknown>;
  try { const raw = await req.text(); if (raw.length > 4096) return reply(413,{error:'Payload too large'}); input = JSON.parse(raw); } catch { return reply(400,{error:'Invalid JSON'}); }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return reply(400,{error:'Invalid payload'});
  const kind = input.kind;
  const operation = input.operation_id;
  const amount = input.amount;
  const allowed = new Set(kind === 'transfer' ? ['kind','operation_id','amount','recipient_id'] : ['kind','operation_id','amount','guess']);
  if (Object.keys(input).some(key => !allowed.has(key))) return reply(400,{error:'Unexpected field'});
  if ((kind !== 'dice' && kind !== 'transfer') || typeof operation !== 'string' || !uuid.test(operation) ||
      typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || amount > 10000 ||
      Math.round(amount * 100) !== amount * 100) return reply(400,{error:'Invalid operation'});
  if (kind === 'dice' && (!Number.isInteger(input.guess) || Number(input.guess) < 1 || Number(input.guess) > 6 || input.recipient_id !== undefined)) return reply(400,{error:'Invalid dice guess'});
  if (kind === 'transfer' && (typeof input.recipient_id !== 'string' || !uuid.test(input.recipient_id) || input.recipient_id === user.id || input.guess !== undefined)) return reply(400,{error:'Invalid recipient'});
  const service = createClient(url,secret,{auth:{autoRefreshToken:false,persistSession:false}});
  const [profile,role] = await Promise.all([
    service.from('profiles').select('is_excluded').eq('id',user.id).maybeSingle(),
    service.from('user_roles').select('role').eq('user_id',user.id).maybeSingle(),
  ]);
  if (profile.error || role.error) return reply(503,{error:'Account verification unavailable'});
  if (profile.data?.is_excluded !== false || role.data?.role !== 'player') return reply(403,{error:'Account ineligible'});
  const {data,error} = await service.rpc('secure_wallet_operation',{
    p_actor:user.id,p_operation:operation,p_kind:kind,p_amount:amount,
    p_target:kind === 'transfer' ? input.recipient_id : null,
    p_guess:kind === 'dice' ? input.guess : null
  });
  if (error) {
    if (error.code === '23505') return reply(409,{error:'Idempotency key conflict'});
    if (error.code === '42501') return reply(403,{error:'Operation denied'});
    if (error.code === '22023') return reply(422,{error:'Invalid operation or insufficient balance'});
    console.error('Secure wallet operation failed',error.code);
    return reply(500,{error:'Operation failed'});
  }
  return reply(200,{result:data});
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
