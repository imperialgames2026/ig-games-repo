import React from 'react';
import StandaloneSlotGame from './StandaloneSlotGame';
import { standaloneThemes } from './slotStandaloneThemes';

const SYMBOLS = {
  QUEEN:   { id: 'QUEEN',   image: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/308226272_generated_image.png', label: 'Mermaid Queen', special: false },
  KING:    { id: 'KING',    image: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/b451091e2_generated_image.png', label: 'Sea King', special: false },
  CHEST:   { id: 'CHEST',   image: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/2fdfd3b52_generated_image.png', label: 'Treasure Chest', special: false },
  TRIDENT: { id: 'TRIDENT', image: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/41fed8ad2_generated_image.png', label: 'Golden Trident', special: false },
  SHELL:   { id: 'SHELL',   image: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/7a9584bb3_generated_image.png', label: 'Seashell', special: false },
  STARFISH:{ id: 'STARFISH',image: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/9e9b025b9_generated_image.png', label: 'Starfish', special: false },
  PEARL:   { id: 'PEARL',   image: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/f7e581000_generated_image.png', label: 'Pearl', special: false },
  WILD:    { id: 'WILD',    image: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/2828aa419_generated_image.png', label: 'WILD', special: true  },
  SCATTER: { id: 'SCATTER', image: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/d169157d3_generated_image.png', label: 'SCATTER', special: true  },
};

const PAY = {
  'QUEEN':    [180, 650, 2800, 4500],
  'KING':     [100, 400, 1400, 2800],
  'CHEST':    [40,  150, 500,  1000],
  'TRIDENT':  [20,  70,  250,  500 ],
  'SHELL':    [10,  35,  120,  250 ],
  'STARFISH': [6,   18,  60,   120 ],
  'PEARL':    [4,   12,  40,   80  ],
};

const POOL = [
  ...Array(28).fill('PEARL'), ...Array(22).fill('STARFISH'), ...Array(16).fill('SHELL'),
  ...Array(10).fill('TRIDENT'), ...Array(7).fill('CHEST'), ...Array(3).fill('KING'), ...Array(1).fill('QUEEN'),
  ...Array(5).fill('WILD'), ...Array(2).fill('SCATTER'),
];

// Treasure Chest bonus — reveals hidden multiplier
const BONUS = {
  name: '🗺️ TREASURE CHEST',
  description: 'After wins, a hidden chest opens adding a bonus reward of 3×–10× bet.',
  triggerChance: 0.28,
  onTrigger: (bet) => {
    const mult = Math.floor(Math.random() * 8) + 3;
    return bet * mult;
  },
};

export default function OceanTreasureSlot({ wallet, onBet, currency = 'IC' }) {
  return <StandaloneSlotGame gameSlug="ocean-treasure" slotType="ocean-treasure" title="Ocean Treasure" titleEmoji="🌊" theme={standaloneThemes.ocean} symbols={SYMBOLS} wallet={wallet} onBet={onBet} currency={currency} />;
}