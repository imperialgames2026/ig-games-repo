import React from 'react';
import StandaloneSlotGame from './StandaloneSlotGame';
import { standaloneThemes } from './slotStandaloneThemes';

const SYMBOLS = {
  DIAMOND: { id: 'DIAMOND', emoji: '💎', label: 'Diamond', special: false },
  HEART:   { id: 'HEART',   emoji: '❤️', label: 'Heart',   special: false },
  CROWN:   { id: 'CROWN',   emoji: '👑', label: 'Crown',   special: false },
  RING:    { id: 'RING',    emoji: '💍', label: 'Ring',    special: false },
  ROSE:    { id: 'ROSE',    emoji: '🌹', label: 'Rose',    special: false },
  STAR:    { id: 'STAR',    emoji: '⭐', label: 'Star',    special: false },
  BOW:     { id: 'BOW',     emoji: '🎀', label: 'Bow',     special: false },
  WILD:    { id: 'WILD',    emoji: '💫', label: 'WILD',    special: true  },
  SCATTER: { id: 'SCATTER', emoji: '🏆', label: 'SCATTER', special: true  },
};

const PAY = {
  'DIAMOND': [160, 600, 2000, 4000],
  'HEART':   [80,  300, 1000, 2000],
  'CROWN':   [55,  200, 700,  1400],
  'RING':    [22,  80,  280,  550 ],
  'ROSE':    [11,  40,  140,  280 ],
  'STAR':    [6,   20,  70,   140 ],
  'BOW':     [3,   10,  35,   70  ],
};

const POOL = [
  ...Array(28).fill('BOW'), ...Array(22).fill('STAR'), ...Array(16).fill('ROSE'),
  ...Array(10).fill('RING'), ...Array(7).fill('CROWN'), ...Array(3).fill('HEART'), ...Array(1).fill('DIAMOND'),
  ...Array(5).fill('WILD'), ...Array(2).fill('SCATTER'),
];

// Ruby Glow — winning line doubles its payout
const BONUS = {
  name: '💎 RUBY GLOW',
  description: 'After a win, the rarest winning symbol may "glow" applying a 3×–7× royal bonus.',
  triggerChance: 0.28,
  onTrigger: (bet) => {
    const mult = Math.floor(Math.random() * 5) + 3;
    return bet * mult;
  },
};

export default function RoyalRubySlot({ wallet, onBet, currency = 'IC' }) {
  return <StandaloneSlotGame gameSlug="royal-ruby" slotType="royal-ruby" title="Royal Ruby" titleEmoji="💎" theme={standaloneThemes.ruby} symbols={SYMBOLS} wallet={wallet} onBet={onBet} currency={currency} />;
}