import React from 'react';
import SlotEngine from './SlotEngine';

const SYMBOLS = {
  CROWN:   { id: 'CROWN',   emoji: '👑', label: 'Crown',   special: false },
  DIAMOND: { id: 'DIAMOND', emoji: '💎', label: 'Diamond', special: false },
  CHEST:   { id: 'CHEST',   emoji: '💰', label: 'Chest',   special: false },
  TROPHY:  { id: 'TROPHY',  emoji: '🏆', label: 'Trophy',  special: false },
  STAR:    { id: 'STAR',    emoji: '⭐', label: 'Star',    special: false },
  SLOTS:   { id: 'SLOTS',   emoji: '🎰', label: 'Slots',   special: false },
  BELL:    { id: 'BELL',    emoji: '🔔', label: 'Bell',    special: false },
  WILD:    { id: 'WILD',    emoji: '🦁', label: 'WILD',    special: true  },
  SCATTER: { id: 'SCATTER', emoji: '🎖️', label: 'SCATTER', special: true  },
};

const PAY = {
  'CROWN':   [100, 400, 1200, 2500],
  'DIAMOND': [50,  200, 600,  1250],
  'CHEST':   [25,  100, 300,  600 ],
  'TROPHY':  [12,  50,  150,  300 ],
  'STAR':    [6,   25,  75,   150 ],
  'SLOTS':   [4,   15,  45,   90  ],
  'BELL':    [2,   8,   25,   50  ],
};

const POOL = [
  ...Array(28).fill('BELL'), ...Array(22).fill('SLOTS'), ...Array(16).fill('STAR'),
  ...Array(10).fill('TROPHY'), ...Array(7).fill('CHEST'), ...Array(3).fill('DIAMOND'), ...Array(1).fill('CROWN'),
  ...Array(5).fill('WILD'), ...Array(2).fill('SCATTER'),
];

// Imperial Jackpot — lion roars and awards a progressive bonus
const BONUS = {
  name: '🦁 IMPERIAL ROAR',
  description: 'The Imperial Lion roars after wins — awarding an imperial bonus of 2×–10× the bet.',
  triggerChance: 0.28,
  onTrigger: (bet) => {
    const mult = Math.floor(Math.random() * 9) + 2;
    return bet * mult;
  },
};

export default function ImperialGoldSlot({ wallet, onBet, currency = 'IC' }) {
  return (
    <SlotEngine
      title="IMPERIAL GOLD"
      titleEmoji="👑"
      accentColor="#eab308"
      bgGradient="linear-gradient(160deg, #1a1000, #2a1d00, #1a1000)"
      borderColor="border-yellow-600"
      config={{ symbols: SYMBOLS, pay: PAY, pool: POOL, wildId: 'WILD', scatterId: 'SCATTER', gameSlug: 'imperial-gold-slot', specialIds: ['WILD', 'SCATTER'] }}
      wallet={wallet} onBet={onBet} currency={currency}
      bonusFeature={BONUS}
      winLabel="👑 IMPERIAL WIN!"
    />
  );
}