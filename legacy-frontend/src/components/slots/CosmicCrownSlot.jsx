import React from 'react';
import StandaloneSlotGame from './StandaloneSlotGame';
import { standaloneThemes } from './slotStandaloneThemes';

const SYMBOLS = {
  KING:    { id: 'KING',    image: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/fd91fe591_generated_image.png', label: 'Cosmic King', special: false },
  GODDESS: { id: 'GODDESS', image: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/e6707587f_generated_image.png', label: 'Space Goddess', special: false },
  ORB:     { id: 'ORB',     image: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/9cb322635_generated_image.png', label: 'Galaxy Orb', special: false },
  CROWN:   { id: 'CROWN',   image: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/0af8277ec_generated_image.png', label: 'Cosmic Crown', special: false },
  PLANET:  { id: 'PLANET',  image: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/73ba6e94f_generated_image.png', label: 'Planet', special: false },
  SHOOTING:{ id: 'SHOOTING',image: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/8834ec2d2_generated_image.png', label: 'Shooting Star', special: false },
  NEBULA:  { id: 'NEBULA',  image: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/24a790c5a_generated_image.png', label: 'Nebula Crystal', special: false },
  WILD:    { id: 'WILD',    image: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/ef2d1575a_generated_image.png', label: 'WILD', special: true  },
  SCATTER: { id: 'SCATTER', image: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/c8fd3bfa3_generated_image.png', label: 'SCATTER', special: true  },
};

const PAY = {
  'KING':     [170, 620, 2100, 4200],
  'GODDESS':  [85,  310, 1050, 2100],
  'ORB':      [42,  155, 525,  1050],
  'CROWN':    [21,  77,  262,  525 ],
  'PLANET':   [11,  39,  131,  262 ],
  'SHOOTING': [5,   19,  65,   131 ],
  'NEBULA':   [2.5, 9,   33,   65  ],
};

const POOL = [
  ...Array(28).fill('NEBULA'), ...Array(22).fill('SHOOTING'), ...Array(16).fill('PLANET'),
  ...Array(10).fill('CROWN'), ...Array(7).fill('ORB'), ...Array(3).fill('GODDESS'), ...Array(1).fill('KING'),
  ...Array(5).fill('WILD'), ...Array(2).fill('SCATTER'),
];

// Cosmic Orbit bonus — planets align for extra multiplier
const BONUS = {
  name: '🪐 COSMIC ORBIT',
  description: 'Planets align after wins, granting an orbital multiplier of 2×–9×.',
  triggerChance: 0.28,
  onTrigger: (bet) => {
    const mult = Math.floor(Math.random() * 8) + 2;
    return bet * mult;
  },
};

export default function CosmicCrownSlot({ wallet, onBet, currency = 'IC' }) {
  return <StandaloneSlotGame gameSlug="cosmic-crown" slotType="cosmic-crown" title="Cosmic Crown" titleEmoji="🌌" theme={standaloneThemes.cosmic} symbols={SYMBOLS} wallet={wallet} onBet={onBet} currency={currency} />;
}