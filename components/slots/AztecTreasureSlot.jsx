import React from 'react';
import StandaloneSlotGame from './StandaloneSlotGame';
import { standaloneThemes } from './slotStandaloneThemes';

const SYMBOLS = {
  IDOL:    { id: 'IDOL',    emoji: '🗿', label: 'Idol',    special: false },
  MASK:    { id: 'MASK',    emoji: '🎭', label: 'Mask',    special: false },
  SKULL:   { id: 'SKULL',   emoji: '💀', label: 'Skull',   special: false },
  ARROW:   { id: 'ARROW',   emoji: '🏹', label: 'Arrow',   special: false },
  DRUM:    { id: 'DRUM',    emoji: '🪘', label: 'Drum',    special: false },
  SNAKE:   { id: 'SNAKE',   emoji: '🐍', label: 'Snake',   special: false },
  FEATHER: { id: 'FEATHER', emoji: '🪶', label: 'Feather', special: false },
  WILD:    { id: 'WILD',    emoji: '🌞', label: 'WILD',    special: true  },
  SCATTER: { id: 'SCATTER', emoji: '🏺', label: 'SCATTER', special: true  },
};

const PAY = {
  'IDOL':    [260, 950,  3200, 6400],
  'MASK':    [120, 440,  1500, 3000],
  'SKULL':   [50,  185,  620,  1250],
  'ARROW':   [22,  80,   270,  540 ],
  'DRUM':    [10,  36,   122,  245 ],
  'SNAKE':   [5,   17,   56,   112 ],
  'FEATHER': [2.5, 8,    27,   54  ],
};

const POOL = [
  ...Array(28).fill('FEATHER'), ...Array(22).fill('SNAKE'), ...Array(16).fill('DRUM'),
  ...Array(10).fill('ARROW'), ...Array(7).fill('SKULL'), ...Array(3).fill('MASK'), ...Array(1).fill('IDOL'),
  ...Array(5).fill('WILD'), ...Array(2).fill('SCATTER'),
];

const BONUS = {
  name: '🌞 SUN GOD RITUAL',
  description: 'The Sun God blesses the reels after wins — granting a ritual multiplier of 2×–8×.',
  triggerChance: 0.27,
  onTrigger: (bet) => {
    const mult = Math.floor(Math.random() * 7) + 2;
    return bet * mult;
  },
};

export default function AztecTreasureSlot({ wallet, onBet, currency = 'IC' }) {
  return <StandaloneSlotGame gameSlug="aztec-treasure" slotType="aztec-treasure" title="Aztec Treasure" titleEmoji="🗿" theme={standaloneThemes.aztec} symbols={SYMBOLS} wallet={wallet} onBet={onBet} currency={currency} />;
}