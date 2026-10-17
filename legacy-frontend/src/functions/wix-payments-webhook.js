/* global Deno */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import jwt from 'npm:jsonwebtoken@9.0.2';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const publicKey = Deno.env.get('WIX_PAYMENTS_WEBHOOK_PUBLIC_KEY');

    if (!publicKey) {
      return Response.json({ error: 'Missing webhook public key' }, { status: 500 });
    }

    const body = await req.text();
    const rawPayload = jwt.verify(body, publicKey, { algorithms: ['RS256'] });
    const event = JSON.parse(rawPayload.data);
    const eventData = JSON.parse(event.data);

    if (event.eventType === 'wix.ecom.v1.order_approved') {
      const order = eventData.actionEvent.body.order;
      const checkoutId = order.checkoutId;
      const buyerEmail = order?.buyerInfo?.email;
      const amount = Number(order?.priceSummary?.total?.amount || 0);

      const matching = await base44.asServiceRole.entities.Transaction.filter({ reference_id: checkoutId }, '-created_date', 1);
      const purchase = matching[0];

      if (!purchase) {
        return Response.json({ ok: true, skipped: true });
      }

      if (purchase.status === 'completed') {
        return Response.json({ ok: true, duplicate: true });
      }

      const wallets = await base44.asServiceRole.entities.UserWallet.filter({ user_email: purchase.user_email }, '-created_date', 1);
      const wallet = wallets[0];
      if (!wallet) {
        return Response.json({ error: 'Wallet not found' }, { status: 404 });
      }

      const purchaseCount = (wallet.purchase_count || 0) + 1;
      const bonusPercent = wallet.active_bonus || 0;
      const purchasedTokens = Number(purchase.amount || 0);
      const bonusTokens = bonusPercent > 0 ? Math.floor((purchasedTokens * bonusPercent) / 100) : 0;
      const totalTokens = purchasedTokens + bonusTokens;
      const bonusFieldUpdates = {
        active_bonus: 0,
        purchase_count: purchaseCount,
      };

      if (bonusPercent === 150) bonusFieldUpdates.bonus_50_available = false;
      if (bonusPercent === 200) bonusFieldUpdates.bonus_100_available = false;
      if (bonusPercent === 250) bonusFieldUpdates.bonus_150_available = false;

      await base44.asServiceRole.entities.UserWallet.update(wallet.id, {
        tokens: (wallet.tokens || 0) + totalTokens,
        cat_dollars: (wallet.cat_dollars || 0) + Number(purchase.cat_dollars || 0),
        total_purchased: (wallet.total_purchased || 0) + purchasedTokens,
        total_deposited: (wallet.total_deposited || 0) + amount,
        ...bonusFieldUpdates,
      });

      await base44.asServiceRole.entities.Transaction.update(purchase.id, {
        status: 'completed',
        description: `Purchase completed for ${purchase.description?.replace('Checkout started for ', '') || 'token pack'}`,
        notes: JSON.stringify({ orderId: order.id, buyerEmail, checkoutId, bonusTokens })
      });
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error('wix-payments-webhook error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});