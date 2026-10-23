import React from 'react';
import CosmicCrownSlot from '@/components/slots/CosmicCrownSlot';
import StandaloneSlotPracticePage from '@/components/slots/StandaloneSlotPracticePage';

export default function PlayCosmicCrown() {
  return <StandaloneSlotPracticePage SlotComponent={CosmicCrownSlot} title="Cosmic Crown" />;
}
