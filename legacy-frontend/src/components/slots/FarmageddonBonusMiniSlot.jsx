import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { RotateCcw, Trophy } from 'lucide-react';

const SYMBOLS = {
  HIGH_1: { image: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/db10eee20_generated_image.png', label: 'High Pay' },
  HIGH_2: { image: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/89381b869_generated_image.png', label: 'High Pay' },
  MED_1: { image: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/0baa336d5_generated_image.png', label: 'Medium Pay' },
  MED_2: { image: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/b559e5ba0_generated_image.png', label: 'Medium Pay' },
  LOW_1: { image: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/490c3cc57_generated_image.png', label: 'Low Pay' },
  LOW_2: { image: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/097862da8_generated_image.png', label: 'Low Pay' },
  SCATTER: { image: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/1b6b95bee_generated_image.png', label: 'Scatter' },
  WILD: { image: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/861e7d2bf_generated_image.png', label: 'Wild' },
  MULT_2: { text: '2x', label: '2x Multiplier' },
  MULT_3: { text: '3x', label: '3x Multiplier' },
  MULT_4: { text: '4x', label: '4x Multiplier' },
};

export default function FarmageddonBonusMiniSlot({ spins = [], currency, onComplete }) {
  const [revealedCount, setRevealedCount] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const currentSpin = spins[Math.max(0, revealedCount - 1)] || spins[0];
  const isComplete = revealedCount >= spins.length;

  const collected = useMemo(
    () => spins.slice(0, revealedCount).reduce((sum, spin) => sum + (spin.win || 0), 0),
    [spins, revealedCount]
  );

  const handleSpin = () => {
    if (spinning || isComplete) return;
    setSpinning(true);
    setTimeout(() => {
      setRevealedCount((count) => Math.min(count + 1, spins.length));
      setSpinning(false);
    }, 650);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-[1.5rem] border border-lime-300/30 bg-black/40 p-3 shadow-inner shadow-black">
        <div className="mb-3 flex items-center justify-between text-xs font-black uppercase tracking-[0.2em] text-white/60">
          <span>Old School Bonus Slot</span>
          <span>{Math.min(revealedCount + (spinning ? 1 : 0), spins.length)} / {spins.length}</span>
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-[#170b06] p-2">
          {Array(3).fill(null).map((_, row) =>
            Array(3).fill(null).map((_, col) => {
              const symbolId = currentSpin?.grid?.[col]?.[row] || 'LOW_1';
              const symbol = SYMBOLS[symbolId] || SYMBOLS.LOW_1;
              return (
                <motion.div
                  key={`${revealedCount}-${col}-${row}`}
                  animate={{ y: spinning ? [0, -8, 8, 0] : 0, opacity: spinning ? [1, 0.55, 1] : 1 }}
                  transition={{ duration: 0.22, repeat: spinning ? Infinity : 0, delay: col * 0.04 }}
                  className="flex aspect-square items-center justify-center rounded-xl border border-yellow-900/50 bg-gradient-to-br from-[#421f0d] to-[#120703]"
                >
                  {symbol.text ? (
                    <span className="rounded-lg bg-gradient-to-br from-pink-500 to-lime-300 px-2 py-1 text-2xl font-black text-white shadow-[0_0_18px_rgba(236,72,153,0.8)] md:text-3xl">
                      {symbol.text}
                    </span>
                  ) : (
                    <img src={symbol.image} alt={symbol.label} className="h-12 w-12 object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.9)] md:h-16 md:w-16" />
                  )}
                </motion.div>
              );
            })
          )}
        </div>
      </div>

      {revealedCount > 0 && (
        <div className="rounded-2xl border border-pink-400/30 bg-pink-500/10 p-4 text-center">
          <div className="text-xs font-black uppercase tracking-[0.22em] text-pink-100/70">Last Bonus Spin</div>
          <div className="mt-1 text-2xl font-black text-pink-200">
            +{(spins[revealedCount - 1]?.win || 0).toFixed(2)} {currency}
          </div>
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-white/50">
            {spins[revealedCount - 1]?.multiplier || 1}x winning-line multiplier
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-lime-300/30 bg-lime-300/10 p-3 text-center">
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-lime-100/60">Revealed Bonus Total</div>
        <div className="text-xl font-black text-lime-200">{collected.toFixed(2)} {currency}</div>
      </div>

      {isComplete ? (
        <Button onClick={onComplete} className="h-12 w-full rounded-2xl bg-gradient-to-r from-pink-500 to-lime-400 font-black uppercase tracking-[0.16em] text-white hover:from-pink-600 hover:to-lime-500">
          <Trophy className="mr-2 h-4 w-4" /> Collect Bonus
        </Button>
      ) : (
        <Button onClick={handleSpin} disabled={spinning} className="h-12 w-full rounded-2xl bg-gradient-to-r from-lime-400 to-green-600 font-black uppercase tracking-[0.16em] text-[#173500] hover:from-lime-300 hover:to-green-500">
          <RotateCcw className={`mr-2 h-4 w-4 ${spinning ? 'animate-spin' : ''}`} /> {spinning ? 'Spinning Bonus...' : 'Spin Bonus Slot'}
        </Button>
      )}
    </div>
  );
}