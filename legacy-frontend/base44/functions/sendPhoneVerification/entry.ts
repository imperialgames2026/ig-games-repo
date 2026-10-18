import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
const AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
const FROM_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER');

function normalizePhone(phone) {
  return String(phone || '').replace(/[\s()-]/g, '');
}

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

    const { phone } = await req.json();
    const normalizedPhone = normalizePhone(phone);

    if (!normalizedPhone) {
      return Response.json({ error: 'Phone number is required' }, { status: 400 });
    }

    const verificationCode = randomCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const body = new URLSearchParams({
      To: normalizedPhone,
      From: FROM_NUMBER,
      Body: `Imperial Gaming verification code: ${verificationCode}. This code expires in 10 minutes.`
    });

    const twilioResponse = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${ACCOUNT_SID}:${AUTH_TOKEN}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body
    });

    const twilioData = await twilioResponse.json();
    console.log('Twilio send response:', twilioData);

    if (!twilioResponse.ok) {
      return Response.json({ error: twilioData.message || 'Failed to send SMS' }, { status: 400 });
    }

    await base44.auth.updateMe({
      pending_phone_number: normalizedPhone,
      pending_phone_verification_code: verificationCode,
      pending_phone_verification_expires_at: expiresAt,
      phone_verified: false
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('sendPhoneVerification error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});