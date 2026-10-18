import React from 'react';
import MultiplayerPracticeTable from '@/components/games/MultiplayerPracticeTable';

// Staging-only shared table. Legacy browser-controlled wallet settlement is retired.
export default function PlayCraps() {
  return <MultiplayerPracticeTable game="craps" />;
}
