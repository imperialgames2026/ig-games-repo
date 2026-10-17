import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const SIGNUP_BONUS_IC = 500;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { data, event } = payload;

    if (event?.type !== 'create') {
      return Response.json({ skipped: true, reason: 'not a create event' });
    }

    const referrer_email = String(data?.referrer_email || '').trim().toLowerCase();
    const referred_email = String(data?.referred_email || '').trim().toLowerCase();
    const referralId = data?.id;

    if (!referrer_email || !referred_email) {
      console.error('Missing referrer or referred email');
      return Response.json({ skipped: true, reason: 'missing emails' });
    }

    // Check if bonus already paid (idempotency)
    if (data.signup_bonus_paid) {
      return Response.json({ skipped: true, reason: 'already paid' });
    }

    const duplicateReferrals = await base44.asServiceRole.entities.Referral.filter({ referred_email });
    const canonicalReferral = duplicateReferrals.sort((a, b) => new Date(a.created_date) - new Date(b.created_date))[0];

    if (!canonicalReferral || canonicalReferral.id !== referralId) {
      if (referralId) {
        await base44.asServiceRole.entities.Referral.update(referralId, {
          signup_bonus_paid: true,
        });
      }
      return Response.json({ skipped: true, reason: 'duplicate referral email' });
    }

    // Credit referrer wallet with 500 IC
    const referrerWallets = await base44.asServiceRole.entities.UserWallet.filter({ user_email: referrer_email });
    if (referrerWallets.length > 0) {
      const rw = referrerWallets[0];
      await base44.asServiceRole.entities.UserWallet.update(rw.id, {
        tokens: (rw.tokens || 0) + SIGNUP_BONUS_IC,
      });
      await base44.asServiceRole.entities.Transaction.create({
        user_email: referrer_email,
        type: 'referral_bonus',
        amount: SIGNUP_BONUS_IC,
        description: `Referral signup bonus — ${referred_email} joined using your code`,
        balance_after: (rw.tokens || 0) + SIGNUP_BONUS_IC,
      });
      console.log(`Credited ${SIGNUP_BONUS_IC} IC to referrer ${referrer_email}`);
    } else {
      console.error('No wallet found for referrer:', referrer_email);
    }

    // Credit referred user wallet with 500 IC
    const referredWallets = await base44.asServiceRole.entities.UserWallet.filter({ user_email: referred_email });
    if (referredWallets.length > 0) {
      const uw = referredWallets[0];
      await base44.asServiceRole.entities.UserWallet.update(uw.id, {
        tokens: (uw.tokens || 0) + SIGNUP_BONUS_IC,
      });
      await base44.asServiceRole.entities.Transaction.create({
        user_email: referred_email,
        type: 'referral_bonus',
        amount: SIGNUP_BONUS_IC,
        description: `Welcome bonus — you joined via referral code`,
        balance_after: (uw.tokens || 0) + SIGNUP_BONUS_IC,
      });
      console.log(`Credited ${SIGNUP_BONUS_IC} IC to referred user ${referred_email}`);
    } else {
      console.error('No wallet found for referred user:', referred_email);
    }

    // Mark bonus as paid
    await base44.asServiceRole.entities.Referral.update(referralId, {
      signup_bonus_paid: true,
    });

    return Response.json({ success: true, bonus: SIGNUP_BONUS_IC });
  } catch (error) {
    console.error('processReferralBonus error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});