import React from 'react';
import PhoenixFireSlot from '@/components/slots/PhoenixFireSlot';
import StandaloneSlotPracticePage from '@/components/slots/StandaloneSlotPracticePage';

export default function PlayPhoenixFire() {
  return <StandaloneSlotPracticePage SlotComponent={PhoenixFireSlot} title="Phoenix Fire" />;
}
