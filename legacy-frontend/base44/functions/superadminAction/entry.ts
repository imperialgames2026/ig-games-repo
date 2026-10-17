import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Superadmin-only backend: wallet edits, KYC override, session data
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'superadmin') {
      console.error('Unauthorized superadmin action attempt by:', user?.email);
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { action } = body;

    // --- WALLET ACTIONS ---
    if (action === 'updateWallet') {
      const { walletId, data } = body;
      const result = await base44.asServiceRole.entities.UserWallet.update(walletId, data);
      console.log(`Superadmin ${user.email} updated wallet ${walletId}:`, JSON.stringify(data));
      return Response.json({ ok: true, result });
    }

    if (action === 'deleteWallet') {
      const { walletId } = body;
      await base44.asServiceRole.entities.UserWallet.delete(walletId);
      console.log(`Superadmin ${user.email} deleted wallet ${walletId}`);
      return Response.json({ ok: true });
    }

    if (action === 'listWallets') {
      const wallets = await base44.asServiceRole.entities.UserWallet.list('-created_date', 500);
      return Response.json({ ok: true, wallets });
    }

    // --- KYC OVERRIDE (approve without criteria) ---
    if (action === 'kycOverride') {
      const { userId, status, notes } = body;
      const updateData = {
        kyc_status: status,
        kyc_reviewed_at: new Date().toISOString(),
        kyc_notes: notes || `Override by superadmin ${user.email}`,
      };
      await base44.asServiceRole.entities.User.update(userId, updateData);
      console.log(`Superadmin KYC override: ${user.email} set user ${userId} to ${status}`);
      return Response.json({ ok: true });
    }

    // --- SESSION / TRACKING DATA ---
    if (action === 'getSessionData') {
      const { email } = body;
      const users = await base44.asServiceRole.entities.User.filter({ email });
      const u = users[0];
      if (!u) return Response.json({ error: 'User not found' }, { status: 404 });
      return Response.json({
        ok: true,
        data: {
          email: u.email,
          full_name: u.full_name,
          last_ip: u.last_ip,
          last_location: u.last_location,
          last_user_agent: u.last_user_agent,
          last_seen_at: u.last_seen_at,
          ip_history: u.ip_history || [],
          registration_ip: u.registration_ip,
          registration_location: u.registration_location,
          device_fingerprint: u.device_fingerprint,
        }
      });
    }

    if (action === 'getAllSessionData') {
      const users = await base44.asServiceRole.entities.User.list('-created_date', 500);
      const data = users.map(u => ({
        email: u.email,
        full_name: u.full_name,
        last_ip: u.last_ip,
        last_location: u.last_location,
        last_seen_at: u.last_seen_at,
        registration_ip: u.registration_ip,
        registration_location: u.registration_location,
        ip_count: (u.ip_history || []).length,
      }));
      return Response.json({ ok: true, data });
    }

    if (action === 'updateUserEmail') {
      const { userId, email } = body;
      const normalizedEmail = String(email || '').trim().toLowerCase();
      if (!normalizedEmail) {
        return Response.json({ error: 'Email is required' }, { status: 400 });
      }
      const result = await base44.asServiceRole.entities.User.update(userId, { email: normalizedEmail });
      console.log(`Superadmin ${user.email} updated email for user ${userId} to ${normalizedEmail}`);
      return Response.json({ ok: true, result });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    console.error('superadminAction error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});