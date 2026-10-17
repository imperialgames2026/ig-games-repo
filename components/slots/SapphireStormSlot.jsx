import React from 'react';
import StandaloneSlotGame from './StandaloneSlotGame';
import { standaloneThemes } from './slotStandaloneThemes';

const SYMBOLS = {
  SAPPHIRE: { id: 'SAPPHIRE', emoji: '💙', label: 'Sapphire', special: false },
  BOLT:     { id: 'BOLT',     emoji: '⚡', label: 'Bolt',     special: false },
  WAVE:     { id: 'WAVE',     emoji: '🌊', label: 'Wave',     special: false },
  DIAMOND:  { id: 'DIAMOND',  emoji: '💠', label: 'Gem',      special: false },
  RHOMBUS:  { id: 'RHOMBUS',  emoji: '🔷', label: 'Prism',    special: false },
  STAR:     { id: 'STAR',     emoji: '⭐', label: 'Star',     special: false },
  SNOWFLAKE:{ id: 'SNOWFLAKE',emoji: '❄️', label: 'Ice',      special: false },
  WILD:     { id: 'WILD',     emoji: '🌀', label: 'WILD',     special: true  },
  SCATTER:  { id: 'SCATTER',  emoji: '🌩️', label: 'SCATTER',  special: true  },
};

const PAY = {
  'SAPPHIRE': [190, 700, 2400, 4800],
  'BOLT':     [95,  350, 1200, 2400],
  'WAVE':     [40,  150, 500,  1000],
  'DIAMOND':  [20,  70,  250,  500 ],
  'RHOMBUS':  [10,  35,  125,  250 ],
  'STAR':     [5,   18,  60,   120 ],
  'SNOWFLAKE':[3,   12,  40,   80  ],
};

const POOL = [
  ...Array(28).fill('SNOWFLAKE'), ...Array(22).fill('STAR'), ...Array(16).fill('RHOMBUS'),
  ...Array(10).fill('DIAMOND'), ...Array(7).fill('WAVE'), ...Array(4).fill('BOLT'), ...Array(2).fill('SAPPHIRE'),
  ...Array(5).fill('WILD'), ...Array(2).fill('SCATTER'),
];

// Storm Surge bonus — ice storm freezes a multiplier onto matching symbols
const BONUS = {
  name: '❄️ ICE STORM SURGE',
  description: 'After wins, an ice storm freezes and multiplies the top paying symbol by 2×–6×.',
  triggerChance: 0.28,
  onTrigger: (bet) => {
    const mult = Math.floor(Math.random() * 5) + 2;
    return bet * mult * (Math.floor(Math.random() * 3) + 1);
  },
};

export default function SapphireStormSlot({ wallet, onBet, currency = 'IC' }) {
  return <StandaloneSlotGame gameSlug="sapphire-storm" slotType="sapphire-storm" title="Sapphire Storm" titleEmoji="💙" theme={standaloneThemes.storm} symbols={SYMBOLS} wallet={wallet} onBet={onBet} currency={currency} />;
}