import React from 'react';
import AztecTreasureSlot from '@/components/slots/AztecTreasureSlot';
import StandaloneSlotPracticePage from '@/components/slots/StandaloneSlotPracticePage';

export default function PlayAztecTreasure() {
  return <StandaloneSlotPracticePage SlotComponent={AztecTreasureSlot} title="Aztec Treasure" />;
}
