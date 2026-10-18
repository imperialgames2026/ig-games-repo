import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { trigger_type, value } = await req.json();

    // Get active achievements
    const achievements = await base44.asServiceRole.entities.Achievement.list();
    const activeAchievements = achievements.filter(a => a.is_active);
    
    // Get user's achievement progress
    const userAchievements = await base44.entities.UserAchievement.filter({ 
      user_email: user.email 
    });

    // Get wallet for stats
    const wallets = await base44.entities.UserWallet.filter({ user_email: user.email });
    const wallet = wallets[0];

    if (!wallet) {
      return Response.json({ error: 'Wallet not found' }, { status: 404 });
    }

    // Check and update progress for each achievement
    for (const achievement of activeAchievements) {
      let userAchievement = userAchievements.find(ua => ua.achievement_id === achievement.id);
      
      // Create user achievement if doesn't exist
      if (!userAchievement) {
        userAchievement = await base44.entities.UserAchievement.create({
          user_email: user.email,
          achievement_id: achievement.id,
          progress: 0,
          is_completed: false,
          is_claimed: false,
        });
      }

      // Skip if already completed
      if (userAchievement.is_completed) continue;

      let currentProgress = userAchievement.progress;
      let shouldUpdate = false;

      // Calculate progress based on objective type
      switch (achievement.objective_type) {
        case 'total_games':
          if (trigger_type === 'game_played') {
            currentProgress = (wallet.total_won || 0) + (wallet.total_lost || 0);
            shouldUpdate = true;
          }
          break;
        
        case 'total_wins':
          if (trigger_type === 'game_won') {
            currentProgress = wallet.total_won || 0;
            shouldUpdate = true;
          }
          break;
        
        case 'total_wagered':
          if (trigger_type === 'wager') {
            currentProgress = (wallet.total_won || 0) + (wallet.total_lost || 0);
            shouldUpdate = true;
          }
          break;
        
        case 'vip_level':
          if (trigger_type === 'vip_update') {
            currentProgress = wallet.vip_level || 1;
            shouldUpdate = true;
          }
          break;
        
        case 'referrals':
          if (trigger_type === 'referral') {
            const referrals = await base44.entities.Referral.filter({ 
              referrer_email: user.email 
            });
            currentProgress = referrals.length;
            shouldUpdate = true;
          }
          break;
      }

      if (shouldUpdate) {
        const isCompleted = currentProgress >= achievement.objective_target;
        
        await base44.entities.UserAchievement.update(userAchievement.id, {
          progress: currentProgress,
          is_completed: isCompleted,
          completed_at: isCompleted ? new Date().toISOString() : userAchievement.completed_at,
        });
      }
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Achievement check error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});