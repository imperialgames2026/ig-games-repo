import { createClient } from "npm:@supabase/supabase-js@2";

const HEADERS = {
  "content-type": "application/json",
  "cache-control": "no-store",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
  "access-control-allow-methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: HEADERS });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (value: unknown): value is string => typeof value === "string" && uuid.test(value);
const roles = new Set(["player", "tester", "admin", "superadmin"]);
const staff = new Set(["admin", "superadmin"]);

// Authorized Supabase replacement for Base44's support chat, not an AI chatbot.
// No email, file uploads, payment handlers, or direct user-ID attribution.
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: HEADERS });
  if (req.method !== "POST") return reply({ error: "POST required" }, 405);
  const jwt = req.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  if (!jwt) return reply({ error: "Authentication required" }, 401);
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key || !secret) return reply({ error: "Backend unavailable" }, 503);

  const auth = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await auth.auth.getUser(jwt);
  if (authError || !user || user.is_anonymous) return reply({ error: "Invalid session" }, 401);
  const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const [{ data: profile, error: profileError }, { data: role, error: roleError }] = await Promise.all([
    db.from("profiles").select("id,is_excluded").eq("id", user.id).maybeSingle(),
    db.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
  ]);
  if (profileError || roleError) return reply({ error: "Account verification unavailable" }, 503);
  // An excluded account may access support to appeal its restrictions.
  if (!profile || profile.id !== user.id || typeof profile.is_excluded !== "boolean" ||
      !role || !roles.has(role.role)) return reply({ error: "Account unavailable" }, 403);
  // An excluded staff account may still open a personal appeal, but may not
  // read, moderate or answer other players' support conversations.
  const isStaff = staff.has(role.role) && profile.is_excluded === false;

  const raw = await req.text().catch(() => "");
  if (raw.length > 4096) return reply({ error: "Request too large" }, 413);
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw Error("Invalid body");
  } catch { return reply({ error: "Invalid JSON" }, 400); }

  const keys = Object.keys(body);
  const exact = (allowed: string[]) => keys.length === allowed.length && keys.every(k => allowed.includes(k));
  const action = body.action;
  if (action === "mine" && exact(["action"])) {
    const { data, error } = await db.from("ig_support_tickets")
      .select("id,subject,status,created_at,updated_at").eq("user_id", user.id)
      .order("updated_at", { ascending: false }).limit(30);
    return error ? reply({ error: "Support unavailable" }, 503) : reply({ tickets: data ?? [] });
  }
  if (action === "queue" && exact(["action"])) {
    if (!isStaff) return reply({ error: "Staff role required" }, 403);
    const { data, error } = await db.from("ig_support_tickets")
      .select("id,user_id,subject,status,created_at,updated_at,assigned_to")
      .order("updated_at", { ascending: false }).limit(100);
    return error ? reply({ error: "Queue unavailable" }, 503) : reply({ tickets: data ?? [] });
  }
  if (action === "messages" && exact(["action", "ticketId"]) && isUuid(body.ticketId)) {
    const { data: ticket, error: ticketError } = await db.from("ig_support_tickets")
      .select("id,user_id,status,subject").eq("id", body.ticketId).maybeSingle();
    if (ticketError) return reply({ error: "Ticket lookup unavailable" }, 503);
    if (!ticket || (!isStaff && ticket.user_id !== user.id)) return reply({ error: "Ticket not found" }, 404);
    const { data, error } = await db.from("ig_support_messages")
      .select("id,sender_kind,body,created_at").eq("ticket_id", ticket.id)
      .order("created_at", { ascending: true }).limit(100);
    return error ? reply({ error: "Conversation unavailable" }, 503) :
      reply({ ticket: { id: ticket.id, subject: ticket.subject, status: ticket.status }, messages: data ?? [] });
  }
  if (action === "open" && exact(["action", "subject", "body", "requestId"])) {
    if (!isUuid(body.requestId) || typeof body.subject !== "string" ||
        body.subject.trim().length < 3 || body.subject.trim().length > 120 ||
        typeof body.body !== "string" || body.body.trim().length < 1 ||
        body.body.trim().length > 2000) return reply({ error: "Invalid ticket" }, 400);
    const { data, error } = await db.rpc("ig_support_open", {
      p_user: user.id, p_subject: body.subject, p_body: body.body, p_request: body.requestId,
    });
    if (error) return reply({ error: error.code === "22023" ? "Too many open tickets or invalid details" : "Support unavailable" },
      error.code === "22023" ? 422 : 503);
    return reply({ id: data, status: "open" });
  }
  if (action === "post" && exact(["action", "ticketId", "body", "requestId"])) {
    if (!isUuid(body.ticketId) || !isUuid(body.requestId) || typeof body.body !== "string" ||
        body.body.trim().length < 1 || body.body.trim().length > 2000)
      return reply({ error: "Invalid message" }, 400);
    const { data, error } = await db.rpc("ig_support_post", {
      p_actor: user.id, p_ticket: body.ticketId, p_body: body.body,
      p_request: body.requestId, p_is_staff: isStaff,
    });
    if (error) return reply({ error: error.code === "42501" ? "Ticket not found" :
      error.code === "22023" ? "Ticket closed or message invalid" : "Support unavailable" },
      error.code === "42501" ? 404 : error.code === "22023" ? 422 : 503);
    return reply({ id: data });
  }
  if (action === "status" && exact(["action", "ticketId", "status"]) &&
      isUuid(body.ticketId) && ["open", "in_progress", "closed"].includes(String(body.status))) {
    if (!isStaff) return reply({ error: "Staff role required" }, 403);
    const { error } = await db.rpc("ig_support_staff_status", {
      p_actor: user.id, p_ticket: body.ticketId, p_status: body.status,
    });
    return error ? reply({ error: "Status change unavailable" }, error.code === "22023" ? 404 : 503) :
      reply({ updated: true });
  }
  return reply({ error: "Unsupported support operation" }, 400);
});
