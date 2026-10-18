import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const CURRENCY_FIELDS = {
  IGC: 'tokens',
  IGUSD: 'cat_dollars',
  IGT: 'igt_tokens',
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { recipientEmail, currency, amount, note } = await req.json();
    const normalizedCurrency = String(currency || '').toUpperCase();
    const transferAmount = Number(amount || 0);
    const recipient = String(recipientEmail || '').trim().toLowerCase();
    const sender = String(user.email || '').trim().toLowerCase();
    const field = CURRENCY_FIELDS[normalizedCurrency];

    if (!field) {
      return Response.json({ error: 'Invalid currency' }, { status: 400 });
    }

    if (!recipient || !recipient.includes('@')) {
      return Response.json({ error: 'Enter a valid recipient email' }, { status: 400 });
    }

    if (recipient === sender) {
      return Response.json({ error: 'You cannot gift yourself' }, { status: 400 });
    }

    if (!transferAmount || transferAmount <= 0) {
      return Response.json({ error: 'Enter a valid amount' }, { status: 400 });
    }

    const senderWallets = await base44.entities.UserWallet.filter({ user_email: user.email });
    const senderWallet = senderWallets[0];

    if (!senderWallet) {
      return Response.json({ error: 'Your wallet was not found' }, { status: 404 });
    }

    const senderBalance = Number(senderWallet[field] || 0);

    if (senderBalance < transferAmount) {
      return Response.json({ error: 'Not enough balance for this gift' }, { status: 400 });
    }

    const recipientWallets = await base44.asServiceRole.entities.UserWallet.filter({ user_email: recipient });
    const recipientWallet = recipientWallets[0];

    if (!recipientWallet) {
      return Response.json({ error: 'Recipient wallet not found' }, { status: 404 });
    }

    const nextSenderBalance = Number((senderBalance - transferAmount).toFixed(8));
    const nextRecipientBalance = Number((Number(recipientWallet[field] || 0) + transferAmount).toFixed(8));

    await base44.entities.UserWallet.update(senderWallet.id, {
      [field]: nextSenderBalance,
      last_tx_type: 'gift_sent',
      last_tx_description: `Gifted ${transferAmount.toLocaleString()} ${normalizedCurrency} to ${recipient}`,
    });

    await base44.asServiceRole.entities.UserWallet.update(recipientWallet.id, {
      [field]: nextRecipientBalance,
      last_tx_type: 'gift_received',
      last_tx_description: `Received ${transferAmount.toLocaleString()} ${normalizedCurrency} from ${sender}`,
    });

    await base44.asServiceRole.entities.WalletGift.create({
      sender_email: user.email,
      recipient_email: recipient,
      currency: normalizedCurrency,
      amount: transferAmount,
      note: String(note || '').slice(0, 240),
      status: 'completed',
    });

    return Response.json({
      success: true,
      currency: normalizedCurrency,
      amount: transferAmount,
      recipient_email: recipient,
      balance_after: nextSenderBalance,
    });
  } catch (error) {
    console.error('sendWalletGift error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});