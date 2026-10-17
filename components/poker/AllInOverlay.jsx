import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AllInOverlay({ show, playerName }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.2 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
        >
          <div className="relative">
            {/* Glow */}
            <div className="absolute inset-0 bg-red-500/30 blur-3xl rounded-full scale-150" />
            <div className="relative bg-gradient-to-br from-red-900/95 to-black/95 border-2 border-red-500 rounded-2xl px-10 py-8 text-center shadow-2xl">
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ repeat: Infinity, duration: 1.2 }}
                className="text-6xl mb-3"
              >
                🃏
              </motion.div>
              <div className="text-red-400 font-black text-sm tracking-widest uppercase mb-1">🤫 Shhh...</div>
              <div className="text-white font-black text-3xl tracking-wide mb-2">
                {playerName ? `${playerName} is` : 'Someone is'}
              </div>
              <motion.div
                animate={{ color: ['#ef4444', '#fbbf24', '#ef4444'] }}
                transition={{ repeat: Infinity, duration: 0.8 }}
                className="font-black text-5xl tracking-widest"
                style={{ textShadow: '0 0 20px #ef4444' }}
              >
                ALL IN
              </motion.div>
              <div className="text-gray-400 text-sm mt-4 italic">Chat is paused · Please be quiet 🤫</div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}