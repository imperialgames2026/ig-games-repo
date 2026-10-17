import { createClient } from "npm:@supabase/supabase-js@2.57.4";

// This API is intentionally locked to the staging project.
// It never reads or modifies production wallets, financial ledgers, or crypto custody.
const STAGING_REF = "qonqemhljgxlwpghkxhn";
const cors = {
  "content-type": "application/json",
  "cache-control": "no-store",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
};
const json = (status: number, data: unknown) => new Response(JSON.stringify(data), { status, headers: cors });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const actions = new Set(["state", "join", "leave", "bet", "roll", "spin", "claim"]);

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return json(405, { error: "POST required" });
  const url = Deno.env.get("SUPABASE_URL") || "";
  const publishable = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (url !== "https://" + STAGING_REF + ".supabase.co" || !publishable || !serviceKey) {
    return json(503, { error: "Staging-only multiplayer table service is unavailable" });
  }
  const token = request.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) return json(401, { error: "Sign in required" });
  const auth = createClient(url, publishable, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await auth.auth.getUser(token);
  if (authError || !user || user.is_anonymous) return json(401, { error: "Invalid session" });

  const raw = await request.text().catch(() => "");
  if (raw.length > 2048) return json(413, { error: "Request too large" });
  let input: Record<string, unknown>;
  try { input = JSON.parse(raw); } catch { return json(400, { error: "Invalid JSON" }); }
  if (!input || typeof input !== "object" || Array.isArray(input)) return json(400, { error: "Invalid request" });
  const { game, action, requestId, target, units, expectedRound } = input;
  if ((game !== "craps" && game !== "roulette") || typeof action !== "string" || !actions.has(action)) {
    return json(400, { error: "Invalid table or action" });
  }
  if (action === "roll" && game !== "craps" || action === "spin" && game !== "roulette") {
    return json(400, { error: "Game/action mismatch" });
  }
  const expectedKeys = action === "bet" ? ["game", "action", "requestId", "target", "units"]
    : action === "roll" || action === "spin" ? ["game", "action", "requestId", "expectedRound"]
    : ["game", "action"];
  if (Object.keys(input).some(key => !expectedKeys.includes(key)) ||
      expectedKeys.some(key => !Object.prototype.hasOwnProperty.call(input, key))) {
    return json(400, { error: "Unexpected request fields" });
  }
  if ((action === "bet" || action === "roll" || action === "spin") &&
      (typeof requestId !== "string" || !uuid.test(requestId))) {
    return json(400, { error: "A unique request ID is required" });
  }
  if (action === "bet" && (typeof target !== "string" || target.length > 32 ||
      !Number.isInteger(units) || Number(units) < 1 || Number(units) > 100)) {
    return json(400, { error: "Invalid practice-chip selection" });
  }
  if ((action === "roll" || action === "spin") &&
      (!Number.isSafeInteger(expectedRound) || Number(expectedRound) < 1)) {
    return json(400, { error: "Invalid round revision" });
  }

  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  if (action !== "state") {
    const { error, data } = await db.rpc("ig_mp_action", {
      p_actor: user.id, p_game: game, p_action: action,
      p_request: requestId ?? null,
      p_target: target ?? null, p_units: units ?? null, p_expected_round: expectedRound ?? null,
    });
    if (error) {
      if (error.code === "42501") return json(403, { error: "Not authorized for this table action" });
      if (error.code === "23505") return json(409, { error: "Stale action or duplicate request; reload table" });
      if (error.code === "22023") return json(422, { error: "Invalid selection, unavailable shooter, or insufficient practice chips" });
      console.error("ig multiplayer action error", error.code);
      return json(503, { error: "Table action unavailable; no practice chips were settled in this response" });
    }
    const stateResult = await db.rpc("ig_mp_state", { p_actor: user.id, p_game: game });
    if (stateResult.error) return json(503, { error: "Action was processed but table refresh failed. Refresh table; do not repeat with a new request ID." });
    return json(200, { action: data, state: stateResult.data });
  }
  const { data, error } = await db.rpc("ig_mp_state", { p_actor: user.id, p_game: game });
  if (error) {
    if (error.code === "42501") return json(403, { error: "Account cannot view this table" });
    console.error("ig multiplayer state error", error.code);
    return json(503, { error: "Table currently unavailable" });
  }
  return json(200, { state: data });
});
