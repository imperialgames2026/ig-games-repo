import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import PullToRefresh from '@/components/mobile/PullToRefresh';
import { ArrowUpCircle, ArrowDownCircle, ShoppingBag, Gift, DollarSign, Filter, Search, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';

const typeIcons = {
  purchase: ShoppingBag,
  win: ArrowUpCircle,
  loss: ArrowDownCircle,
  bonus: Gift,
  daily_reward: Calendar,
};

const typeColors = {
  purchase: 'from-blue-500 to-blue-600',
  win: 'from-green-500 to-green-600',
  loss: 'from-red-500 to-red-600',
  bonus: 'from-purple-500 to-purple-600',
  daily_reward: 'from-amber-500 to-amber-600',
};

export default function TransactionHistory() {
  const [user, setUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const queryClient = useQueryClient();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const u = await base44.auth.me();
        setUser(u);
      } catch (e) {
        base44.auth.redirectToLogin();
      }
    };
    loadUser();
  }, []);

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['transactions', user?.email],
    queryFn: () => base44.entities.Transaction.filter({ user_email: user?.email }),
    enabled: !!user?.email,
  });

  const { data: walletGifts = [], isLoading: isLoadingGifts } = useQuery({
    queryKey: ['wallet-gifts-history', user?.email],
    queryFn: () => base44.entities.WalletGift.list('-created_date', 100),
    enabled: !!user?.email,
  });

  const filteredGifts = walletGifts
    .filter(gift => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const haystack = `${gift.sender_email || ''} ${gift.recipient_email || ''} ${gift.currency || ''} ${gift.note || ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      if (dateRange !== 'all') {
        const giftDate = new Date(gift.created_date);
        const now = new Date();
        const daysDiff = Math.floor((now - giftDate) / (1000 * 60 * 60 * 24));

        if (dateRange === '7days' && daysDiff > 7) return false;
        if (dateRange === '30days' && daysDiff > 30) return false;
        if (dateRange === '90days' && daysDiff > 90) return false;
      }

      return true;
    })
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

  const totalGiftsSent = walletGifts
    .filter(gift => gift.sender_email === user?.email)
    .reduce((sum, gift) => sum + (gift.amount || 0), 0);

  const totalGiftsReceived = walletGifts
    .filter(gift => gift.recipient_email === user?.email)
    .reduce((sum, gift) => sum + (gift.amount || 0), 0);

  const filteredTransactions = transactions
    .filter(tx => {
      // Type filter
      if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
      
      // Search filter
      if (searchQuery && !tx.description?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      
      // Date range filter
      if (dateRange !== 'all') {
        const txDate = new Date(tx.created_date);
        const now = new Date();
        const daysDiff = Math.floor((now - txDate) / (1000 * 60 * 60 * 24));
        
        if (dateRange === '7days' && daysDiff > 7) return false;
        if (dateRange === '30days' && daysDiff > 30) return false;
        if (dateRange === '90days' && daysDiff > 90) return false;
      }
      
      return true;
    })
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

  const totalDeposits = transactions
    .filter(tx => tx.type === 'purchase')
    .reduce((sum, tx) => sum + (tx.amount || 0), 0);

  const totalWins = transactions
    .filter(tx => tx.type === 'win')
    .reduce((sum, tx) => sum + (tx.amount || 0), 0);

  const totalLosses = transactions
    .filter(tx => tx.type === 'loss')
    .reduce((sum, tx) => sum + Math.abs(tx.amount || 0), 0);

  const handleRefresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['transactions', user?.email] }),
      queryClient.invalidateQueries({ queryKey: ['wallet-gifts-history', user?.email] }),
    ]);
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="min-h-screen bg-[#0A0612]">
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/30 via-transparent to-purple-900/20" />
        
        <div className="relative max-w-7xl mx-auto px-4 py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-400 to-purple-500 shadow-lg shadow-blue-500/30 mb-6">
              <DollarSign className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl font-black text-white mb-4">Transaction History</h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Complete record of all your account activity
            </p>
          </motion.div>

          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mt-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="p-6 rounded-2xl bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20"
            >
              <div className="flex items-center gap-3 mb-2">
                <ShoppingBag className="w-5 h-5 text-blue-400" />
                <span className="text-sm text-gray-400">Total Deposits</span>
              </div>
              <div className="text-3xl font-black text-white">{totalDeposits.toLocaleString()}</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="p-6 rounded-2xl bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/20"
            >
              <div className="flex items-center gap-3 mb-2">
                <ArrowUpCircle className="w-5 h-5 text-green-400" />
                <span className="text-sm text-gray-400">Total Wins</span>
              </div>
              <div className="text-3xl font-black text-white">{totalWins.toLocaleString()}</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="p-6 rounded-2xl bg-gradient-to-br from-red-500/10 to-red-600/5 border border-red-500/20"
            >
              <div className="flex items-center gap-3 mb-2">
                <ArrowDownCircle className="w-5 h-5 text-red-400" />
                <span className="text-sm text-gray-400">Total Losses</span>
              </div>
              <div className="text-3xl font-black text-white">{totalLosses.toLocaleString()}</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="p-6 rounded-2xl bg-gradient-to-br from-pink-500/10 to-pink-600/5 border border-pink-500/20"
            >
              <div className="flex items-center gap-3 mb-2">
                <Gift className="w-5 h-5 text-pink-400" />
                <span className="text-sm text-gray-400">Gifts Sent</span>
              </div>
              <div className="text-3xl font-black text-white">{totalGiftsSent.toLocaleString()}</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="p-6 rounded-2xl bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20"
            >
              <div className="flex items-center gap-3 mb-2">
                <Gift className="w-5 h-5 text-purple-400" />
                <span className="text-sm text-gray-400">Gifts Received</span>
              </div>
              <div className="text-3xl font-black text-white">{totalGiftsReceived.toLocaleString()}</div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="flex flex-wrap gap-3">
            <a href="/AMOE"><Button variant="outline">Free AMOE Entry</Button></a>
            <a href="/PrizeClaims"><Button variant="outline">Prize Claims</Button></a>
            <a href="/KYCVerification"><Button variant="outline">KYC Verification</Button></a>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              placeholder="Search transactions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-[#1A1528] border-white/10 text-white"
            />
          </div>
          
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-48 bg-[#1A1528] border-white/10 text-white">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent className="bg-[#1A1528] border-white/10 text-white">
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="purchase">Purchases</SelectItem>
              <SelectItem value="win">Wins</SelectItem>
              <SelectItem value="loss">Losses</SelectItem>
              <SelectItem value="bonus">Bonuses</SelectItem>
              <SelectItem value="daily_reward">Daily Rewards</SelectItem>
            </SelectContent>
          </Select>

          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-full sm:w-48 bg-[#1A1528] border-white/10 text-white">
              <SelectValue placeholder="All Time" />
            </SelectTrigger>
            <SelectContent className="bg-[#1A1528] border-white/10 text-white">
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="7days">Last 7 Days</SelectItem>
              <SelectItem value="30days">Last 30 Days</SelectItem>
              <SelectItem value="90days">Last 90 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tips & Gifts History */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
              <Gift className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white">Tips & Gifts History</h2>
              <p className="text-sm text-gray-400">Clear record of who sent funds, who received them, and the amount.</p>
            </div>
          </div>

          <div className="space-y-3">
            {isLoadingGifts ? (
              <div className="text-center py-8 text-gray-400">Loading tips and gifts...</div>
            ) : filteredGifts.length === 0 ? (
              <div className="rounded-xl bg-[#1A1528] border border-white/10 p-8 text-center">
                <Gift className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-gray-400">No tips or gifts found</h3>
                <p className="text-gray-500 text-sm">Sent and received gifts will appear here.</p>
              </div>
            ) : (
              filteredGifts.map((gift, i) => {
                const isSent = gift.sender_email === user?.email;
                return (
                  <motion.div
                    key={gift.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className="p-4 rounded-xl bg-[#1A1528] border border-white/10 hover:border-pink-500/30 transition-all"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${isSent ? 'from-pink-500 to-pink-600' : 'from-purple-500 to-purple-600'} flex items-center justify-center shrink-0`}>
                          <Gift className="w-6 h-6 text-white" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-white font-bold">{isSent ? 'Gift Sent' : 'Gift Received'}</h3>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-gray-300">{gift.currency}</span>
                          </div>
                          <p className="text-sm text-gray-400 break-all">
                            <span className="text-gray-500">From:</span> {gift.sender_email} <span className="text-gray-600 mx-1">→</span> <span className="text-gray-500">To:</span> {gift.recipient_email}
                          </p>
                          {gift.note && <p className="text-sm text-gray-500 mt-1">“{gift.note}”</p>}
                          <p className="text-xs text-gray-500 mt-1">
                            {format(new Date(gift.created_date), 'MMM dd, yyyy • hh:mm a')}
                          </p>
                        </div>
                      </div>
                      <div className={`text-2xl font-black ${isSent ? 'text-red-400' : 'text-green-400'} sm:text-right`}>
                        {isSent ? '-' : '+'}{(gift.amount || 0).toLocaleString()} {gift.currency}
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>

        {/* Transaction List */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="text-gray-400">Loading transactions...</div>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-400">No transactions found</h3>
              <p className="text-gray-500">Try adjusting your filters</p>
            </div>
          ) : (
            filteredTransactions.map((tx, i) => {
              const Icon = typeIcons[tx.type] || DollarSign;
              const color = typeColors[tx.type] || 'from-gray-500 to-gray-600';
              
              return (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="p-4 rounded-xl bg-[#1A1528] border border-white/10 hover:border-white/20 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-white font-bold capitalize">{tx.type.replace('_', ' ')}</h3>
                          {tx.game_slug && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-400">
                              {tx.game_slug}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-400">{tx.description}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {format(new Date(tx.created_date), 'MMM dd, yyyy • hh:mm a')}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className={`text-xl font-black ${
                        tx.amount > 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        Balance: {(tx.balance_after || 0).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>
    </div>
    </PullToRefresh>
  );
}