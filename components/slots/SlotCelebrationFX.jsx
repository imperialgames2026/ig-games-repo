import React from 'react';
import { motion } from 'framer-motion';

const FX_ASSETS = {
  coinBurst: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/de1863cc9_generated_image.png',
  coinShower: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/ddc82c505_generated_image.png',
  bigWin: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/b1f84a214_generated_image.png',
  megaWin: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/a781ab343_generated_image.png',
  jackpot: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/21a599beb_generated_image.png',
  symbolGlow: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/af5d4cfc0_generated_image.png',
  winLine: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/6ab687e57_generated_image.png',
  scatter: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/424acdd13_generated_image.png',
  wild: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/928eae2e5_generated_image.png',
  freeSpins: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/c4282178b_generated_image.png',
};

const FX_CONFIG = {
  coinShower: { image: FX_ASSETS.coinShower, glow: 'bg-amber-300/15', size: 'w-[72vw] max-w-[420px]', duration: 2.2 },
  coinBurst: { image: FX_ASSETS.coinBurst, glow: 'bg-amber-300/20', size: 'w-[70vw] max-w-[440px]', duration: 2.35 },
  bigWin: { image: FX_ASSETS.bigWin, glow: 'bg-yellow-300/25', size: 'w-[78vw] max-w-[520px]', duration: 2.65 },
  megaWin: { image: FX_ASSETS.megaWin, glow: 'bg-pink-400/25', size: 'w-[80vw] max-w-[560px]', duration: 2.85 },
  jackpot: { image: FX_ASSETS.jackpot, glow: 'bg-lime-300/25', size: 'w-[82vw] max-w-[600px]', duration: 3.1 },
  scatter: { image: FX_ASSETS.scatter, glow: 'bg-lime-300/25', size: 'w-[74vw] max-w-[460px]', duration: 2.7 },
  wild: { image: FX_ASSETS.wild, glow: 'bg-purple-400/25', size: 'w-[68vw] max-w-[420px]', duration: 2.35 },
  freeSpins: { image: FX_ASSETS.freeSpins, glow: 'bg-lime-300/25', size: 'w-[78vw] max-w-[520px]', duration: 2.9 },
};

export default function SlotCelebrationFX({ variant = 'coinBurst', label }) {
  const config = FX_CONFIG[variant] || FX_CONFIG.coinBurst;
  const isBonus = variant === 'scatter' || variant === 'freeSpins';

  return (
    <div className="pointer-events-none fixed inset-0 z-[100] overflow-visible">
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 1.75] }}
        transition={{ duration: config.duration, ease: 'easeOut' }}
        className={`absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full ${config.glow} blur-3xl`}
      />

      {isBonus && (
        <motion.img
          src={FX_ASSETS.winLine}
          alt=""
          initial={{ opacity: 0, scaleX: 0.2 }}
          animate={{ opacity: [0, 0.85, 0], scaleX: [0.2, 1.15, 1.35] }}
          transition={{ duration: 0.75, ease: 'easeOut' }}
          className="absolute left-1/2 top-1/2 w-[70vw] max-w-[520px] -translate-x-1/2 -translate-y-1/2 object-contain mix-blend-screen"
        />
      )}

      {isBonus && (
        <motion.img
          src={config.image}
          alt=""
          initial={{ opacity: 0, y: 30, scale: 0.74 }}
          animate={{ opacity: [0, 1, 1, 1, 0], y: [30, 0, 0, -6, -24], scale: [0.74, 1.05, 1.03, 1, 0.96] }}
          transition={{ duration: config.duration + 0.35, ease: 'easeOut' }}
          className={`absolute left-1/2 top-1/2 ${config.size} -translate-x-1/2 -translate-y-1/2 object-contain drop-shadow-[0_0_28px_rgba(251,191,36,0.85)]`}
        />
      )}

      {label && !isBonus && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.78 }}
          animate={{ opacity: [0, 1, 1, 1, 0], y: [24, 0, 0, -6, -20], scale: [0.78, 1.1, 1.04, 1, 0.92] }}
          transition={{ duration: config.duration + 0.2, ease: 'easeOut' }}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-2xl border border-yellow-200 bg-gradient-to-r from-yellow-300 via-amber-300 to-pink-400 px-8 py-4 text-3xl font-black uppercase tracking-[0.16em] text-[#2b1300] shadow-2xl shadow-pink-500/30 md:text-5xl"
        >
          {label}
        </motion.div>
      )}

      {label && isBonus && (
        <motion.div
          initial={{ opacity: 0, y: 34, scale: 0.78 }}
          animate={{ opacity: [0, 1, 1, 1, 0], y: [34, 0, 0, -8, -24], scale: [0.78, 1.08, 1.04, 1, 0.92] }}
          transition={{ duration: config.duration + 0.2, ease: 'easeOut' }}
          className="absolute left-1/2 top-[66%] -translate-x-1/2 whitespace-nowrap rounded-full border border-lime-200 bg-lime-300 px-5 py-2 text-sm font-black uppercase tracking-[0.2em] text-[#173500] shadow-2xl"
        >
          {label}
        </motion.div>
      )}
    </div>
  );
}