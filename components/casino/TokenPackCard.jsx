import React from 'react';
import { Coins, Sparkles, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import CryptoPaymentDialog from './CryptoPaymentDialog';

export default function TokenPackCard({ pack, wallet }) {
  
  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      transition={{ type: "spring", stiffness: 300 }}
      className="relative"
    >
      {/* Badge */}
      {pack.badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
          <div className="px-4 py-1 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full text-xs font-bold text-white shadow-lg">
            {pack.badge}
          </div>
        </div>
      )}

      <div className={`relative overflow-hidden rounded-2xl border ${pack.is_featured ? 'border-pink-500/50 bg-gradient-to-br from-pink-500/10 to-pink-600/5' : 'border-white/10 bg-gradient-to-br from-[#1A1528] to-[#0F0A1E]'} p-6`}>
        {/* Decorative Elements */}
        {pack.is_featured && (
          <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/20 blur-3xl rounded-full" />
        )}

        <div className="relative">
          {/* Coin Image or Icon */}
          {pack.image_url ? (
            <div className="w-20 h-20 mx-auto mb-4">
              <img 
                src={pack.image_url} 
                alt={pack.name}
                className="w-full h-full object-contain drop-shadow-2xl"
              />
            </div>
          ) : (
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-pink-500 to-pink-600 flex items-center justify-center shadow-lg shadow-pink-500/30">
              <Coins className="w-8 h-8 text-white" />
            </div>
          )}

          {/* Pack Name */}
          <h3 className="text-xl font-bold text-white text-center mb-2">{pack.name}</h3>

          {/* Token Amount */}
           <div className="text-center mb-4">
             <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-pink-500">
               {(pack.tokens || 0).toLocaleString()} IG
             </div>
             <div className="text-sm text-gray-400">IG</div>
             {(pack.cat_dollars || 0) > 0 && (
               <div className="mt-2 text-lg font-bold text-green-400">
                 + {pack.cat_dollars} IGUSD (FREE)
               </div>
             )}
           </div>

          {/* Active Bonus Indicator */}
          {wallet?.active_bonus > 0 && (
            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="text-sm text-amber-400 font-medium">🎉 +{wallet.active_bonus}% Bonus Will Be Applied</span>
              </div>
            </div>
          )}

          {/* Price */}
          <CryptoPaymentDialog pack={pack}>
            <Button
              className={`w-full h-12 text-lg font-bold rounded-xl ${pack.is_featured ? 'bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700' : 'bg-white/10 hover:bg-white/20'}`}
            >
              <Zap className="w-5 h-5 mr-2" />
              ${(pack.price || 0).toFixed(2)}
            </Button>
          </CryptoPaymentDialog>
          <p className="text-[10px] text-gray-500 text-center mt-2">Taxes included</p>
        </div>
      </div>
    </motion.div>
  );
}