import React, { useEffect, useRef } from 'react';
import { Crown, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { calculateVIPLevel } from './VIPHelper';

export default function VIPLevelUpToast({ wallet }) {
  const previousLevelRef = useRef(null);

  useEffect(() => {
    if (!wallet) return;

    const currentLevel = calculateVIPLevel(wallet.experience_points || 0);
    const previousLevel = previousLevelRef.current;

    if (previousLevel && currentLevel.level > previousLevel.level) {
      toast.custom(() => (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="w-[360px] rounded-2xl border border-pink-500/30 bg-gradient-to-br from-[#241433] to-[#0F0A1E] p-5 shadow-2xl"
        >
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-pink-700 text-white shadow-lg shadow-pink-500/30">
              <Crown className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4 text-pink-400" />
                <p className="text-xs uppercase tracking-[0.2em] text-pink-300">VIP Level Up</p>
              </div>
              <h4 className="text-lg font-black text-white">You reached {currentLevel.name}</h4>
              <p className="text-sm text-gray-300 mt-1">Welcome to the {currentLevel.tier} tier.</p>
            </div>
          </div>
        </motion.div>
      ), { duration: 6000 });
    }

    previousLevelRef.current = currentLevel;
  }, [wallet]);

  return null;
}