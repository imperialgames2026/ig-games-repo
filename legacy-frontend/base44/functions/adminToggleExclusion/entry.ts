import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const admin = await base44.auth.me();

    if (admin?.role !== 'superadmin') {
      return Response.json({ error: 'Forbidden: superadmin only' }, { status: 403 });
    }

    const { userId, exclude } = await req.json();

    const updateData = exclude
      ? { is_excluded: true, excluded_at: new Date().toISOString(), excluded_by: admin.email }
      : { is_excluded: false, excluded_at: null, excluded_by: null };

    await base44.asServiceRole.entities.User.update(userId, updateData);

    console.log(`Exclusion ${exclude ? 'invoked' : 'lifted'} for user ${userId} by admin ${admin.email}`);
    return Response.json({ success: true });
  } catch (error) {
    console.error('adminToggleExclusion error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});