import React from 'react';
import StandaloneSlotGame from './StandaloneSlotGame';
import { standaloneThemes } from './slotStandaloneThemes';

const SYMBOLS = {
  GODDESS: { id: 'GODDESS', image: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/e4d165fb9_generated_image.png', label: 'Fire Goddess', special: false },
  BIRD:    { id: 'BIRD',    image: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/8bc82630c_generated_image.png', label: 'Phoenix Bird', special: false },
  TALON:   { id: 'TALON',   image: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/22160780b_generated_image.png', label: 'Phoenix Talon', special: false },
  EGG:     { id: 'EGG',     image: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/3f56f1bdf_generated_image.png', label: 'Phoenix Egg', special: false },
  FEATHER: { id: 'FEATHER', image: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/7c1aa2e34_generated_image.png', label: 'Fire Feather', special: false },
  ORB:     { id: 'ORB',     image: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/16efce1db_generated_image.png', label: 'Fire Orb', special: false },
  EMBER:   { id: 'EMBER',   image: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/259c07a2c_generated_image.png', label: 'Ember', special: false },
  WILD:    { id: 'WILD',    image: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/0a3309fdd_generated_image.png', label: 'WILD', special: true  },
  SCATTER: { id: 'SCATTER', image: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/2166571f3_generated_image.png', label: 'SCATTER', special: true  },
};

const PAY = {
  'GODDESS': [250, 900, 3000, 6000],
  'BIRD':    [120, 450, 1500, 3000],
  'TALON':   [50,  180, 600,  1200],
  'EGG':     [25,  90,  300,  600 ],
  'FEATHER': [12,  45,  150,  300 ],
  'ORB':     [6,   22,  75,   150 ],
  'EMBER':   [4,   14,  45,   90  ],
};

const POOL = [
  ...Array(28).fill('EMBER'), ...Array(22).fill('ORB'), ...Array(16).fill('FEATHER'),
  ...Array(10).fill('EGG'), ...Array(7).fill('TALON'), ...Array(4).fill('BIRD'), ...Array(2).fill('GODDESS'),
  ...Array(5).fill('WILD'), ...Array(2).fill('SCATTER'),
];

// Phoenix Rebirth — transforms 1 losing reel into a winning symbol
const BONUS = {
  name: '🔥 PHOENIX REBIRTH',
  description: 'After wins, the Phoenix may transform additional reels — adding a 2×–8× burst bonus.',
  triggerChance: 0.27,
  onTrigger: (bet) => {
    const mult = Math.floor(Math.random() * 7) + 2;
    return bet * mult;
  },
};

export default function PhoenixFireSlot({ wallet, onBet, currency = 'IC' }) {
  return <StandaloneSlotGame gameSlug="phoenix-fire" slotType="phoenix-fire" title="Phoenix Fire" titleEmoji="🔥" theme={standaloneThemes.phoenix} symbols={SYMBOLS} wallet={wallet} onBet={onBet} currency={currency} />;
}