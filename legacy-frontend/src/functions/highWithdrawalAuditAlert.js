/* global Deno */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const HIGH_WITHDRAWAL_THRESHOLD = 250;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin' && user?.role !== 'superadmin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const payload = await req.json();
    const requestRecord = payload?.data;

    if (!requestRecord?.id || Number(requestRecord.amount || 0) < HIGH_WITHDRAWAL_THRESHOLD) {
      return Response.json({ ok: true, flagged: false });
    }

    await base44.asServiceRole.entities.WithdrawalRequest.update(requestRecord.id, {
      audit_flag: true,
      audit_reason: `High withdrawal request over ${HIGH_WITHDRAWAL_THRESHOLD} IGD`,
    });

    await base44.asServiceRole.entities.Transaction.create({
      user_email: requestRecord.user_email,
      type: 'withdrawal_alert',
      cent_amount: 0,
      igd_amount: Number(requestRecord.amount || 0),
      igt_amount: 0,
      currency: 'IGD',
      description: `Audit alert created for withdrawal request ${requestRecord.id}`,
      status: 'flagged',
      reference_id: requestRecord.id,
    });

    return Response.json({ ok: true, flagged: true });
  } catch (error) {
    console.error('highWithdrawalAuditAlert error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});