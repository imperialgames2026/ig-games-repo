import React from 'react';
import StandaloneSlotGame from './StandaloneSlotGame';
import { standaloneThemes } from './slotStandaloneThemes';

const FARMAGEDDON_ART = 'https://media.base44.com/images/public/697dc67abbb768c5bbbab5d5/f6183d23a_d1b890d74_generated_image.png';

const SYMBOLS = {
  HIGH_1: { id: 'HIGH_1', image: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/db10eee20_generated_image.png', label: 'High Pay', special: false },
  HIGH_2: { id: 'HIGH_2', image: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/89381b869_generated_image.png', label: 'High Pay', special: false },
  MED_1: { id: 'MED_1', image: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/0baa336d5_generated_image.png', label: 'Medium Pay', special: false },
  MED_2: { id: 'MED_2', image: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/b559e5ba0_generated_image.png', label: 'Medium Pay', special: false },
  LOW_1: { id: 'LOW_1', image: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/490c3cc57_generated_image.png', label: 'Low Pay', special: false },
  LOW_2: { id: 'LOW_2', image: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/097862da8_generated_image.png', label: 'Low Pay', special: false },
  SCATTER: { id: 'SCATTER', image: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/1b6b95bee_generated_image.png', label: 'SCATTER', special: true },
  WILD: { id: 'WILD', image: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/861e7d2bf_generated_image.png', label: 'WILD', special: true },
};

export default function FarmageddonSlot({ wallet, onBet, currency = 'IC' }) {
  return (
    <StandaloneSlotGame
      gameSlug="farmageddon"
      slotType="farmageddon"
      title="Farmageddon"
      titleEmoji="🌪️"
      theme={standaloneThemes.farmageddon}
      symbols={SYMBOLS}
      wallet={wallet}
      onBet={onBet}
      currency={currency}
      artworkUrl={FARMAGEDDON_ART}
      cabinetVariant="farmageddon"
    />
  );
}