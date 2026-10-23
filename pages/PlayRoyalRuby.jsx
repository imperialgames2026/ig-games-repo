import React from 'react';
import RoyalRubySlot from '@/components/slots/RoyalRubySlot';
import StandaloneSlotPracticePage from '@/components/slots/StandaloneSlotPracticePage';

export default function PlayRoyalRuby() {
  return <StandaloneSlotPracticePage SlotComponent={RoyalRubySlot} title="Royal Ruby" />;
}
