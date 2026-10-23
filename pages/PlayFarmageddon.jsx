import React from 'react';
import FarmageddonSlot from '@/components/slots/FarmageddonSlot';
import StandaloneSlotPracticePage from '@/components/slots/StandaloneSlotPracticePage';

export default function PlayFarmageddon() {
  return <StandaloneSlotPracticePage SlotComponent={FarmageddonSlot} title="Farmageddon" />;
}
