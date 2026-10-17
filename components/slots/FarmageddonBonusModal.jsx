import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Sparkles, X } from 'lucide-react';
import SlotCelebrationFX from './SlotCelebrationFX';
import FarmageddonBonusMiniSlot from './FarmageddonBonusMiniSlot';

export default function FarmageddonBonusModal({ bonus, currency, onClose }) {
  if (!bonus?.triggered) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.85, y: 24, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="relative w-full max-w-2xl overflow-hidden rounded-[2rem] border border-lime-300/40 bg-gradient-to-br from-[#24120A] via-[#351807] to-[#0A0612] p-5 text-white shadow-[0_0_60px_rgba(132,255,30,0.25)]"
        >
          <SlotCelebrationFX variant="freeSpins" label="Bonus Win" />
          <button onClick={onClose} className="absolute right-4 top-4 z-50 rounded-full bg-white/10 p-2 text-white/70 hover:bg-white/20 hover:text-white">
            <X className="h-4 w-4" />
          </button>

          <div className="mb-5 text-center">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-lime-300 text-[#173500] shadow-[0_0_30px_rgba(190,242,100,0.65)]">
              <Sparkles className="h-8 w-8" />
            </div>
            <h2 className="text-3xl font-black uppercase tracking-[0.18em] text-lime-200">Free Spins Unlocked</h2>
            <p className="mt-2 text-sm font-bold uppercase tracking-[0.18em] text-white/60">
              {bonus.scatterCount} scatters triggered {bonus.freeSpins} bonus spins with multipliers
            </p>
          </div>

          <FarmageddonBonusMiniSlot
            spins={bonus.spins || []}
            currency={currency}
            onComplete={onClose}
          />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}