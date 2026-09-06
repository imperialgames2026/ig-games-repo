import { useCallback } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Returns a function to call after each bet to track weekly tournament wagers.
 * Usage: const trackWager = useWeeklyWagerTracker(user);
 *        trackWager(betAmount, currency);
 */
export function useWeeklyWagerTracker(user) {
  return useCallback(async (betAmount, currency = 'IC') => {
    if (!user || !betAmount || betAmount <= 0 || currency !== 'IC') return;
    try {
      await base44.functions.invoke('trackWeeklyWager', {
        betAmount,
        currency,
        displayName: user.full_name || user.email,
      });
    } catch (_) {
      // Silent — don't break the game if tracking fails
    }
  }, [user]);
}