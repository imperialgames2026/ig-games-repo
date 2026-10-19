import { createClient } from "npm:@supabase/supabase-js@2";

const headers = {
  "content-type": "application/json",
  "cache-control": "no-store",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
  "access-control-allow-methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowed = new Set(["player", "admin", "superadmin", "tester"]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return reply({ error: "POST required" }, 405);
  const jwt = req.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  if (!jwt) return reply({ error: "Authentication required" }, 401);
  const url = Deno.env.get("SUPABASE_URL");
  const pub = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !pub || !service) return reply({ error: "Backend unavailable" }, 503);
  const auth = createClient(url, pub, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await auth.auth.getUser(jwt);
  if (authError || !user || user.is_anonymous) return reply({ error: "Invalid session" }, 401);
  const db = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const [{ data: profile, error: profileError }, { data: role, error: roleError }] = await Promise.all([
    db.from("profiles").select("id,is_excluded").eq("id", user.id).maybeSingle(),
    db.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
  ]);
  if (profileError || roleError) return reply({ error: "Eligibility verification unavailable" }, 503);
  if (!profile || profile.id !== user.id || typeof profile.is_excluded !== "boolean" ||
      !role || !allowed.has(role.role)) return reply({ error: "Account unavailable" }, 403);

  const raw = await req.text().catch(() => "");
  if (raw.length > 1024) return reply({ error: "Request too large" }, 413);
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data)) throw Error("Invalid request");
  } catch { return reply({ error: "Invalid JSON" }, 400); }
  if (data.action === "status" && Object.keys(data).length === 1) {
    return reply({
      isExcluded: profile.is_excluded,
      canSelfExclude: role.role !== "tester",
      playerCanReinstate: false,
    });
  }
  if (data.action === "activate" && Object.keys(data).length === 2 &&
      typeof data.requestId === "string" && uuid.test(data.requestId)) {
    if (role.role === "tester") return reply({ error: "Read-only tester account" }, 403);
    const { data: outcome, error } = await db.rpc("ig_activate_self_exclusion", {
      p_user: user.id, p_request: data.requestId,
    });
    if (error) return reply({ error: "Could not record exclusion. Contact support." }, 503);
    return reply({
      isExcluded: outcome?.excluded === true,
      playerCanReinstate: false,
      reviewRequired: true,
    });
  }
  return reply({ error: "Unsupported responsible-play operation" }, 400);
});
