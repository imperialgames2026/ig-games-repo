import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { event, data, old_data } = payload;

    if (!data?.user_email) {
      return Response.json({ skipped: true, reason: 'no user_email' });
    }

    const transactions = [];

    // IC (tokens) change
    const oldTokens = old_data?.tokens ?? null;
    const newTokens = data?.tokens ?? null;
    if (oldTokens !== null && newTokens !== null && oldTokens !== newTokens) {
      const delta = newTokens - oldTokens;
      let type = delta > 0 ? 'admin_credit' : 'admin_debit';
      let description = delta > 0 ? 'Admin IC credit' : 'Admin IC debit';

      // Try to infer type from context
      if (data.last_tx_type) {
        type = data.last_tx_type;
        description = data.last_tx_description || description;
      }

      transactions.push({
        user_email: data.user_email,
        type,
        amount: delta,
        balance_after: newTokens,
        description,
        notes: `IC balance changed: ${oldTokens} → ${newTokens}`,
      });
    }

    // ID (cat_dollars) change
    const oldID = old_data?.cat_dollars ?? null;
    const newID = data?.cat_dollars ?? null;
    if (oldID !== null && newID !== null && Math.abs(oldID - newID) >= 0.01) {
      const delta = parseFloat((newID - oldID).toFixed(4));
      const type = delta > 0 ? 'admin_credit' : 'admin_debit';

      transactions.push({
        user_email: data.user_email,
        type,
        amount: 0,
        cat_dollars: delta,
        balance_after: newTokens ?? data.tokens,
        description: delta > 0 ? 'Admin ID credit' : 'Admin ID debit',
        notes: `ID balance changed: ${oldID} → ${newID}`,
      });
    }

    if (transactions.length === 0) {
      return Response.json({ skipped: true, reason: 'no balance change detected' });
    }

    const walletOwner = data.user_email;
    const automationUser = await base44.auth.me().catch(() => null);

    for (const tx of transactions) {
      await base44.asServiceRole.entities.Transaction.create({
        ...tx,
        user_email: walletOwner,
      }, {
        user: automationUser?.email ? { email: automationUser.email } : { email: walletOwner }
      });
    }

    console.log(`Logged ${transactions.length} transaction(s) for ${data.user_email}`);
    return Response.json({ success: true, logged: transactions.length });
  } catch (error) {
    console.error('logWalletChange error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});