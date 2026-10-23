import React from 'react';
import NeonNightsSlot from '@/components/slots/NeonNightsSlot';
import StandaloneSlotPracticePage from '@/components/slots/StandaloneSlotPracticePage';

export default function PlayNeonNights() {
  return <StandaloneSlotPracticePage SlotComponent={NeonNightsSlot} title="Neon Nights" />;
}
