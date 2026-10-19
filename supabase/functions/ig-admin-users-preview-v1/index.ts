import { createClient } from "npm:@supabase/supabase-js@2.57.4";

// Staging-only Base44 AdminUsers replacement. Never expose user email, phone,
// identity documents, wallet balances, service-role credentials, or write actions.
const STAGING_URL = "https://qonqemhljgxlwpghkxhn.supabase.co";
const PAGE_SIZE = 25;
const MAX_PAGE = 39;
const headers = {
  "content-type": "application/json",
  "cache-control": "no-store",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return reply({ error: "POST required" }, 405);
  const url = Deno.env.get("SUPABASE_URL") || "";
  const publicKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (url !== STAGING_URL || !publicKey || !serviceKey) return reply({ error: "Staging service unavailable" }, 503);

  const jwt = req.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  if (!jwt) return reply({ error: "Authentication required" }, 401);
  const auth = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await auth.auth.getUser(jwt);
  if (authError || !user || user.is_anonymous) return reply({ error: "Invalid session" }, 401);

  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const [{ data: profile, error: profileError }, { data: ownerRole, error: roleError }] = await Promise.all([
    db.from("profiles").select("id,is_excluded").eq("id", user.id).maybeSingle(),
    db.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
  ]);
  if (profileError || roleError) return reply({ error: "Permission check unavailable" }, 503);
  if (!profile || profile.id !== user.id || profile.is_excluded !== false ||
      ownerRole?.role !== "superadmin") return reply({ error: "Superadmin access required" }, 403);

  let request: unknown;
  try {
    const raw = await req.text();
    if (raw.length > 128) return reply({ error: "Request too large" }, 413);
    request = JSON.parse(raw);
  } catch { return reply({ error: "Invalid request" }, 400); }
  if (!request || typeof request !== "object" || Array.isArray(request)) return reply({ error: "Invalid request" }, 400);
  const input = request as Record<string, unknown>;
  if (!Object.keys(input).every(k => k === "action" || k === "page") ||
      input.action !== "list" || !Number.isSafeInteger(input.page) ||
      (input.page as number) < 0 || (input.page as number) > MAX_PAGE) {
    return reply({ error: "Unsupported list request" }, 400);
  }
  const page = input.page as number;
  const { data: rows, count, error: listError } = await db.from("profiles")
    .select("id,display_name,created_at,is_excluded", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
  if (listError) return reply({ error: "Directory temporarily unavailable" }, 503);
  const ids = (rows || []).map(r => r.id);
  const roles = ids.length
    ? await db.from("user_roles").select("user_id,role").in("user_id", ids)
    : { data: [], error: null };
  if (roles.error) return reply({ error: "Role directory unavailable" }, 503);
  const roleById = new Map((roles.data || []).map(r => [r.user_id, r.role]));
  const users = (rows || []).map(r => ({
    id: r.id,
    displayName: typeof r.display_name === "string" ? r.display_name.slice(0, 80) : null,
    createdAt: r.created_at,
    excluded: r.is_excluded === true,
    role: roleById.get(r.id) || "unassigned",
  }));
  return reply({ stagingOnly: true, readOnly: true, page, pageSize: PAGE_SIZE,
    total: count ?? users.length, users });
});
