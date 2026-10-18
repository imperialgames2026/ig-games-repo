import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userQuestId } = await req.json();
    if (!userQuestId) {
      return Response.json({ error: 'Missing userQuestId' }, { status: 400 });
    }

    const userQuests = await base44.entities.UserQuest.filter({ user_email: user.email });
    const userQuest = userQuests.find((item) => item.id === userQuestId);
    if (!userQuest) {
      return Response.json({ error: 'Quest not found' }, { status: 404 });
    }

    if (!userQuest.is_completed || userQuest.is_claimed) {
      return Response.json({ error: 'Quest is not claimable' }, { status: 400 });
    }

    if (userQuest.expires_at && new Date(userQuest.expires_at) <= new Date()) {
      return Response.json({ error: 'Quest expired' }, { status: 400 });
    }

    const quests = await base44.asServiceRole.entities.Quest.list();
    const quest = quests.find((item) => item.id === userQuest.quest_id);
    if (!quest) {
      return Response.json({ error: 'Quest definition missing' }, { status: 404 });
    }

    const wallets = await base44.entities.UserWallet.filter({ user_email: user.email });
    const wallet = wallets[0];
    if (!wallet) {
      return Response.json({ error: 'Wallet not found' }, { status: 404 });
    }

    const walletUpdate = {
      cat_dollars: (wallet.cat_dollars || 0) + (quest.reward_id || 0),
      tokens: (wallet.tokens || 0) + (quest.reward_ic || 0),
    };

    if (quest.objective_type === 'vip_level_up') {
      walletUpdate.cat_dollars = (wallet.cat_dollars || 0) + ((wallet.vip_level || 1) * 3);
    }

    if (quest.title === 'Win 25 Games') {
      walletUpdate.free_spins = (wallet.free_spins || 0) + 15;
      walletUpdate.free_spin_game = wallet.free_spin_game || 'wheel';
    }

    await base44.entities.UserWallet.update(wallet.id, walletUpdate);
    await base44.entities.UserQuest.update(userQuest.id, { is_claimed: true });
    const rewardedId = quest.objective_type === 'vip_level_up' ? ((wallet.vip_level || 1) * 3) : (quest.reward_id || 0);

    await base44.entities.Transaction.create({
      user_email: user.email,
      type: 'bonus',
      amount: quest.reward_ic || 0,
      cat_dollars: rewardedId,
      description: `${quest.quest_type === 'weekly' ? 'Weekly' : 'Daily'} Quest Reward: ${quest.title}`,
      balance_after: (wallet.tokens || 0) + (quest.reward_ic || 0),
    });

    return Response.json({ success: true, reward_id: rewardedId, reward_ic: quest.reward_ic || 0 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});