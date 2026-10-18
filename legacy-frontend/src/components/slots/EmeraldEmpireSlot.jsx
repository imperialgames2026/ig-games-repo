import React from 'react';
import StandaloneSlotGame from './StandaloneSlotGame';
import { standaloneThemes } from './slotStandaloneThemes';

const SYMBOLS = {
  EMERALD: { id: 'EMERALD', emoji: '💚', label: 'Emerald', special: false },
  DIAMOND: { id: 'DIAMOND', emoji: '💎', label: 'Diamond', special: false },
  STAR:    { id: 'STAR',    emoji: '🌟', label: 'Star',    special: false },
  SPARKLE: { id: 'SPARKLE', emoji: '✨', label: 'Sparkle', special: false },
  CLOVER:  { id: 'CLOVER',  emoji: '🍀', label: 'Clover',  special: false },
  LEAF:    { id: 'LEAF',    emoji: '🌿', label: 'Leaf',    special: false },
  MOON:    { id: 'MOON',    emoji: '🌙', label: 'Moon',    special: false },
  WILD:    { id: 'WILD',    emoji: '🌴', label: 'WILD',    special: true  },
  SCATTER: { id: 'SCATTER', emoji: '🏯', label: 'SCATTER', special: true  },
};

const PAY = {
  'EMERALD': [160, 600, 2000, 4000],
  'DIAMOND': [320, 1200, 4000, 8000],
  'STAR':    [80,  300, 1000, 2000],
  'SPARKLE': [40,  150, 500,  1000],
  'CLOVER':  [24,  90,  300,  600 ],
  'LEAF':    [12,  45,  150,  300 ],
  'MOON':    [6,   22,  75,   150 ],
};

const POOL = [
  ...Array(28).fill('MOON'), ...Array(22).fill('LEAF'), ...Array(16).fill('CLOVER'),
  ...Array(10).fill('SPARKLE'), ...Array(7).fill('STAR'), ...Array(3).fill('EMERALD'), ...Array(1).fill('DIAMOND'),
  ...Array(5).fill('WILD'), ...Array(2).fill('SCATTER'),
];

// Empire Expansion — conquers adjacent reels, adding a territory bonus
const BONUS = {
  name: '🏯 EMPIRE EXPANSION',
  description: 'The empire expands after wins — grants a territory bonus of 2×–8× the bet.',
  triggerChance: 0.28,
  onTrigger: (bet) => {
    const mult = Math.floor(Math.random() * 7) + 2;
    return bet * mult;
  },
};

export default function EmeraldEmpireSlot({ wallet, onBet, currency = 'IC' }) {
  return <StandaloneSlotGame gameSlug="emerald-empire" slotType="emerald-empire" title="Emerald Empire" titleEmoji="💚" theme={standaloneThemes.emerald} symbols={SYMBOLS} wallet={wallet} onBet={onBet} currency={currency} />;
}