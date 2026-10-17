import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'superadmin') {
      return Response.json({ error: 'Forbidden: superadmin only' }, { status: 403 });
    }

    const { userId, status, notes } = await req.json();

    await base44.asServiceRole.entities.User.update(userId, {
      kyc_status: status,
      kyc_reviewed_at: new Date().toISOString(),
      kyc_notes: notes || '',
    });

    console.log(`KYC ${status} for user ${userId} by admin ${user.email}`);
    return Response.json({ success: true });
  } catch (error) {
    console.error('adminUpdateKYC error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});