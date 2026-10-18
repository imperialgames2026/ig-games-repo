import React, { useState } from 'react';
import { Gift, Sparkles, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

export default function DailyReward({ onClaim, canClaim, loading }) {
  const [showConfetti, setShowConfetti] = useState(false);

  const handleClaim = async () => {
    setShowConfetti(true);
    await onClaim();
    setTimeout(() => setShowConfetti(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-600/20 to-pink-500/10 border border-purple-500/30 p-6"
    >
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-br from-purple-500/20 to-transparent rounded-full animate-pulse" />
      </div>

      <AnimatePresence>
        {showConfetti && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 pointer-events-none"
          >
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ y: 0, x: Math.random() * 100 + '%', opacity: 1 }}
                animate={{ y: 200, opacity: 0 }}
                transition={{ duration: 1.5, delay: Math.random() * 0.5 }}
                className="absolute w-2 h-2 rounded-full"
                style={{ backgroundColor: ['#FFD700', '#E91E63', '#00E676', '#2196F3'][i % 4] }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
          <Gift className="w-7 h-7 text-white" />
        </div>
        
        <div className="flex-1">
          <h3 className="text-lg font-bold text-white mb-1">Daily Reward</h3>
          <p className="text-sm text-gray-400">
            {canClaim ? 'Claim 20,000 IC + 1 ID free!' : 'Come back in 24 hours!'}
          </p>
        </div>

        <Button
          onClick={handleClaim}
          disabled={!canClaim || loading}
          className={`h-12 px-6 rounded-xl font-bold ${canClaim ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600' : 'bg-white/10'}`}
        >
          {canClaim ? (
            <>
              <Sparkles className="w-5 h-5 mr-2" />
              Claim
            </>
          ) : (
            <>
              <Check className="w-5 h-5 mr-2" />
              Claimed
            </>
          )}
        </Button>
      </div>
    </motion.div>
  );
}