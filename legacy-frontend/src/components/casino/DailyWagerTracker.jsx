import { base44 } from '@/api/base44Client';

export async function trackDailyWager(userEmail, wagerAmount) {
  const today = new Date().toISOString().split('T')[0];
  
  try {
    // Get or create today's daily wager record
    const existingWagers = await base44.entities.DailyWager.filter({
      user_email: userEmail,
      date: today
    });

    if (existingWagers.length > 0) {
      const wager = existingWagers[0];
      const newTotal = wager.total_wagered + wagerAmount;
      const newSpinsEarned = Math.floor(newTotal / 8000);
      
      await base44.entities.DailyWager.update(wager.id, {
        total_wagered: newTotal,
        spins_earned: newSpinsEarned
      });
    } else {
      const spinsEarned = Math.floor(wagerAmount / 8000);
      await base44.entities.DailyWager.create({
        user_email: userEmail,
        date: today,
        total_wagered: wagerAmount,
        spins_earned: spinsEarned,
        spins_used: 0
      });
    }
  } catch (error) {
    console.error('Failed to track daily wager:', error);
  }
}