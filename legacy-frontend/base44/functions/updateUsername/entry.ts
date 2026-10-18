import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

function sanitizeUsername(value) {
  return String(value || '').trim().replace(/\s+/g, '');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const username = sanitizeUsername(body.username);

    if (!username) {
      return Response.json({ error: 'Username is required' }, { status: 400 });
    }

    const username_normalized = username.toLowerCase();
    const users = await base44.asServiceRole.entities.User.list('-created_date', 10000);
    const duplicate = users.find(
      (u) => u.id !== user.id && String(u.username_normalized || '').toLowerCase() === username_normalized
    );

    if (duplicate) {
      return Response.json({ error: 'That username is already taken' }, { status: 409 });
    }

    const updatedUser = await base44.auth.updateMe({ username, username_normalized });
    return Response.json({ ok: true, user: updatedUser });
  } catch (error) {
    console.error('updateUsername error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});