import React from 'react';
import { motion } from 'framer-motion';

const chipStyles = {
  0.1: ['#f8fafc', '#d1d5db', '#111827'],
  0.25: ['#f43f5e', '#be123c', '#ffffff'],
  1: ['#22c55e', '#15803d', '#ffffff'],
  5: ['#f59e0b', '#b45309', '#ffffff'],
  10: ['#3b82f6', '#1d4ed8', '#ffffff'],
  25: ['#8b5cf6', '#6d28d9', '#ffffff'],
  100: ['#111827', '#000000', '#fbbf24'],
};

function Chip({ value, active, onTap }) {
  const [top, bottom, text] = chipStyles[value] || chipStyles[1];
  return (
    <motion.button
      whileHover={{ y: -6, scale: 1.05 }}
      whileTap={{ scale: 0.96 }}
      onClick={() => onTap(value)}
      className="relative shrink-0"
    >
      <div
        className="w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center font-black text-xs md:text-sm"
        style={{
          background: `radial-gradient(circle at 30% 30%, ${top} 0%, ${bottom} 68%, #111827 100%)`,
          color: text,
          border: `3px solid ${active ? '#f472b6' : 'rgba(255,255,255,0.82)'}`,
          boxShadow: active ? '0 0 22px rgba(236,72,153,0.42)' : '0 10px 24px rgba(0,0,0,0.34)'
        }}
      >
        {value < 1 ? value.toFixed(2) : value}
      </div>
    </motion.button>
  );
}

export default function ChipRail({ chips, activeChip, onTapChip }) {
  return (
    <div
      className="rounded-full px-3 py-3 md:px-4 md:py-4"
      style={{
        background: 'rgba(14,9,24,0.9)',
        border: '1px solid rgba(236,72,153,0.24)',
        boxShadow: '0 0 24px rgba(236,72,153,0.14)',
        backdropFilter: 'blur(18px)'
      }}
    >
      <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
        {chips.map((chip) => (
          <Chip key={chip} value={chip} active={activeChip === chip} onTap={onTapChip} />
        ))}
      </div>
    </div>
  );
}