import React from 'react';
import MysticForestSlot from '@/components/slots/MysticForestSlot';
import StandaloneSlotPracticePage from '@/components/slots/StandaloneSlotPracticePage';

export default function PlayMysticForest() {
  return <StandaloneSlotPracticePage SlotComponent={MysticForestSlot} title="Mystic Forest" />;
}
