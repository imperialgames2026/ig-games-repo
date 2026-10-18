import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin' && user?.role !== 'superadmin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Use service role to bypass RLS and get all users
    const allUsers = await base44.asServiceRole.entities.User.list('-created_date', 1000);

    return Response.json({ users: allUsers });
  } catch (error) {
    console.error('adminGetKYCUsers error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});