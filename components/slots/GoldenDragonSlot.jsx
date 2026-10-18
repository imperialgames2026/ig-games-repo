import React from 'react';
import StandaloneSlotGame from './StandaloneSlotGame';
import { standaloneThemes } from './slotStandaloneThemes';

const SYMBOLS = {
  EMPEROR: { id: 'EMPEROR', image: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/b56395ee0_generated_image.png', label: 'Dragon Emperor', special: false },
  DRAGON:  { id: 'DRAGON',  image: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/b56395ee0_generated_image.png', label: 'Golden Dragon', special: false },
  PEARL:   { id: 'PEARL',   image: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/b56395ee0_generated_image.png', label: 'Dragon Pearl', special: false },
  CLAW:    { id: 'CLAW',    image: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/b56395ee0_generated_image.png', label: 'Dragon Claw', special: false },
  COIN:    { id: 'COIN',    image: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/b56395ee0_generated_image.png', label: 'Gold Coin', special: false },
  SCALE:   { id: 'SCALE',   image: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/b56395ee0_generated_image.png', label: 'Gold Scale', special: false },
  INGOT:   { id: 'INGOT',   image: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/b56395ee0_generated_image.png', label: 'Gold Ingot', special: false },
  WILD:    { id: 'WILD',    image: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/b56395ee0_generated_image.png', label: 'WILD', special: true  },
  SCATTER: { id: 'SCATTER', image: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/b56395ee0_generated_image.png', label: 'SCATTER', special: true  },
};

const PAY = {
  'EMPEROR': [300, 1100, 3500, 7000],
  'DRAGON':  [130, 480,  1600, 3200],
  'PEARL':   [55,  200,  650,  1300],
  'CLAW':    [24,  88,   290,  580 ],
  'COIN':    [11,  40,   135,  270 ],
  'SCALE':   [5,   19,   62,   125 ],
  'INGOT':   [2.5, 9,    30,   60  ],
};

const POOL = [
  ...Array(28).fill('INGOT'), ...Array(22).fill('SCALE'), ...Array(16).fill('COIN'),
  ...Array(10).fill('CLAW'), ...Array(7).fill('PEARL'), ...Array(3).fill('DRAGON'), ...Array(1).fill('EMPEROR'),
  ...Array(5).fill('WILD'), ...Array(2).fill('SCATTER'),
];

const BONUS = {
  name: '🐉 DRAGON BREATH',
  description: 'The dragon breathes fire after wins — scorching the reels with a 3×–9× flame bonus.',
  triggerChance: 0.27,
  onTrigger: (bet) => {
    const mult = Math.floor(Math.random() * 7) + 3;
    return bet * mult;
  },
};

export default function GoldenDragonSlot({ wallet, onBet, currency = 'IC' }) {
  return <StandaloneSlotGame gameSlug="golden-dragon" slotType="golden-dragon" title="Golden Dragon" titleEmoji="🐉" theme={standaloneThemes.dragon} symbols={SYMBOLS} wallet={wallet} onBet={onBet} currency={currency} />;
}