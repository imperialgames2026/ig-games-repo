import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { X, TrendingUp, TrendingDown, Gift, ShoppingBag, Gamepad2, Star, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const TYPE_CONFIG = {
  purchase:     { label: 'Purchase',      icon: ShoppingBag, color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/30' },
  win:          { label: 'Game Win',      icon: TrendingUp,  color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/30' },
  loss:         { label: 'Game Loss',     icon: TrendingDown,color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/30' },
  bonus:        { label: 'Bonus',         icon: Gift,        color: 'text-pink-400',   bg: 'bg-pink-500/10 border-pink-500/30' },
  daily_reward: { label: 'Daily Reward',  icon: Star,        color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30' },
  admin_credit: { label: 'Admin Credit',  icon: TrendingUp,  color: 'text-cyan-400',   bg: 'bg-cyan-500/10 border-cyan-500/30' },
  admin_debit:  { label: 'Admin Debit',   icon: TrendingDown,color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30' },
};

function StatRow({ label, value, highlight }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-white/5">
      <span className="text-xs text-gray-400">{label}</span>
      <span className={`text-xs font-bold ${highlight || 'text-white'}`}>{value}</span>
    </div>
  );
}

export default function UserStatementModal({ wallet, onClose }) {
  const { data: transactions = [], isLoading, refetch } = useQuery({
    queryKey: ['admin-statement', wallet.user_email],
    queryFn: () => base44.asServiceRole
      ? base44.entities.Transaction.filter({ user_email: wallet.user_email }, '-created_date', 200)
      : base44.entities.Transaction.filter({ user_email: wallet.user_email }, '-created_date', 200),
    enabled: !!wallet.user_email,
  });

  const totalCredits = transactions.filter(t => (t.amount || 0) > 0).reduce((s, t) => s + (t.amount || 0), 0);
  const totalDebits  = transactions.filter(t => (t.amount || 0) < 0).reduce((s, t) => s + Math.abs(t.amount || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#1A1528] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-white/10">
          <div>
            <h2 className="text-xl font-black text-white">Account Statement</h2>
            <p className="text-sm text-gray-400 mt-0.5">{wallet.user_email}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => refetch()} size="sm" variant="outline" className="border-white/20 text-white">
              <RefreshCw className="w-3 h-3" />
            </Button>
            <Button onClick={onClose} size="sm" variant="ghost" className="text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3 p-4 border-b border-white/10">
          <div className="bg-white/5 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-400 mb-1">Current IC</p>
            <p className="text-lg font-black text-yellow-400">{(wallet.tokens || 0).toLocaleString()}</p>
          </div>
          <div className="bg-white/5 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-400 mb-1">Current ID</p>
            <p className="text-lg font-black text-green-400">{(wallet.cat_dollars || 0).toFixed(2)}</p>
          </div>
          <div className="bg-white/5 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-400 mb-1">Transactions</p>
            <p className="text-lg font-black text-white">{transactions.length}</p>
          </div>
        </div>

        {/* Transaction list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isLoading && (
            <p className="text-gray-400 text-sm text-center py-8">Loading transactions...</p>
          )}
          {!isLoading && transactions.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Gamepad2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No transactions recorded yet</p>
              <p className="text-xs mt-1">Future balance changes will appear here</p>
            </div>
          )}
          {transactions.map((tx) => {
            const cfg = TYPE_CONFIG[tx.type] || TYPE_CONFIG['bonus'];
            const Icon = cfg.icon;
            const isPositive = (tx.amount || 0) >= 0;
            return (
              <div key={tx.id} className={`flex items-start gap-3 p-3 rounded-xl border ${cfg.bg}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
                  <Icon className={`w-4 h-4 ${cfg.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className={`text-sm font-bold ${cfg.color}`}>{cfg.label}</p>
                      {tx.description && <p className="text-xs text-gray-400 mt-0.5 truncate">{tx.description}</p>}
                      {tx.game_slug && <p className="text-xs text-gray-500">Game: {tx.game_slug}</p>}
                      {tx.notes && <p className="text-xs text-gray-500 italic">{tx.notes}</p>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-sm font-black ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                        {isPositive ? '+' : ''}{(tx.amount || 0).toLocaleString()}
                        {tx.cat_dollars ? ` / ${tx.cat_dollars > 0 ? '+' : ''}${tx.cat_dollars} ID` : ''}
                      </p>
                      {tx.balance_after != null && (
                        <p className="text-xs text-gray-500">Bal: {tx.balance_after.toLocaleString()}</p>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    {new Date(tx.created_date).toLocaleString('en-US', { timeZone: 'America/New_York' })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer totals */}
        <div className="p-4 border-t border-white/10 bg-white/5 rounded-b-2xl">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Total Credits: <span className="text-green-400 font-bold">+{totalCredits.toLocaleString()}</span></span>
            <span className="text-gray-400">Total Debits: <span className="text-red-400 font-bold">-{totalDebits.toLocaleString()}</span></span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}