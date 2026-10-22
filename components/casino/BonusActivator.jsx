import React from 'react';
import ProgramUnavailable from './ProgramUnavailable';

export default function BonusActivator({ compact = false }) {
  return <ProgramUnavailable title="Purchase bonuses" compact={compact}>Purchase bonuses cannot be activated or redeemed while purchases are unavailable.</ProgramUnavailable>;
}
