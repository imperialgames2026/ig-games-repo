import React from 'react';
import StandaloneSlotGame from './StandaloneSlotGame';
import { standaloneThemes } from './slotStandaloneThemes';

const SYMBOLS = {
  CLOVER:  { id: 'CLOVER',  emoji: '🍀', label: 'Clover',  special: false },
  COIN:    { id: 'COIN',    emoji: '💰', label: 'Coin',    special: false },
  DICE:    { id: 'DICE',    emoji: '🎲', label: 'Dice',    special: false },
  CARD:    { id: 'CARD',    emoji: '🃏', label: 'Card',    special: false },
  TARGET:  { id: 'TARGET',  emoji: '🎯', label: 'Target',  special: false },
  CASH:    { id: 'CASH',    emoji: '💸', label: 'Cash',    special: false },
  WILD:    { id: 'WILD',    emoji: '🎰', label: 'WILD',    special: true  },
  SCATTER: { id: 'SCATTER', emoji: '🌈', label: 'SCATTER', special: true  },
};

const PAY = {
  'CLOVER':  [200, 750, 2500, 5000],
  'COIN':    [100, 380, 1200, 2500],
  'DICE':    [25,  75,  250,  500 ],
  'CARD':    [12,  38,  120,  250 ],
  'TARGET':  [6,   19,  60,   125 ],
  'CASH':    [4,   13,  40,   80  ],
};

const POOL = [
  ...Array(26).fill('CASH'), ...Array(20).fill('TARGET'), ...Array(16).fill('CARD'),
  ...Array(12).fill('DICE'), ...Array(8).fill('COIN'), ...Array(3).fill('CLOVER'),
  ...Array(5).fill('WILD'), ...Array(2).fill('SCATTER'),
];

const BONUS = {
  name: '🍀 LUCKY MULTIPLIER',
  description: 'After a win, randomly applies a 2×–5× multiplier to the payout.',
  triggerChance: 0.30,
  onTrigger: (bet, grid) => {
    const mult = [2, 3, 4, 5][Math.floor(Math.random() * 4)];
    return bet * mult * (Math.floor(Math.random() * 5) + 1);
  },
};

export default function LuckyFortuneSlot({ wallet, onBet, currency = 'IC' }) {
  return <StandaloneSlotGame gameSlug="lucky-fortune" slotType="lucky-fortune" title="Lucky Fortune" titleEmoji="🍀" theme={standaloneThemes.fortune} symbols={SYMBOLS} wallet={wallet} onBet={onBet} currency={currency} />;
}