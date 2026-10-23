import React from 'react';
import OceanTreasureSlot from '@/components/slots/OceanTreasureSlot';
import StandaloneSlotPracticePage from '@/components/slots/StandaloneSlotPracticePage';

export default function PlayOceanTreasure() {
  return <StandaloneSlotPracticePage SlotComponent={OceanTreasureSlot} title="Ocean Treasure" />;
}
