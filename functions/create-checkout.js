/* global Deno */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { packId, packName, price, tokens, cat_dollars } = await req.json();
    const origin = req.headers.get('origin');

    if (!origin) {
      return Response.json({ error: 'Missing origin' }, { status: 400 });
    }

    const apiKey = Deno.env.get('WIX_PAYMENTS_API_KEY');
    const siteId = Deno.env.get('WIX_PAYMENTS_SITE_ID');

    const response = await fetch('https://www.wixapis.com/payments/platform/v1/checkout-sessions/construct', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': apiKey,
        'wix-site-id': siteId,
      },
      body: JSON.stringify({
        cart: {
          items: [
            {
              name: packName,
              quantity: 1,
              price: Number(price || 0).toFixed(2),
            }
          ],
          customerInfo: {
            email: user.email,
            firstName: user.full_name?.split(' ')[0] || undefined,
            lastName: user.full_name?.split(' ').slice(1).join(' ') || undefined,
          }
        },
        callbackUrls: {
          postFlowUrl: `${origin}/Store`,
          thankYouPageUrl: `${origin}/ThankYou`,
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('create-checkout error', data);
      return Response.json({ error: data?.message || 'Checkout failed', details: data }, { status: response.status });
    }

    await base44.asServiceRole.entities.Transaction.create({
      user_email: user.email,
      type: 'purchase',
      amount: Number(tokens || 0),
      cat_dollars: Number(cat_dollars || 0),
      description: `Checkout started for ${packName}`,
      status: 'pending',
      payment_method: 'card',
      reference_id: data?.checkoutSession?.id || packId || '',
      notes: JSON.stringify({ packId, packName, price })
    });

    return Response.json({
      checkoutUrl: data?.checkoutSession?.redirectUrl,
      checkoutId: data?.checkoutSession?.id,
    });
  } catch (error) {
    console.error('create-checkout fatal', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});