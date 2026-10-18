import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function getPeriodWindow(questType, now = new Date()) {
  const current = new Date(now);

  if (questType === 'daily') {
    const start = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate(), 0, 0, 0, 0));
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return { start, end };
  }

  const day = current.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate(), 0, 0, 0, 0));
  start.setUTCDate(start.getUTCDate() + diffToMonday);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return { start, end };
}

function isExpired(userQuest) {
  return userQuest.expires_at && new Date(userQuest.expires_at) <= new Date();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { game_slug, bet_amount = 0, win_amount = 0, currency = 'IC' } = await req.json();
    const didPlayRound = Number(bet_amount) > 0;
    const didWinRound = Number(win_amount) > Number(bet_amount);

    if (!didPlayRound) {
      return Response.json({ success: true, updated: 0 });
    }

    const [questDefs, userWallets, userQuests] = await Promise.all([
      base44.asServiceRole.entities.Quest.list(),
      base44.entities.UserWallet.filter({ user_email: user.email }),
      base44.entities.UserQuest.filter({ user_email: user.email }),
    ]);

    const wallet = userWallets[0];
    const activeQuests = questDefs.filter((quest) => quest.is_active && ['daily', 'weekly'].includes(quest.quest_type));
    let updatedCount = 0;

    for (const quest of activeQuests) {
      const { end } = getPeriodWindow(quest.quest_type);
      let userQuest = userQuests.find((item) => item.quest_id === quest.id && !isExpired(item));

      if (!userQuest) {
        userQuest = await base44.entities.UserQuest.create({
          user_email: user.email,
          quest_id: quest.id,
          progress: 0,
          is_completed: false,
          is_claimed: false,
          expires_at: end.toISOString(),
        });
        userQuests.push(userQuest);
      }

      if (userQuest.is_completed || userQuest.is_claimed || isExpired(userQuest)) {
        continue;
      }

      let progress = Number(userQuest.progress || 0);
      let changed = false;

      if (quest.objective_type === 'play_games') {
        progress += 1;
        changed = true;
      }

      if (quest.objective_type === 'win_games' && didWinRound) {
        progress += 1;
        changed = true;
      }

      if (quest.objective_type === 'play_specific_game' && quest.specific_game_slug === game_slug) {
        progress += 1;
        changed = true;
      }

      if (!changed) {
        continue;
      }

      const target = Number(quest.objective_target || 0);
      const isCompleted = progress >= target;
      const nextProgress = Math.min(progress, target);

      if (isCompleted) {
        const walletUpdate = {
          tokens: (wallet?.tokens || 0) + (quest.reward_ic || 0),
        };

        if (quest.reward_id) {
          walletUpdate.cat_dollars = (wallet?.cat_dollars || 0) + (quest.reward_id || 0);
        }

        if (quest.free_spins) {
          walletUpdate.free_spins = (wallet?.free_spins || 0) + quest.free_spins;
          walletUpdate.free_spin_game = quest.free_spin_game || wallet?.free_spin_game || 'wheel';
          walletUpdate.free_spin_bet_amount = quest.free_spin_bet_amount || wallet?.free_spin_bet_amount || 0;
        }

        await Promise.all([
          base44.entities.UserQuest.update(userQuest.id, {
            progress: nextProgress,
            is_completed: true,
            is_claimed: true,
            completed_at: new Date().toISOString(),
          }),
          wallet ? base44.entities.UserWallet.update(wallet.id, walletUpdate) : Promise.resolve(),
          base44.entities.Transaction.create({
            user_email: user.email,
            type: 'bonus',
            amount: quest.reward_ic || 0,
            cat_dollars: quest.reward_id || 0,
            game_slug,
            description: `${quest.quest_type} quest auto reward: ${quest.title}`,
            balance_after: (wallet?.tokens || 0) + (quest.reward_ic || 0),
          }),
        ]);
      } else {
        await base44.entities.UserQuest.update(userQuest.id, {
          progress: nextProgress,
        });
      }

      updatedCount += 1;
    }

    return Response.json({ success: true, updated: updatedCount });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});