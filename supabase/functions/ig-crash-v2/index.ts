import { createClient } from "npm:@supabase/supabase-js@2.57.4";

// STAGING-ONLY: no purchases, deposits, withdrawals, redeemable balances or real-money payouts.
const PROJECT = "qonqemhljgxlwpghkxhn";
const headers = {
  "Content-Type": "application/json", "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-client-info,x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};
const reply = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const modes = new Set(["crash_manual", "crash_auto", "tren_red", "tren_green", "tren_yellow"]);
const actions = new Set(["state", "join", "leave", "refill", "bet", "cashout"]);
const allowed = (action: string): string[] => action === "bet" ?
  ["action", "round", "requestId", "mode", "target", "units"] :
  action === "cashout" ? ["action", "round", "requestId", "betId"] : ["action"];

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return reply({ error: "POST required" }, 405);
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if ((url !== `https://${PROJECT}.supabase.co` && !(Deno.env.get('IG_LOCAL_PRACTICE')==='true' && url==='http://kong:8000')) || !anon || !service)
    return reply({ error: "Staging environment is unavailable" }, 503);
  const token = request.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) return reply({ error: "Authentication required" }, 401);
  const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await client.auth.getUser(token);
  if (authError || !user || user.is_anonymous) return reply({ error: "Invalid session" }, 401);

  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 2048) return reply({ error: "Request too large" }, 413);
    body = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw Error();
  } catch {
    return reply({ error: "Invalid request body" }, 400);
  }
  const action = body.action;
  if (typeof action !== "string" || !actions.has(action)) return reply({ error: "Invalid action" }, 400);
  const keys = allowed(action);
  if (Object.keys(body).some(k => !keys.includes(k)) || keys.some(k => !Object.hasOwn(body, k)))
    return reply({ error: "Unexpected or missing fields" }, 400);

  if (action === "bet" || action === "cashout") {
    if (!Number.isSafeInteger(body.round) || Number(body.round) < 1 ||
      typeof body.requestId !== "string" || !uuid.test(body.requestId))
      return reply({ error: "Invalid round or request ID" }, 400);
  }
  if (action === "bet" && (
    typeof body.mode !== "string" || !modes.has(body.mode) ||
    !Number.isSafeInteger(body.units) || Number(body.units) < 1 || Number(body.units) > 100 ||
    (body.mode === "crash_auto"
      ? ![1.5, 2, 3, 5, 10].includes(Number(body.target)) || typeof body.target !== "number"
      : body.target !== null)))
    return reply({ error: "Invalid practice bet" }, 400);
  if (action === "cashout" && (typeof body.betId !== "string" || !uuid.test(body.betId)))
    return reply({ error: "Invalid bet ID" }, 400);

  const db = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const snapshot = async () => {
    const { data, error } = await db.rpc("ig_crash_v2_state", { p_actor: user.id });
    if (error) {
      if (error.code === "42501") return reply({ error: "Not eligible for practice games" }, 403);
      console.error("crash state error", error.code);
      return reply({ error: "Crash state temporarily unavailable" }, 503);
    }
    return reply({ state: data });
  };
  if (action === "state") return snapshot();
  const { data, error } = await db.rpc("ig_crash_v2_action", {
    p_actor: user.id, p_action: action,
    p_round: body.round ?? null, p_request: body.requestId ?? null,
    p_mode: body.mode ?? null, p_target: body.target ?? null,
    p_units: body.units ?? null, p_bet: body.betId ?? null,
  });
  if (error) {
    if (error.code === "42501") return reply({ error: "Action not permitted" }, 403);
    if (error.code === "23505") return reply({ error: "Conflicting repeated request" }, 409);
    if (error.code === "22023") return reply({ error: error.message }, 422);
    console.error("crash action error", error.code);
    return reply({ error: "Crash action unavailable; refresh before retrying" }, 503);
  }
  const { data: state, error: stateError } = await db.rpc("ig_crash_v2_state", { p_actor: user.id });
  if (stateError) return reply({ action: data, warning: "Action accepted; refresh game state" }, 200);
  return reply({ action: data, state });
});
