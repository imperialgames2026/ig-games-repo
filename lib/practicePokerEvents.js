import { requireSupabase } from './supabaseClient';
import { isPokerId } from './pokerTableView';

// Restored from casino-zip's migrated event lobby. The service owns eligibility,
// registration and seating; this transport never sends user IDs or chip awards.
export function createPracticePokerEvents(clientProvider) {
  async function call(action, eventId) {
    if (action !== 'list' && !isPokerId(eventId)) throw new Error('Invalid poker event ID');
    const body = action === 'list' ? {action} : {action, eventId};
    const {data, error} = await clientProvider().functions.invoke('poker-events-v1', {body});
    if (error) {
      const details = await error.context?.json?.().catch(() => null);
      throw new Error(details?.error || 'Poker events are unavailable. You can still open a private room.');
    }
    if (!data || data.error) throw new Error(data?.error || 'Poker events are unavailable.');
    return data;
  }
  return Object.freeze({
    list: () => call('list'),
    register: eventId => call('register', eventId),
    tables: eventId => call('tables', eventId),
  });
}

export const practicePokerEvents = createPracticePokerEvents(requireSupabase);
