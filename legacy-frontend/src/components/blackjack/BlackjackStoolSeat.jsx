import React from 'react';
import { motion } from 'framer-motion';

export default function BlackjackStoolSeat({ seat, occupied, selected, label, onClick }) {
  return (
    <motion.button
      whileHover={{ scale: occupied ? 1 : 1.06 }}
      whileTap={{ scale: occupied ? 1 : 0.98 }}
      onClick={onClick}
      className="relative flex flex-col items-center gap-2"
      disabled={occupied && !selected}
    >
      <div
        className="w-16 h-16 md:w-20 md:h-20 rounded-full"
        style={{
          background: selected
            ? 'radial-gradient(circle at 30% 30%, #f472b6 0%, #db2777 55%, #831843 100%)'
            : occupied
            ? 'radial-gradient(circle at 30% 30%, #374151 0%, #1f2937 55%, #111827 100%)'
            : 'radial-gradient(circle at 30% 30%, #3f2a4f 0%, #1e1229 55%, #0f0a17 100%)',
          border: `2px solid ${selected ? 'rgba(236,72,153,0.95)' : occupied ? 'rgba(255,255,255,0.12)' : 'rgba(236,72,153,0.32)'}`,
          boxShadow: selected ? '0 0 24px rgba(236,72,153,0.45)' : '0 8px 20px rgba(0,0,0,0.32)',
        }}
      />
      <div className="absolute top-6 md:top-7 text-[10px] md:text-xs font-black text-white/85">{seat}</div>
      <div className="min-h-[16px] text-[10px] md:text-xs font-semibold text-pink-200 max-w-[88px] truncate text-center">
        {label || ''}
      </div>
    </motion.button>
  );
}