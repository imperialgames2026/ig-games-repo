import React from 'react';
import StandaloneSlotGame from './StandaloneSlotGame';
import { standaloneThemes } from './slotStandaloneThemes';

const SYMBOLS = {
  DIAMOND: { id: 'DIAMOND', emoji: '💎', label: 'Diamond',  special: false },
  CROWN:   { id: 'CROWN',   emoji: '👑', label: 'Crown',    special: false },
  CASTLE:  { id: 'CASTLE',  emoji: '🏰', label: 'Castle',   special: false },
  FLEUR:   { id: 'FLEUR',   emoji: '⚜️', label: 'Fleur',    special: false },
  TRIDENT: { id: 'TRIDENT', emoji: '🔱', label: 'Trident',  special: false },
  SPARKLE: { id: 'SPARKLE', emoji: '✨', label: 'Sparkle',  special: false },
  DIZZY:   { id: 'DIZZY',   emoji: '💫', label: 'Dizzy',    special: false },
  WILD:    { id: 'WILD',    emoji: '🗡️', label: 'WILD',     special: true  },
  SCATTER: { id: 'SCATTER', emoji: '🛡️', label: 'SCATTER',  special: true  },
};

const PAY = {
  'DIAMOND': [200, 800, 2500, 5000],
  'CROWN':   [100, 400, 1200, 2500],
  'CASTLE':  [40,  150, 500,  1000],
  'FLEUR':   [16,  60,  200,  400 ],
  'TRIDENT': [8,   30,  100,  200 ],
  'SPARKLE': [4,   16,  50,   100 ],
  'DIZZY':   [2,   8,   25,   50  ],
};

const POOL = [
  ...Array(28).fill('DIZZY'), ...Array(22).fill('SPARKLE'), ...Array(16).fill('TRIDENT'),
  ...Array(10).fill('FLEUR'), ...Array(7).fill('CASTLE'), ...Array(3).fill('CROWN'), ...Array(1).fill('DIAMOND'),
  ...Array(5).fill('WILD'), ...Array(2).fill('SCATTER'),
];

// Dynasty Decree — royal decree multiplies the entire round
const BONUS = {
  name: '⚜️ DYNASTY DECREE',
  description: 'After wins, a royal decree is issued — multiplying the win by 2×–7×.',
  triggerChance: 0.28,
  onTrigger: (bet) => {
    const mult = Math.floor(Math.random() * 6) + 2;
    return bet * mult;
  },
};

export default function DiamondDynastySlot({ wallet, onBet, currency = 'IC' }) {
  return <StandaloneSlotGame gameSlug="diamond-dynasty" slotType="diamond-dynasty" title="Diamond Dynasty" titleEmoji="💎" theme={standaloneThemes.crystal} symbols={SYMBOLS} wallet={wallet} onBet={onBet} currency={currency} />;
}