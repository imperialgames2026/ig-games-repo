import React from 'react';
import StandaloneSlotGame from './StandaloneSlotGame';
import { standaloneThemes } from './slotStandaloneThemes';

const SYMBOLS = {
  BOLT:    { id: 'BOLT',    emoji: '⚡', label: 'Bolt',    special: false },
  PURPLE:  { id: 'PURPLE',  emoji: '💜', label: 'Purple',  special: false },
  BLUE:    { id: 'BLUE',    emoji: '💙', label: 'Blue',    special: false },
  GREEN:   { id: 'GREEN',   emoji: '💚', label: 'Green',   special: false },
  CIRCLE3: { id: 'CIRCLE3', emoji: '🟣', label: 'Violet',  special: false },
  CIRCLE2: { id: 'CIRCLE2', emoji: '🔵', label: 'Cobalt',  special: false },
  CIRCLE1: { id: 'CIRCLE1', emoji: '🟢', label: 'Neon',    special: false },
  WILD:    { id: 'WILD',    emoji: '🌐', label: 'WILD',    special: true  },
  SCATTER: { id: 'SCATTER', emoji: '💫', label: 'SCATTER', special: true  },
};

const PAY = {
  'BOLT':    [150, 500, 2000, 3500],
  'PURPLE':  [80,  300, 1000, 2000],
  'BLUE':    [40,  150, 500,  1000],
  'GREEN':   [20,  75,  250,  500 ],
  'CIRCLE3': [12,  40,  125,  250 ],
  'CIRCLE2': [6,   20,  60,   125 ],
  'CIRCLE1': [3,   10,  30,   60  ],
};

const POOL = [
  ...Array(28).fill('CIRCLE1'), ...Array(22).fill('CIRCLE2'), ...Array(16).fill('CIRCLE3'),
  ...Array(10).fill('GREEN'), ...Array(7).fill('BLUE'), ...Array(4).fill('PURPLE'), ...Array(1).fill('BOLT'),
  ...Array(5).fill('WILD'), ...Array(2).fill('SCATTER'),
];

// Neon-specific bonus: Neon Surge — entire winning line x2 for 3 consecutive wins
const BONUS = {
  name: '⚡ NEON SURGE',
  description: 'Triggered after wins — applies a random 2×–6× neon multiplier to the round.',
  triggerChance: 0.28,
  onTrigger: (bet) => {
    const mult = Math.floor(Math.random() * 5) + 2;
    return bet * mult * (Math.floor(Math.random() * 4) + 1);
  },
};

export default function NeonNightsSlot({ wallet, onBet, currency = 'IC' }) {
  return <StandaloneSlotGame gameSlug="neon-nights" slotType="neon-nights" title="Neon Nights" titleEmoji="⚡" theme={standaloneThemes.neon} symbols={SYMBOLS} wallet={wallet} onBet={onBet} currency={currency} />;
}