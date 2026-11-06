import { approvedPracticeGames } from './approvedPracticeGames.js';
import { pendingPvpGames } from './pvpIntegration.mjs';

// Count the enabled catalog, without implying review or release readiness.
export function practiceCatalogSummary(pvpEnabled) {
  return pvpEnabled === 'true'
    ? { count: pendingPvpGames.length, label: 'Practice variants' }
    : { count: approvedPracticeGames.length, label: 'Practice tables' };
}
