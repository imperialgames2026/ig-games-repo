import React from 'react';
import DiamondDynastySlot from '@/components/slots/DiamondDynastySlot';
import StandaloneSlotPracticePage from '@/components/slots/StandaloneSlotPracticePage';

export default function PlayDiamondDynasty() {
  return <StandaloneSlotPracticePage SlotComponent={DiamondDynastySlot} title="Diamond Dynasty" />;
}
