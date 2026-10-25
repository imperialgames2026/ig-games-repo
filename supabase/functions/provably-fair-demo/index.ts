import { createClient } from "npm:@supabase/supabase-js@2";
// Source release policy; browser input and environment cannot enable parked gameplay.
const practiceRelease = { gameplayEnabled: false };
const encoder = new TextEncoder();
const hex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
async function sha256(value: string) { return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)))); }
async function roll(seed: string, clientSeed: string, nonce: number, count: number) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(seed), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const numbers: number[] = [];
  let counter = 0;
  while (numbers.length < count) {
    const digest = new DataView(await crypto.subtle.sign("HMAC", key, encoder.encode(`${clientSeed}:${nonce}:${counter++}`)));
    for (let i = 0; i <= 28 && numbers.length < count; i += 4) {
      const n = digest.getUint32(i, false);
      if (n < 4294967292) numbers.push(n % 6 + 1);
    }
  }
  return numbers;
}
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  const token = req.headers.get("Authorization")?.replace(/^Bearer /i, "");
  if (!token) return json({ error: "Authentication required" }, 401);
  const url = Deno.env.get("SUPABASE_URL");
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const pub = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !secret || !pub) return json({ error: "Server not configured" }, 503);
  const auth = createClient(url, pub, { auth: { persistSession: false } });
  const { data: { user }, error: authError } = await auth.auth.getUser(token);
  if (authError || !user || user.is_anonymous) return json({ error: "Unauthorized" }, 401);
  if (!practiceRelease.gameplayEnabled) return json({error:"Originals are parked for this practice release",code:"GAME_PARKED"},403);
  const db = createClient(url, secret, { auth: { persistSession: false } });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const action = body.action;
  if (action === "commit") {
    const game = body.game;
    const clientSeed = body.clientSeed;
    if (!["dice", "coin", "number"].includes(String(game)) || typeof clientSeed !== "string" || clientSeed.length < 1 || clientSeed.length > 128) return json({ error: "Invalid game or client seed" }, 400);
    const bytes = new Uint8Array(32); crypto.getRandomValues(bytes);
    const seed = hex(bytes);
    const serverSeedHash = await sha256(seed);
    const { data, error } = await db.from("fair_demo_rounds").insert({ user_id: user.id, game, client_seed: clientSeed, server_seed_hash: serverSeedHash, server_seed: seed, nonce: 0, status: "committed" }).select("id,server_seed_hash,client_seed,game,nonce").single();
    if (error) return json({ error: "Unable to commit round" }, 500);
    return json({ phase: "committed", ...data, algorithm: "hmac-sha256-v1" });
  }
  if (action === "reveal") {
    if (typeof body.roundId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.roundId)) return json({ error: "Invalid round ID" }, 400);
    const { data: round, error } = await db.from("fair_demo_rounds").select("*").eq("id", body.roundId).eq("user_id", user.id).single();
    if (error || !round) return json({ error: "Round not found" }, 404);
    if (round.status === "revealed") return json({ phase: "revealed", roundId: round.id, game: round.game, clientSeed: round.client_seed, serverSeedHash: round.server_seed_hash, serverSeed: round.server_seed, nonce: round.nonce, outcome: round.outcome, algorithm: "hmac-sha256-v1" });
    const values = await roll(round.server_seed, round.client_seed, round.nonce, round.game === "dice" ? 2 : 1);
    const outcome = round.game === "dice" ? { dice: values, sum: values[0] + values[1] } : round.game === "coin" ? { coin: values[0] % 2 ? "heads" : "tails" } : { number: values[0] };
    const { data: saved, error: updateError } = await db.from("fair_demo_rounds").update({ outcome, status: "revealed" }).eq("id", round.id).eq("user_id", user.id).eq("status", "committed").select("id").maybeSingle();
    if (updateError) return json({ error: "Unable to settle demo round" }, 500);
    if (!saved) return json({ error: "Round already processed; retry to retrieve result" }, 409);
    return json({ phase: "revealed", roundId: round.id, game: round.game, clientSeed: round.client_seed, serverSeedHash: round.server_seed_hash, serverSeed: round.server_seed, nonce: round.nonce, outcome, algorithm: "hmac-sha256-v1" });
  }
  return json({ error: "Unknown action" }, 400);
});
