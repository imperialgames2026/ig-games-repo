import React from 'react';
import { motion } from 'framer-motion';

const chipColors = {
  IC: ['#ec4899', '#be185d'],
  ID: ['#f59e0b', '#b45309'],
};

export default function ChipStack({ amount, currency = 'IC', animated = false }) {
  const [top, bottom] = chipColors[currency] || chipColors.IC;
  const count = Math.max(1, Math.min(6, Math.ceil((amount || 0) / 25)));

  return (
    <motion.div
      animate={animated ? { y: [0, -4, 0], scale: [1, 1.03, 1] } : { y: 0, scale: 1 }}
      transition={{ duration: 0.9, repeat: animated ? Infinity : 0 }}
      className="relative h-10 w-12"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="absolute left-1/2 -translate-x-1/2 rounded-full"
          style={{
            bottom: i * 4,
            width: 34,
            height: 10,
            background: `linear-gradient(180deg, ${top}, ${bottom})`,
            border: '1px solid rgba(255,255,255,0.35)',
            boxShadow: i === count - 1 ? '0 0 12px rgba(236,72,153,0.25)' : 'none'
          }}
        />
      ))}
    </motion.div>
  );
}