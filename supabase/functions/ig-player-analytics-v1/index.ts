import { createClient } from "npm:@supabase/supabase-js@2.57.4";

// Read-only analytics for the authenticated player, backed ONLY by verified,
// server-archived completed hands. No client-supplied player ID or grade data.
const STAGING_REF = "qonqemhljgxlwpghkxhn";
const cors = {
  "content-type": "application/json",
  "cache-control": "no-store",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
};
const send = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors });
const metric = (yes: number, opportunities: number) => ({
  numerator: yes,
  denominator: opportunities,
  percent: opportunities > 0 ? Math.round((10000 * yes) / opportunities) / 100 : null,
});
const numberOrZero = (value: unknown) => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};
const MAX_HANDS = 1000;
const MAX_GRADES = 1000;
const ROLES = new Set(["player", "tester", "admin", "superadmin"]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return send({ error: "POST required" }, 405);
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (url !== `https://${STAGING_REF}.supabase.co` || !key || !secret) {
    return send({ error: "Staging analytics unavailable" }, 503);
  }
  const token = req.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) return send({ error: "Authentication required" }, 401);
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await client.auth.getUser(token);
  if (authError || !user || user.is_anonymous) return send({ error: "Invalid session" }, 401);
  let request: unknown;
  try {
    const raw = await req.text();
    if (raw.length > 128) return send({ error: "Request too long" }, 413);
    request = JSON.parse(raw);
  } catch {
    return send({ error: "Invalid JSON request" }, 400);
  }
  if (!request || typeof request !== "object" || Array.isArray(request) ||
      Object.keys(request).length !== 1 || (request as { action?: unknown }).action !== "mine") {
    return send({ error: "Unsupported analytics action" }, 400);
  }
  const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const [{ data: profile, error: profileError }, { data: role, error: roleError }] = await Promise.all([
    db.from("profiles").select("id,display_name,is_excluded").eq("id", user.id).maybeSingle(),
    db.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
  ]);
  if (profileError || roleError) return send({ error: "Account verification unavailable" }, 503);
  if (!profile || profile.id !== user.id || profile.is_excluded !== false || !role || !ROLES.has(role.role)) {
    return send({ error: "Account not eligible" }, 403);
  }

  const [{ data: hands, count: handsTotal, error: handsError },
         { data: grades, count: gradesTotal, error: gradesError }] = await Promise.all([
    db.from("ig_poker_hand_facts")
      .select("went_to_flop,saw_showdown,won_showdown,won_hand,voluntarily_put_money_preflop,preflop_raised,threebet_opportunity,threebet_made,faced_threebet,folded_to_threebet,cbet_flop_opportunity,cbet_flop_made,faced_cbet_flop,folded_to_cbet_flop,steal_opportunity,steal_attempt,blind_defense_opportunity,defended_blind,aggressive_actions,calls,hand_bb_net,recorded_at", { count: "exact" })
      .eq("user_id", user.id).order("recorded_at", { ascending: false }).limit(MAX_HANDS),
    db.from("ig_poker_decision_grades")
      .select("decision_quality,grading_version,graded_at", { count: "exact" })
      .eq("user_id", user.id).order("graded_at", { ascending: false }).limit(MAX_GRADES),
  ]);
  if (handsError || gradesError) {
    console.error("ig-player-analytics-v1 read failure", handsError?.code || gradesError?.code);
    return send({ error: "Verified statistics temporarily unavailable" }, 503);
  }
  const rows = hands || [];
  const values = (name: string) => rows.filter((row: Record<string, unknown>) => row[name] === true).length;
  const points = rows.reduce((s: number, row: Record<string, unknown>) => s + numberOrZero(row.hand_bb_net), 0);
  const actions = rows.reduce((s: number, row: Record<string, unknown>) => s + numberOrZero(row.aggressive_actions), 0);
  const calls = rows.reduce((s: number, row: Record<string, unknown>) => s + numberOrZero(row.calls), 0);
  const n = rows.length;
  const stats = {
    hands: n,
    vpip: metric(values("voluntarily_put_money_preflop"), n),
    pfr: metric(values("preflop_raised"), n),
    threeBet: metric(values("threebet_made"), values("threebet_opportunity")),
    foldToThreeBet: metric(values("folded_to_threebet"), values("faced_threebet")),
    flopCBet: metric(values("cbet_flop_made"), values("cbet_flop_opportunity")),
    foldToFlopCBet: metric(values("folded_to_cbet_flop"), values("faced_cbet_flop")),
    steal: metric(values("steal_attempt"), values("steal_opportunity")),
    blindDefense: metric(values("defended_blind"), values("blind_defense_opportunity")),
    wentToShowdown: metric(values("saw_showdown"), values("went_to_flop")),
    wonAtShowdown: metric(values("won_showdown"), values("saw_showdown")),
    wonWhenSawFlop: metric(rows.filter((r: Record<string,unknown>) => r.went_to_flop === true && r.won_hand === true).length, values("went_to_flop")),
    handsWon: metric(values("won_hand"), n),
    aggressionFactor: calls > 0 ? Math.round(100 * actions / calls) / 100 : null,
    netBBPer100: n > 0 ? Math.round(10000 * points / n) / 100 : null,
  };
  const gradeRows = (grades || []).filter((g: { decision_quality: number; grading_version: string }) =>
    Number.isFinite(Number(g.decision_quality)) &&
    Number(g.decision_quality) >= 0 && Number(g.decision_quality) <= 1);
  const revisions = [...new Set(gradeRows.map((g: { grading_version: string }) => g.grading_version))];
  // A score is not justified without enough independently graded decisions.
  // Never mix grades from different evaluation versions.
  const eligible = n >= 100 && gradeRows.length >= 50 && revisions.length === 1;
  const average = eligible ? gradeRows.reduce((sum: number, g: { decision_quality: number }) =>
    sum + Number(g.decision_quality), 0) / gradeRows.length : null;
  const skillScore = {
    value: average === null ? null : Math.max(0, Math.min(1000, Math.round(average * 1000))),
    scale: "0–1000",
    minimumHands: 100,
    minimumGradedDecisions: 50,
    evaluatedDecisions: gradeRows.length,
    gradingVersion: eligible ? revisions[0] : null,
    label: eligible ? "Provisional post-hand study score" : "N/A — insufficient verified post-hand data",
  };
  return send({
    practiceOnly: true,
    realMoneyEnabled: false,
    player: { displayName: profile.display_name || "Imperial Player" },
    source: "server_archived_completed_hands",
    sample: { hands: n, totalHandsRecorded: handsTotal ?? n, handSampleLimit: MAX_HANDS,
              sampled: (handsTotal ?? n) > n, gradedDecisions: gradeRows.length,
              totalGradedDecisions: gradesTotal ?? gradeRows.length, gradeSampleLimit: MAX_GRADES },
    stats, skillScore,
  });
});
