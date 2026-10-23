import React from 'react';
import SapphireStormSlot from '@/components/slots/SapphireStormSlot';
import StandaloneSlotPracticePage from '@/components/slots/StandaloneSlotPracticePage';

export default function PlaySapphireStorm() {
  return <StandaloneSlotPracticePage SlotComponent={SapphireStormSlot} title="Sapphire Storm" />;
}
