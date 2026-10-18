import React from 'react';
import SharedEventPracticeTable from '@/components/games/SharedEventPracticeTable';

// Staging-only server-settled shared practice chips. No financial gameplay.
export default function PlayBaccarat() {
  return <SharedEventPracticeTable mode="baccarat" />;
}
