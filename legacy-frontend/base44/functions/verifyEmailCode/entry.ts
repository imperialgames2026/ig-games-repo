import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { code } = await req.json();

    if (!code) {
      return Response.json({ error: 'Verification code is required' }, { status: 400 });
    }

    if (!user.pending_email_verification_code || !user.pending_email_verification_expires_at) {
      return Response.json({ error: 'No active email verification found' }, { status: 400 });
    }

    if (new Date(user.pending_email_verification_expires_at).getTime() < Date.now()) {
      return Response.json({ error: 'Verification code expired' }, { status: 400 });
    }

    if (String(code) !== String(user.pending_email_verification_code)) {
      return Response.json({ error: 'Invalid verification code' }, { status: 400 });
    }

    await base44.auth.updateMe({
      email_verified_for_kyc: true,
      email_verified_for_kyc_at: new Date().toISOString(),
      pending_email_verification_code: '',
      pending_email_verification_expires_at: ''
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('verifyEmailCode error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});