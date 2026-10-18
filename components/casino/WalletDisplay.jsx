import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Coins, Plus, TrendingUp, Crown, Briefcase, Star, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { motion, AnimatePresence } from 'framer-motion';
import { calculateVIPLevel, getNextLevel, getProgressToNextLevel } from './VIPHelper';
import RedeemVoucher from './RedeemVoucher';
import WalletGiftDialog from './WalletGiftDialog';

export default function WalletDisplay({ wallet, compact = false, currency, onCurrencyChange, user, onBet, rewardPulse = false }) {
        const currentXP = wallet?.experience_points || 0;
        const vipLevel = calculateVIPLevel(currentXP);
        const nextLevel = getNextLevel(currentXP);
        const progressPercent = getProgressToNextLevel(currentXP);

        const currencyOptions = [
          { key: 'IC', label: 'IGN', balance: wallet?.tokens || 0, accent: 'text-pink-400' },
          { key: 'ID', label: 'IGD', balance: wallet?.cat_dollars || 0, accent: 'text-green-400' },
          { key: 'IGT', label: 'IGT', balance: wallet?.igt_tokens || 0, accent: 'text-cyan-400' },
        ];

        const selectedCurrency = currencyOptions.find((option) => option.key === currency) || currencyOptions[0];
        const selectCurrency = (currencyKey) => onCurrencyChange?.(currencyKey);

        if (compact) {
          return (
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    className="flex items-center gap-3 px-4 py-2 rounded-xl bg-gradient-to-r from-pink-500/20 to-pink-600/10 border border-pink-500/30 cursor-pointer transition-all"
                  >
                    <img 
                      src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/697dc67abbb768c5bbbab5d5/4ff0ab8f4_Screenshot_20260216-223614Firefox6.png"
                      alt={selectedCurrency.label}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                    <div className="text-left">
                      <div className={`text-xs font-semibold ${selectedCurrency.accent}`}>{selectedCurrency.label}</div>
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={`${selectedCurrency.key}-${selectedCurrency.balance}`}
                          initial={{ y: -10, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          exit={{ y: 10, opacity: 0 }}
                          className="text-lg font-bold text-white"
                        >
                          {selectedCurrency.balance.toLocaleString()}
                        </motion.div>
                      </AnimatePresence>
                    </div>
                    <ChevronDown className="w-4 h-4 text-gray-300" />
                  </motion.button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-44 bg-[#1A1528] border-white/10 text-white">
                  {currencyOptions.map((option) => (
                    <DropdownMenuItem
                      key={option.key}
                      onClick={() => onCurrencyChange?.(option.key)}
                      className="cursor-pointer hover:bg-white/10 focus:bg-white/10"
                    >
                      <div className="flex w-full items-center justify-between gap-3">
                        <span className={option.accent}>{option.label}</span>
                        <span className="text-sm text-gray-300">{option.balance.toLocaleString()}</span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {wallet?.active_bonus > 0 && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gradient-to-r from-amber-500/20 to-amber-600/10 border border-amber-500/30">
                  <Briefcase className="w-3 h-3 text-amber-400" />
                  <span className="text-xs font-bold text-amber-400">+{wallet.active_bonus}%</span>
                </div>
              )}

              <Link to={createPageUrl('Store')}>
                <Plus className="w-5 h-5 text-pink-400 cursor-pointer hover:text-pink-300" />
              </Link>
            </div>
          );
        }

  return (
    <div className="rounded-2xl bg-gradient-to-br from-[#1A1528] to-[#0F0A1E] border border-white/10 p-6">
      <motion.div animate={rewardPulse ? { scale: [1, 1.03, 1] } : { scale: 1 }} transition={{ duration: 0.6 }} className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-white">Your Wallet</h3>
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-pink-500/20 to-pink-600/20 border border-pink-500/30">
          <span className="text-lg">{vipLevel.icon}</span>
          <span className="text-sm font-medium text-pink-400">{vipLevel.name} VIP</span>
        </div>
      </motion.div>

      {/* VIP Progress Bar */}
      <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-gray-300">VIP Progress</span>
          </div>
          <span className="text-xs text-gray-400">{currentXP.toLocaleString()} XP</span>
        </div>
        <div className="w-full h-2 bg-black/30 rounded-full overflow-hidden mb-2">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className={`h-full bg-gradient-to-r ${vipLevel.color}`}
          />
        </div>
        {nextLevel ? (
          <div className="text-xs text-gray-400 text-center">
            {(nextLevel.xp_required - currentXP).toLocaleString()} XP to {nextLevel.name}
          </div>
        ) : (
          <div className="text-xs text-pink-400 text-center font-bold">MAX LEVEL REACHED! ✧</div>
        )}
      </div>

      {/* Imperial Coins */}
      <motion.button
        onClick={() => selectCurrency('IC')}
        whileHover={{ scale: 1.02 }}
        className="w-full flex items-center gap-4 mb-4 p-3 rounded-xl transition-all hover:bg-pink-500/10"
      >
        <div className={`w-16 h-16 rounded-full flex items-center justify-center relative border-2 transition-all duration-500 ${
          currency === 'IC' 
            ? 'border-white shadow-[0_0_30px_rgba(236,72,153,0.8)] shadow-pink-500' 
            : 'border-transparent shadow-none opacity-50 grayscale'
        }`}>
          <img 
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/697dc67abbb768c5bbbab5d5/4ff0ab8f4_Screenshot_20260216-223614Firefox6.png"
            alt="IC"
            className="w-full h-full rounded-full object-cover"
          />
        </div>
        <div className="text-left flex-1">
          <div className="text-sm text-gray-400">IG</div>
          <div className={`text-3xl font-black transition-all duration-500 ${currency === 'IC' ? 'text-white' : 'text-gray-600'}`}>
            {(wallet?.tokens || 0).toLocaleString()}
          </div>
        </div>
        {currency === 'IC' && <div className="text-pink-400 font-bold">✓</div>}
      </motion.button>

      {/* Imperial Dollars */}
      <motion.button
        onClick={() => selectCurrency('ID')}
        whileHover={{ scale: 1.02 }}
        className="w-full flex items-center gap-4 mb-4 p-3 rounded-xl bg-green-500/10 border border-green-500/20 transition-all hover:bg-green-500/20"
      >
        <div className={`w-12 h-12 rounded-full flex items-center justify-center relative border-2 transition-all duration-500 ${
          currency === 'ID' 
            ? 'border-white shadow-[0_0_30px_rgba(34,197,94,0.8)] shadow-green-500' 
            : 'border-transparent shadow-none opacity-50 grayscale'
        }`}>
          <img 
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/697dc67abbb768c5bbbab5d5/4ff0ab8f4_Screenshot_20260216-223614Firefox6.png"
            alt="IGD"
            className="w-full h-full rounded-full object-cover"
          />
        </div>
        <div className="text-left flex-1">
          <div className="text-sm text-gray-400">IGD</div>
          <div className={`text-2xl font-black transition-all duration-500 ${currency === 'ID' ? 'text-green-400' : 'text-gray-600'}`}>
            {(wallet?.cat_dollars || 0).toLocaleString()}
          </div>
        </div>
        {currency === 'ID' && <div className="text-green-400 font-bold">✓</div>}
      </motion.button>

      {/* Imperial Gaming Token */}
      <motion.button
        onClick={() => selectCurrency('IGT')}
        whileHover={{ scale: 1.02 }}
        className="w-full flex items-center gap-4 mb-6 p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 transition-all hover:bg-cyan-500/20"
      >
        <div className={`w-12 h-12 rounded-full flex items-center justify-center relative border-2 transition-all duration-500 ${
          currency === 'IGT' 
            ? 'border-white shadow-[0_0_30px_rgba(34,211,238,0.8)] shadow-cyan-500' 
            : 'border-transparent shadow-none opacity-50 grayscale'
        }`}>
          <img 
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/697dc67abbb768c5bbbab5d5/4ff0ab8f4_Screenshot_20260216-223614Firefox6.png"
            alt="IGT"
            className="w-full h-full rounded-full object-cover"
          />
        </div>
        <div className="text-left flex-1">
          <div className="text-sm text-gray-400">IGT</div>
          <div className={`text-2xl font-black transition-all duration-500 ${currency === 'IGT' ? 'text-cyan-400' : 'text-gray-600'}`}>
            {(wallet?.igt_tokens || 0).toLocaleString()}
          </div>
        </div>
        {currency === 'IGT' && <div className="text-cyan-400 font-bold">✓</div>}
      </motion.button>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20">
          <div className="flex items-center gap-2 text-green-400 mb-1">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs">Total Won</span>
          </div>
          <div className="text-lg font-bold text-white">{(wallet?.total_won || 0).toLocaleString()}</div>
        </div>
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
          <div className="flex items-center gap-2 text-red-400 mb-1">
            <TrendingUp className="w-4 h-4 rotate-180" />
            <span className="text-xs">Total Lost</span>
          </div>
          <div className="text-lg font-bold text-white">{(wallet?.total_lost || 0).toLocaleString()}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link to={createPageUrl('Store')} className="flex-1">
          <Button className="w-full h-10 bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white font-bold rounded-xl text-sm">
            <Plus className="w-4 h-4 mr-1" />
            Buy IG
          </Button>
        </Link>
        {user && (
          <RedeemVoucher user={user} wallet={wallet} onBet={onBet} />
        )}
      </div>

      {user && wallet && (
        <div className="mt-3">
          <WalletGiftDialog wallet={wallet} />
        </div>
      )}
    </div>
  );
}