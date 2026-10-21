import React, { useEffect, useRef } from 'react';
import { Crown, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {useVipStatus} from '@/hooks/useVipCatalog';
import {shouldCelebrateVip} from '@/lib/vipCatalog';

export default function VIPLevelUpToast({ wallet }) {
  const previousLevelRef = useRef(null);
  const {catalog,progress}=useVipStatus(wallet);

  useEffect(() => {
    if (!progress) {previousLevelRef.current=null;return;}
    const currentLevel=progress.current;
    const next={userId:wallet.user_id,revision:catalog.data.revision,xp:progress.xp,level:currentLevel.level};
    if (shouldCelebrateVip(previousLevelRef.current,next)) {
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

    previousLevelRef.current = next;
  }, [wallet?.user_id,wallet?.experience_points,catalog.data?.revision,!!progress]);

  return null;
}