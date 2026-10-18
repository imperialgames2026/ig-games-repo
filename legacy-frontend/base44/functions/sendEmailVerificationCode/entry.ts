import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function randomCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const verificationCode = randomCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await base44.auth.updateMe({
      pending_email_verification_code: verificationCode,
      pending_email_verification_expires_at: expiresAt,
      email_verified_for_kyc: false
    });

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: user.email,
      from_name: 'Imperial Gaming Security',
      subject: 'Your Imperial Gaming email verification code',
      body: `
        <h2>Imperial Gaming Verification</h2>
        <p>Your email verification code is:</p>
        <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px;">${verificationCode}</p>
        <p>This code expires in 10 minutes.</p>
      `
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('sendEmailVerificationCode error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});