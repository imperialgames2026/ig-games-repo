import { createClient } from "npm:@supabase/supabase-js@2";

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: {
    "content-type": "application/json",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
  },
});
const allowed = new Set(["player", "tester", "admin", "superadmin"]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return json({});
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return json({ error: "Authentication required" }, 401);
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !secret) return json({ error: "Backend configuration unavailable" }, 503);
  const auth = createClient(url, anon, { auth: { persistSession: false } });
  const { data: { user }, error: authError } = await auth.auth.getUser(token);
  if (authError || !user || user.is_anonymous) return json({ error: "Invalid session" }, 401);
  const db = createClient(url, secret, { auth: { persistSession: false } });
  const [{ data: profile, error: profileError }, { data: role, error: roleError }] = await Promise.all([
    db.from("profiles").select("is_excluded").eq("id", user.id).maybeSingle(),
    db.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
  ]);
  if (profileError || roleError) return json({ error: "Account verification unavailable" }, 503);
  if (!profile || profile.is_excluded !== false || !role || !allowed.has(role.role))
    return json({ error: "Account not eligible" }, 403);

  const input = await req.json().catch(() => null);
  if (!input || Object.keys(input).length > 1 || input.action !== "getWeeklyTokenLeaderboard")
    return json({ error: "Unknown read-only action" }, 400);
  const { data, error } = await db.rpc("legacy_weekly_practice_leaderboard");
  if (error) return json({ error: "Practice leaderboard unavailable" }, 503);
  // Match the original UI response shape, without exposing identities or wallet writes.
  const today = new Date();
  const midnight = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const weekStart = new Date(midnight - today.getUTCDay() * 86400000).toISOString();
  return json({
    success: true,
    week_start: weekStart,
    leaderboard: (data ?? []).map((row: { rank: number; name: string; total_won: number | string }) => ({
      rank: row.rank,
      name: row.name,
      total_won: row.total_won,
    })),
    currency: "CENT",
    practiceOnly: true,
  });
});
