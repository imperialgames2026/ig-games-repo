import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Wallet, DollarSign, Coins, Search, Plus, Minus, Trash2, RefreshCw, Edit3, Save, X, AlertTriangle, Crown, TrendingUp, Gift, Shield, FileText } from 'lucide-react';
import UserStatementModal from '@/components/admin/UserStatementModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function AdminWallets() {
  const [user, setUser] = useState(null);
  const [searchEmail, setSearchEmail] = useState('');
  const [selectedWalletId, setSelectedWalletId] = useState(null);
  const [idAmount, setIdAmount] = useState('');
  const [icAmount, setIcAmount] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editFields, setEditFields] = useState({});
  const [showStatement, setShowStatement] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const u = await base44.auth.me();
        if (u.role !== 'superadmin') { window.location.href = '/'; return; }
        setUser(u);
      } catch (e) {
        base44.auth.redirectToLogin();
      }
    };
    loadUser();
  }, []);

  const { data: wallets = [], isLoading } = useQuery({
    queryKey: ['admin-wallets'],
    queryFn: () => base44.entities.UserWallet.list('-created_date', 200),
    enabled: !!user,
  });

  // Derive selected wallet from live query data to avoid stale references
  const selectedWallet = wallets.find(w => w.id === selectedWalletId) || null;

  const updateWalletMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.UserWallet.update(id, data),
    onSuccess: () => {
      toast.success('Wallet updated!');
      setIdAmount(''); setIcAmount('');
      setIsEditing(false);
      queryClient.invalidateQueries(['admin-wallets']);
    },
    onError: () => toast.error('Failed to update wallet'),
  });

  const deleteWalletMutation = useMutation({
    mutationFn: (id) => base44.entities.UserWallet.delete(id),
    onSuccess: () => {
      toast.success('Wallet deleted!');
      setSelectedWalletId(null);
      queryClient.invalidateQueries(['admin-wallets']);
    },
    onError: () => toast.error('Failed to delete wallet'),
  });

  const handleAdjust = (field, current, amount, op) => {
    if (!selectedWallet || !amount) return;
    const val = parseFloat(amount);
    if (isNaN(val)) return;
    const newVal = op === 'add' ? current + val : Math.max(0, current - val);
    updateWalletMutation.mutate({ id: selectedWallet.id, data: { [field]: newVal } });
  };

  const handleSaveEdits = () => {
    const data = {};
    const fields = ['tokens', 'cat_dollars', 'vip_level', 'experience_points', 'total_won', 'total_lost', 'total_purchased', 'purchase_count', 'bonus_50_available', 'bonus_100_available', 'bonus_150_available'];
    fields.forEach(f => {
      if (editFields[f] !== undefined && editFields[f] !== '') {
        if (f.startsWith('bonus_')) {
          data[f] = editFields[f] === true || editFields[f] === 'true';
        } else {
          data[f] = parseFloat(editFields[f]);
        }
      }
    });
    updateWalletMutation.mutate({ id: selectedWallet.id, data });
  };

  const handleResetWallet = () => {
    if (!confirm('Reset this wallet to default values (1000 IC, 0 ID)?')) return;
    updateWalletMutation.mutate({
      id: selectedWallet.id,
      data: { tokens: 1000, cat_dollars: 0, total_won: 0, total_lost: 0, experience_points: 0, vip_level: 1, purchase_count: 0, bonus_50_available: true, bonus_100_available: true, bonus_150_available: true },
    });
  };

  const handleDelete = () => {
    if (!confirm(`Permanently delete wallet for ${selectedWallet.user_email}? This cannot be undone.`)) return;
    deleteWalletMutation.mutate(selectedWallet.id);
  };



  const filteredWallets = wallets.filter(w =>
    w.user_email.toLowerCase().includes(searchEmail.toLowerCase())
  );

  const startEditing = () => {
    setEditFields({
      tokens: selectedWallet.tokens,
      cat_dollars: selectedWallet.cat_dollars,
      vip_level: selectedWallet.vip_level || 1,
      experience_points: selectedWallet.experience_points || 0,
      total_won: selectedWallet.total_won || 0,
      total_lost: selectedWallet.total_lost || 0,
      purchase_count: selectedWallet.purchase_count || 0,
      bonus_50_available: selectedWallet.bonus_50_available ?? true,
      bonus_100_available: selectedWallet.bonus_100_available ?? true,
      bonus_150_available: selectedWallet.bonus_150_available ?? true,
    });
    setIsEditing(true);
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#0A0612] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-black text-white mb-2">Wallet Management</h1>
            <p className="text-gray-400">{wallets.length} total wallets</p>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => queryClient.invalidateQueries(['admin-wallets'])} variant="outline" className="border-white/20 text-white">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Wallet List */}
          <div className="lg:col-span-1">
            <div className="bg-gradient-to-br from-[#1A1528] to-[#0F0A1E] border border-white/10 rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <Wallet className="w-5 h-5 text-pink-400" />
                <h2 className="text-lg font-bold text-white">User Wallets</h2>
              </div>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                  placeholder="Search by email..."
                  className="pl-9 bg-white/10 border-white/20 text-white placeholder-gray-500"
                />
              </div>
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {isLoading && <p className="text-gray-400 text-sm text-center py-4">Loading...</p>}
                {filteredWallets.map((wallet) => (
                  <div
                    key={wallet.id}
                    onClick={() => { setSelectedWalletId(wallet.id); setIsEditing(false); }}
                    className={`p-3 rounded-lg cursor-pointer transition-colors border-2 ${
                      selectedWallet?.id === wallet.id
                        ? 'bg-pink-500/20 border-pink-500'
                        : 'bg-white/5 hover:bg-white/10 border-transparent'
                    }`}
                  >
                    <p className="font-bold text-white text-xs mb-1 truncate">{wallet.user_email}</p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-yellow-400">{(wallet.tokens || 0).toLocaleString()} IC</span>
                      <span className="text-green-400">{(wallet.cat_dollars || 0).toFixed(2)} ID</span>

                    </div>
                  </div>
                ))}
                {!isLoading && filteredWallets.length === 0 && (
                  <p className="text-gray-500 text-sm text-center py-8">No wallets found</p>
                )}
              </div>
            </div>
          </div>

          {/* Wallet Editor */}
          <div className="lg:col-span-2">
            {selectedWallet ? (
              <motion.div
                key={selectedWallet.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-br from-[#1A1528] to-[#0F0A1E] border border-white/10 rounded-2xl p-6 space-y-6"
              >
                {/* Title + Actions */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-white">{selectedWallet.user_email}</h2>
                    <p className="text-xs text-gray-500 mt-1">ID: {selectedWallet.id}</p>
                    <p className="text-xs text-gray-500">Created: {new Date(selectedWallet.created_date).toLocaleString()}</p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button onClick={() => setShowStatement(true)} size="sm" className="bg-purple-600 hover:bg-purple-700">
                      <FileText className="w-4 h-4 mr-1" /> Statement
                    </Button>
                    {!isEditing ? (
                      <Button onClick={startEditing} size="sm" className="bg-blue-600 hover:bg-blue-700">
                        <Edit3 className="w-4 h-4 mr-1" /> Edit All Fields
                      </Button>
                    ) : (
                      <>
                        <Button onClick={handleSaveEdits} size="sm" className="bg-green-600 hover:bg-green-700" disabled={updateWalletMutation.isPending}>
                          <Save className="w-4 h-4 mr-1" /> Save
                        </Button>
                        <Button onClick={() => setIsEditing(false)} size="sm" variant="outline" className="border-white/20 text-white">
                          <X className="w-4 h-4 mr-1" /> Cancel
                        </Button>
                      </>
                    )}
                    <Button onClick={handleResetWallet} size="sm" className="bg-yellow-600 hover:bg-yellow-700">
                      <RefreshCw className="w-4 h-4 mr-1" /> Reset
                    </Button>
                    <Button onClick={handleDelete} size="sm" className="bg-red-700 hover:bg-red-800" disabled={deleteWalletMutation.isPending}>
                      <Trash2 className="w-4 h-4 mr-1" /> Delete
                    </Button>
                  </div>
                </div>

                {/* Edit All Fields Mode */}
                {isEditing ? (
                  <div className="bg-white/5 rounded-xl p-5 border border-blue-500/30">
                    <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                      <Edit3 className="w-4 h-4 text-blue-400" /> Edit Raw Fields
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { key: 'tokens', label: 'Imperial Coins (IC)' },
                        { key: 'cat_dollars', label: 'Imperial Dollars (ID)' },
                        { key: 'vip_level', label: 'VIP Level' },
                        { key: 'experience_points', label: 'Experience Points (XP)' },
                        { key: 'total_won', label: 'Total Won' },
                        { key: 'total_lost', label: 'Total Lost' },
                        { key: 'purchase_count', label: 'Purchase Count' },
                      ].map(({ key, label }) => (
                        <div key={key}>
                          <label className="text-xs text-gray-400 mb-1 block">{label}</label>
                          <Input
                            type="number"
                            value={editFields[key] ?? ''}
                            onChange={(e) => setEditFields(p => ({ ...p, [key]: e.target.value }))}
                            className="bg-white/10 border-white/20 text-white"
                          />
                        </div>
                      ))}
                      {/* Bonus toggles */}
                      {[
                        { key: 'bonus_50_available', label: '50% Bonus Available' },
                        { key: 'bonus_100_available', label: '100% Bonus Available' },
                        { key: 'bonus_150_available', label: '150% Bonus Available' },
                      ].map(({ key, label }) => (
                        <div key={key} className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            id={key}
                            checked={!!editFields[key]}
                            onChange={(e) => setEditFields(p => ({ ...p, [key]: e.target.checked }))}
                            className="w-5 h-5 accent-pink-500"
                          />
                          <label htmlFor={key} className="text-sm text-gray-300">{label}</label>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Quick Adjust */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* IC */}
                      <div className="bg-white/5 rounded-xl p-4 border border-yellow-500/30">
                        <div className="flex items-center gap-2 mb-3">
                          <Coins className="w-5 h-5 text-yellow-400" />
                          <span className="font-bold text-white">Imperial Coins (IC)</span>
                        </div>
                        <p className="text-2xl font-black text-yellow-400 mb-3">{(selectedWallet.tokens || 0).toLocaleString()}</p>
                        <Input
                          type="number" value={icAmount} onChange={(e) => setIcAmount(e.target.value)}
                          placeholder="Amount..." className="bg-white/10 border-white/20 text-white mb-3" step="0.01"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <Button onClick={() => handleAdjust('tokens', selectedWallet.tokens, icAmount, 'add')} disabled={!icAmount} className="bg-green-600 hover:bg-green-700 text-sm">
                            <Plus className="w-3 h-3 mr-1" /> Add
                          </Button>
                          <Button onClick={() => handleAdjust('tokens', selectedWallet.tokens, icAmount, 'sub')} disabled={!icAmount} className="bg-red-600 hover:bg-red-700 text-sm">
                            <Minus className="w-3 h-3 mr-1" /> Subtract
                          </Button>
                        </div>
                        <div className="flex gap-2 mt-2">
                          {[1000, 10000, 100000].map(v => (
                            <button key={v} onClick={() => updateWalletMutation.mutate({ id: selectedWallet.id, data: { tokens: (selectedWallet.tokens || 0) + v } })}
                              className="flex-1 text-xs py-1.5 rounded bg-yellow-500/20 hover:bg-yellow-500/40 text-yellow-300 transition-colors">
                              +{v >= 1000 ? `${v/1000}K` : v}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* ID */}
                      <div className="bg-white/5 rounded-xl p-4 border border-green-500/30">
                        <div className="flex items-center gap-2 mb-3">
                          <DollarSign className="w-5 h-5 text-green-400" />
                          <span className="font-bold text-white">Imperial Dollars (ID)</span>
                        </div>
                        <p className="text-2xl font-black text-green-400 mb-3">{(selectedWallet.cat_dollars || 0).toFixed(2)}</p>
                        <Input
                          type="number" value={idAmount} onChange={(e) => setIdAmount(e.target.value)}
                          placeholder="Amount..." className="bg-white/10 border-white/20 text-white mb-3" step="0.01"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <Button onClick={() => handleAdjust('cat_dollars', selectedWallet.cat_dollars, idAmount, 'add')} disabled={!idAmount} className="bg-green-600 hover:bg-green-700 text-sm">
                            <Plus className="w-3 h-3 mr-1" /> Add
                          </Button>
                          <Button onClick={() => handleAdjust('cat_dollars', selectedWallet.cat_dollars, idAmount, 'sub')} disabled={!idAmount} className="bg-red-600 hover:bg-red-700 text-sm">
                            <Minus className="w-3 h-3 mr-1" /> Subtract
                          </Button>
                        </div>
                        <div className="flex gap-2 mt-2">
                          {[1, 5, 25].map(v => (
                            <button key={v} onClick={() => updateWalletMutation.mutate({ id: selectedWallet.id, data: { cat_dollars: (selectedWallet.cat_dollars || 0) + v } })}
                              className="flex-1 text-xs py-1.5 rounded bg-green-500/20 hover:bg-green-500/40 text-green-300 transition-colors">
                              +{v}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { label: 'VIP Level', value: selectedWallet.vip_level || 1, icon: Crown, color: 'text-purple-400' },
                        { label: 'XP', value: (selectedWallet.experience_points || 0).toLocaleString(), icon: TrendingUp, color: 'text-blue-400' },
                        { label: 'Total Won', value: (selectedWallet.total_won || 0).toLocaleString(), icon: TrendingUp, color: 'text-green-400' },
                        { label: 'Total Lost', value: (selectedWallet.total_lost || 0).toLocaleString(), icon: TrendingUp, color: 'text-red-400' },
                        { label: 'Purchases', value: selectedWallet.purchase_count || 0, icon: Gift, color: 'text-yellow-400' },
                        { label: 'Total Deposited', value: (selectedWallet.total_deposited || 0).toFixed(2), icon: DollarSign, color: 'text-pink-400' },
                        { label: 'Referral Code', value: selectedWallet.referral_code || 'None', icon: Shield, color: 'text-cyan-400' },
                        { label: 'Active Bonus', value: `${selectedWallet.active_bonus || 0}%`, icon: Gift, color: 'text-orange-400' },
                      ].map(({ label, value, icon: Icon, color }) => (
                        <div key={label} className="bg-white/5 rounded-lg p-3">
                          <div className="flex items-center gap-1 mb-1">
                            <Icon className={`w-3 h-3 ${color}`} />
                            <span className="text-xs text-gray-400">{label}</span>
                          </div>
                          <p className={`font-bold ${color}`}>{value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Bonus Availability */}
                    <div className="bg-white/5 rounded-xl p-4 border border-pink-500/20">
                      <h4 className="text-white font-bold mb-3 text-sm flex items-center gap-2">
                        <Gift className="w-4 h-4 text-pink-400" /> Bonus Availability
                      </h4>
                      <div className="flex flex-wrap gap-3">
                        {[
                          { key: 'bonus_50_available', label: '50% Bonus', val: selectedWallet.bonus_50_available ?? true },
                          { key: 'bonus_100_available', label: '100% Bonus', val: selectedWallet.bonus_100_available ?? true },
                          { key: 'bonus_150_available', label: '150% Bonus', val: selectedWallet.bonus_150_available ?? true },
                        ].map(({ key, label, val }) => (
                          <button
                            key={key}
                            onClick={() => updateWalletMutation.mutate({ id: selectedWallet.id, data: { [key]: !val } })}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                              val ? 'bg-green-500/20 border border-green-500/50 text-green-400 hover:bg-green-500/30' : 'bg-red-500/20 border border-red-500/50 text-red-400 hover:bg-red-500/30'
                            }`}
                          >
                            {label}: {val ? '✓ Available' : '✗ Used'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Danger Zone */}
                    <div className="bg-red-900/10 rounded-xl p-4 border border-red-500/20">
                      <h4 className="text-red-400 font-bold mb-3 text-sm flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" /> Danger Zone
                      </h4>
                      <div className="flex flex-wrap gap-3">
                        <Button onClick={handleResetWallet} size="sm" className="bg-yellow-700 hover:bg-yellow-800">
                          <RefreshCw className="w-3 h-3 mr-1" /> Reset to Defaults
                        </Button>
                        <Button
                          onClick={() => updateWalletMutation.mutate({ id: selectedWallet.id, data: { tokens: 0, cat_dollars: 0 } })}
                          size="sm" className="bg-orange-700 hover:bg-orange-800"
                        >
                          <Minus className="w-3 h-3 mr-1" /> Zero Out Balance
                        </Button>
                        <Button onClick={handleDelete} size="sm" className="bg-red-700 hover:bg-red-800" disabled={deleteWalletMutation.isPending}>
                          <Trash2 className="w-3 h-3 mr-1" /> Delete Wallet
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </motion.div>
            ) : (
              <div className="bg-gradient-to-br from-[#1A1528] to-[#0F0A1E] border border-white/10 rounded-2xl p-6 h-full flex items-center justify-center min-h-[400px]">
                <div className="text-center text-gray-400">
                  <Search className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-xl">Select a wallet to manage</p>
                  <p className="text-sm mt-2 text-gray-500">{wallets.length} wallets loaded</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showStatement && selectedWallet && (
        <UserStatementModal wallet={selectedWallet} onClose={() => setShowStatement(false)} />
      )}
    </div>
  );
}