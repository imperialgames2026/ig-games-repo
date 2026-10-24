import { createClient } from "npm:@supabase/supabase-js@2";

const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: {
    "content-type": "application/json", "cache-control": "no-store",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
  },
});
const ROLES = new Set(["player", "tester", "admin", "superadmin"]);

// Read-only catalog and own monitoring view. Never issue addresses or credit balances.
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return respond({});
  if (req.method !== "POST") return respond({ error: "POST required" }, 405);
  const jwt = req.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  if (!jwt) return respond({ error: "Authentication required" }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const publishable = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !publishable || !serviceKey) return respond({ error: "Backend configuration missing" }, 503);

  const auth = createClient(url, publishable, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await auth.auth.getUser(jwt);
  if (authError || !user || user.is_anonymous) return respond({ error: "Invalid session" }, 401);
 if(!hasCompletedMfa(user,jwt))return respond({error:'Two-step verification required',code:'mfa_required'},403);

  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const [{ data: profile, error: profileError }, { data: role, error: roleError }] = await Promise.all([
    db.from("profiles").select("is_excluded").eq("id", user.id).maybeSingle(),
    db.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
  ]);
  if (profileError || roleError) return respond({ error: "Account verification unavailable" }, 503);
  if (!profile || profile.is_excluded !== false || !role || !ROLES.has(role.role))
    return respond({ error: "Account not eligible" }, 403);

  const request = await req.json().catch(() => null);
  if (!request || typeof request !== "object" || Array.isArray(request) ||
      Object.keys(request).length !== 1 || !["catalog", "observations"].includes(request.action))
    return respond({ error: "Invalid read-only operation" }, 400);

  if (request.action === "catalog") {
    const [networks, assets] = await Promise.all([
      db.from("crypto_deposit_networks").select("network_id,display_name,chain_family,evm_chain_id,enabled").order("network_id"),
      db.from("crypto_deposit_assets").select("network_id,asset_code,asset_kind,enabled,token_issuer_verified").order("network_id"),
    ]);
    if (networks.error || assets.error) return respond({ error: "Deposit capability catalog unavailable" }, 503);
    // Deliberately never expose custody/receiving addresses or token contract
    // hints as payment instructions. The DB constraints keep all rows disabled.
    return respond({
      acceptsDeposits: false,
      networks: (networks.data ?? []).map(n => ({
        id: n.network_id, name: n.display_name, family: n.chain_family,
        chainId: n.evm_chain_id, available: false,
      })),
      assets: (assets.data ?? []).map(a => ({
        networkId: a.network_id, symbol: a.asset_code,
        kind: a.asset_kind, available: false, verified: false,
      })),
    });
  }

  const { data, error } = await db.from("crypto_deposit_observations")
    .select("id,network_id,asset_code,status,credit_status,confirmations,created_at")
    .eq("user_id", user.id).order("created_at", { ascending: false }).limit(30);
  if (error) return respond({ error: "Observation history unavailable" }, 503);
  return respond({ acceptsDeposits: false, observations: data ?? [] });
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
