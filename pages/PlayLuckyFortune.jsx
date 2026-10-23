import React from 'react';
import LuckyFortuneSlot from '@/components/slots/LuckyFortuneSlot';
import StandaloneSlotPracticePage from '@/components/slots/StandaloneSlotPracticePage';

export default function PlayLuckyFortune() {
  return <StandaloneSlotPracticePage SlotComponent={LuckyFortuneSlot} title="Lucky Fortune" />;
}
