import React from 'react';
import EmeraldEmpireSlot from '@/components/slots/EmeraldEmpireSlot';
import StandaloneSlotPracticePage from '@/components/slots/StandaloneSlotPracticePage';

export default function PlayEmeraldEmpire() {
  return <StandaloneSlotPracticePage SlotComponent={EmeraldEmpireSlot} title="Emerald Empire" />;
}
