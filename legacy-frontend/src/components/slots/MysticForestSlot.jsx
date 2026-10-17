import React from 'react';
import StandaloneSlotGame from './StandaloneSlotGame';
import { standaloneThemes } from './slotStandaloneThemes';

const SYMBOLS = {
  UNICORN: { id: 'UNICORN', emoji: '🦄', label: 'Unicorn',  special: false },
  OWL:     { id: 'OWL',     emoji: '🦉', label: 'Owl',      special: false },
  DEER:    { id: 'DEER',    emoji: '🦌', label: 'Deer',     special: false },
  FERN:    { id: 'FERN',    emoji: '🌿', label: 'Fern',     special: false },
  ACORN:   { id: 'ACORN',   emoji: '🌰', label: 'Acorn',    special: false },
  FLOWER:  { id: 'FLOWER',  emoji: '🌸', label: 'Flower',   special: false },
  LEAF:    { id: 'LEAF',    emoji: '🍃', label: 'Leaf',     special: false },
  WILD:    { id: 'WILD',    emoji: '🌲', label: 'WILD',     special: true  },
  SCATTER: { id: 'SCATTER', emoji: '🍄', label: 'SCATTER',  special: true  },
};

const PAY = {
  'UNICORN': [220, 800, 2800, 5500],
  'OWL':     [110, 400, 1400, 2800],
  'DEER':    [50,  180, 620,  1250],
  'FERN':    [22,  80,  280,  560 ],
  'ACORN':   [10,  38,  130,  260 ],
  'FLOWER':  [5,   18,  62,   125 ],
  'LEAF':    [3,   10,  35,   70  ],
};

const POOL = [
  ...Array(28).fill('LEAF'), ...Array(22).fill('FLOWER'), ...Array(16).fill('ACORN'),
  ...Array(10).fill('FERN'), ...Array(7).fill('DEER'), ...Array(3).fill('OWL'), ...Array(2).fill('UNICORN'),
  ...Array(5).fill('WILD'), ...Array(2).fill('SCATTER'),
];

const BONUS = {
  name: '🌲 FOREST MAGIC',
  description: 'The forest awakens after wins — a magical aura multiplies the payout by 2×–7×.',
  triggerChance: 0.28,
  onTrigger: (bet) => {
    const mult = Math.floor(Math.random() * 6) + 2;
    return bet * mult;
  },
};

export default function MysticForestSlot({ wallet, onBet, currency = 'IC' }) {
  return <StandaloneSlotGame gameSlug="mystic-forest" slotType="mystic-forest" title="Mystic Forest" titleEmoji="🦄" theme={standaloneThemes.forest} symbols={SYMBOLS} wallet={wallet} onBet={onBet} currency={currency} />;
}