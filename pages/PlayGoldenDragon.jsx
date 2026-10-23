import React from 'react';
import GoldenDragonSlot from '@/components/slots/GoldenDragonSlot';
import StandaloneSlotPracticePage from '@/components/slots/StandaloneSlotPracticePage';

export default function PlayGoldenDragon() {
  return <StandaloneSlotPracticePage SlotComponent={GoldenDragonSlot} title="Golden Dragon" />;
}
