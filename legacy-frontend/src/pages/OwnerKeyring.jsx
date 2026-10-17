import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Key, Lock, Wallet, ShieldCheck, Eye, EyeOff, Search, Plus, Minus,
  RefreshCw, Save, X, Edit3, AlertTriangle, Trash2, CheckCircle2,
  XCircle, MapPin, Monitor, Clock, DollarSign, Coins, Crown, User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

const KEYRING_PIN = '1983'; // Change this to your desired PIN

const TABS = ['Wallets', 'Session Data', 'KYC Override'];

export default function OwnerKeyring() {
  const [user, setUser] = useState(null);
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [activeTab, setActiveTab] = useState('Wallets');
  const [searchEmail, setSearchEmail] = useState('');
  const [selectedWalletId, setSelectedWalletId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editFields, setEditFields] = useState({});
  const [idAmount, setIdAmount] = useState('');
  const [icAmount, setIcAmount] = useState('');
  const [sessionSearch, setSessionSearch] = useState('');
  const [selectedSession, setSelectedSession] = useState(null);
  const [kycSearch, setKycSearch] = useState('');
  const [selectedKYCUser, setSelectedKYCUser] = useState(null);
  const [kycNotes, setKycNotes] = useState('');
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(u => {
      if (!u || u.role !== 'superadmin') {
        window.location.href = '/';
      } else {
        setUser(u);
      }
    }).catch(() => { window.location.href = '/'; });
  }, []);

  const handleUnlock = () => {
    if (pin === KEYRING_PIN) {
      setUnlocked(true);
      setPinError(false);
    } else {
      setPinError(true);
      setPin('');
    }
  };

  // --- WALLETS ---
  const { data: wallets = [], isLoading: walletsLoading } = useQuery({
    queryKey: ['keyring-wallets'],
    queryFn: async () => {
      const res = await base44.functions.invoke('superadminAction', { action: 'listWallets' });
      return res.data?.wallets || [];
    },
    enabled: unlocked && activeTab === 'Wallets',
  });

  const selectedWallet = wallets.find(w => w.id === selectedWalletId) || null;
  const filteredWallets = wallets.filter(w => w.user_email?.toLowerCase().includes(searchEmail.toLowerCase()));

  const updateWalletMutation = useMutation({
    mutationFn: ({ walletId, data }) => base44.functions.invoke('superadminAction', { action: 'updateWallet', walletId, data }),
    onSuccess: () => {
      toast.success('Wallet updated');
      setIdAmount(''); setIcAmount(''); setIsEditing(false);
      queryClient.invalidateQueries(['keyring-wallets']);
    },
    onError: () => toast.error('Failed to update wallet'),
  });

  const deleteWalletMutation = useMutation({
    mutationFn: (walletId) => base44.functions.invoke('superadminAction', { action: 'deleteWallet', walletId }),
    onSuccess: () => {
      toast.success('Wallet deleted');
      setSelectedWalletId(null);
      queryClient.invalidateQueries(['keyring-wallets']);
    },
  });

  const handleAdjust = (field, current, amount, op) => {
    if (!selectedWallet || !amount) return;
    const val = parseFloat(amount);
    if (isNaN(val)) return;
    const newVal = op === 'add' ? current + val : Math.max(0, current - val);
    updateWalletMutation.mutate({ walletId: selectedWallet.id, data: { [field]: newVal } });
  };

  const handleSaveEdits = () => {
    const data = {};
    ['tokens','cat_dollars','vip_level','experience_points','total_won','total_lost','purchase_count'].forEach(f => {
      if (editFields[f] !== undefined && editFields[f] !== '') data[f] = parseFloat(editFields[f]);
    });
    ['bonus_50_available','bonus_100_available','bonus_150_available'].forEach(f => {
      if (editFields[f] !== undefined) data[f] = editFields[f] === true || editFields[f] === 'true';
    });
    updateWalletMutation.mutate({ walletId: selectedWallet.id, data });
  };

  // --- SESSION DATA ---
  const { data: sessionData = [], isLoading: sessionLoading } = useQuery({
    queryKey: ['keyring-sessions'],
    queryFn: async () => {
      const res = await base44.functions.invoke('superadminAction', { action: 'getAllSessionData' });
      return res.data?.data || [];
    },
    enabled: unlocked && activeTab === 'Session Data',
  });

  const filteredSessions = sessionData.filter(s => s.email?.toLowerCase().includes(sessionSearch.toLowerCase()));

  const loadDetailedSession = async (email) => {
    const res = await base44.functions.invoke('superadminAction', { action: 'getSessionData', email });
    setSelectedSession(res.data?.data || null);
  };

  // --- KYC OVERRIDE ---
  const { data: allKYCUsers = [], isLoading: kycLoading } = useQuery({
    queryKey: ['keyring-kyc'],
    queryFn: async () => {
      const res = await base44.functions.invoke('adminGetKYCUsers', {});
      return res.data?.users || [];
    },
    enabled: unlocked && activeTab === 'KYC Override',
  });

  const kycOverrideMutation = useMutation({
    mutationFn: ({ userId, status, notes }) => base44.functions.invoke('superadminAction', { action: 'kycOverride', userId, status, notes }),
    onSuccess: () => {
      toast.success('KYC status overridden');
      setSelectedKYCUser(null); setKycNotes('');
      queryClient.invalidateQueries(['keyring-kyc']);
    },
    onError: () => toast.error('KYC override failed'),
  });

  const filteredKYCUsers = allKYCUsers.filter(u => u.email?.toLowerCase().includes(kycSearch.toLowerCase()) || u.full_name?.toLowerCase().includes(kycSearch.toLowerCase()));

  if (!user) return null;

  // --- LOCK SCREEN ---
  if (!unlocked) {
    return (
      <div className="min-h-screen bg-[#0A0612] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gradient-to-br from-[#1A1528] to-[#0F0A1E] border border-yellow-500/30 rounded-2xl p-8 w-full max-w-sm text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-yellow-500/20 border border-yellow-500/40 flex items-center justify-center mx-auto mb-6">
            <Key className="w-8 h-8 text-yellow-400" />
          </div>
          <h1 className="text-2xl font-black text-white mb-1">Owner Keyring</h1>
          <p className="text-gray-500 text-sm mb-8">Enter your PIN to access privileged controls</p>

          <div className="relative mb-4">
            <Input
              type={showPin ? 'text' : 'password'}
              value={pin}
              onChange={(e) => { setPin(e.target.value); setPinError(false); }}
              onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
              placeholder="Enter PIN"
              className={`bg-white/10 border-white/20 text-white text-center text-xl tracking-[0.5em] pr-10 ${pinError ? 'border-red-500' : ''}`}
              maxLength={20}
            />
            <button onClick={() => setShowPin(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {pinError && <p className="text-red-400 text-sm mb-4">Incorrect PIN</p>}

          <Button onClick={handleUnlock} className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-black font-bold">
            <Lock className="w-4 h-4 mr-2" /> Unlock
          </Button>
        </motion.div>
      </div>
    );
  }

  // --- MAIN KEYRING UI ---
  return (
    <div className="min-h-screen bg-[#0A0612] p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/20 border border-yellow-500/40 flex items-center justify-center">
              <Key className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">Owner Keyring</h1>
              <p className="text-xs text-yellow-400/70">Superadmin access — {user.email}</p>
            </div>
          </div>
          <Button onClick={() => setUnlocked(false)} variant="outline" size="sm" className="border-white/20 text-white">
            <Lock className="w-4 h-4 mr-2" /> Lock
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                activeTab === tab
                  ? 'bg-yellow-500 text-black'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/10'
              }`}
            >
              {tab === 'Wallets' && <Wallet className="w-4 h-4 inline mr-1.5" />}
              {tab === 'Session Data' && <Monitor className="w-4 h-4 inline mr-1.5" />}
              {tab === 'KYC Override' && <ShieldCheck className="w-4 h-4 inline mr-1.5" />}
              {tab}
            </button>
          ))}
        </div>

        {/* ===== WALLETS TAB ===== */}
        {activeTab === 'Wallets' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 bg-gradient-to-br from-[#1A1528] to-[#0F0A1E] border border-white/10 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Wallet className="w-4 h-4 text-yellow-400" />
                <h2 className="font-bold text-white">All Wallets</h2>
                <span className="ml-auto text-xs text-gray-500">{wallets.length}</span>
                <button onClick={() => queryClient.invalidateQueries(['keyring-wallets'])} className="text-gray-400 hover:text-white">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input value={searchEmail} onChange={e => setSearchEmail(e.target.value)} placeholder="Search email..." className="pl-9 bg-white/10 border-white/20 text-white placeholder-gray-500 text-sm" />
              </div>
              <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
                {walletsLoading && <p className="text-gray-500 text-sm text-center py-4">Loading...</p>}
                {filteredWallets.map(w => (
                  <div key={w.id} onClick={() => { setSelectedWalletId(w.id); setIsEditing(false); }}
                    className={`p-3 rounded-lg cursor-pointer transition-colors border ${selectedWallet?.id === w.id ? 'bg-yellow-500/10 border-yellow-500/50' : 'bg-white/5 hover:bg-white/10 border-transparent'}`}>
                    <p className="text-white text-xs font-semibold truncate">{w.user_email}</p>
                    <div className="flex gap-3 text-xs mt-1">
                      <span className="text-yellow-400">{(w.tokens||0).toLocaleString()} IC</span>
                      <span className="text-green-400">{(w.cat_dollars||0).toFixed(2)} ID</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-2">
              {selectedWallet ? (
                <div className="bg-gradient-to-br from-[#1A1528] to-[#0F0A1E] border border-white/10 rounded-2xl p-6 space-y-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-white font-bold">{selectedWallet.user_email}</p>
                      <p className="text-xs text-gray-500">ID: {selectedWallet.id}</p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {!isEditing ? (
                        <Button onClick={() => { setEditFields({ tokens: selectedWallet.tokens, cat_dollars: selectedWallet.cat_dollars, vip_level: selectedWallet.vip_level||1, experience_points: selectedWallet.experience_points||0, total_won: selectedWallet.total_won||0, total_lost: selectedWallet.total_lost||0, purchase_count: selectedWallet.purchase_count||0, bonus_50_available: selectedWallet.bonus_50_available??true, bonus_100_available: selectedWallet.bonus_100_available??true, bonus_150_available: selectedWallet.bonus_150_available??true }); setIsEditing(true); }} size="sm" className="bg-blue-600 hover:bg-blue-700">
                          <Edit3 className="w-3.5 h-3.5 mr-1" /> Edit Fields
                        </Button>
                      ) : (
                        <>
                          <Button onClick={handleSaveEdits} size="sm" className="bg-green-600 hover:bg-green-700" disabled={updateWalletMutation.isPending}><Save className="w-3.5 h-3.5 mr-1" /> Save</Button>
                          <Button onClick={() => setIsEditing(false)} size="sm" variant="outline" className="border-white/20 text-white"><X className="w-3.5 h-3.5 mr-1" /> Cancel</Button>
                        </>
                      )}
                      <Button onClick={() => { if(confirm(`Delete wallet for ${selectedWallet.user_email}?`)) deleteWalletMutation.mutate(selectedWallet.id); }} size="sm" className="bg-red-700 hover:bg-red-800" disabled={deleteWalletMutation.isPending}>
                        <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                      </Button>
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="bg-white/5 rounded-xl p-5 border border-blue-500/30">
                      <div className="grid grid-cols-2 gap-4">
                        {[{key:'tokens',label:'Imperial Coins (IC)'},{key:'cat_dollars',label:'Imperial Dollars (ID)'},{key:'vip_level',label:'VIP Level'},{key:'experience_points',label:'XP'},{key:'total_won',label:'Total Won'},{key:'total_lost',label:'Total Lost'},{key:'purchase_count',label:'Purchases'}].map(({key,label}) => (
                          <div key={key}>
                            <label className="text-xs text-gray-400 mb-1 block">{label}</label>
                            <Input type="number" value={editFields[key]??''} onChange={e => setEditFields(p=>({...p,[key]:e.target.value}))} className="bg-white/10 border-white/20 text-white" />
                          </div>
                        ))}
                        {[{key:'bonus_50_available',label:'50% Bonus'},{key:'bonus_100_available',label:'100% Bonus'},{key:'bonus_150_available',label:'150% Bonus'}].map(({key,label}) => (
                          <div key={key} className="flex items-center gap-3">
                            <input type="checkbox" id={key} checked={!!editFields[key]} onChange={e => setEditFields(p=>({...p,[key]:e.target.checked}))} className="w-4 h-4 accent-yellow-500" />
                            <label htmlFor={key} className="text-sm text-gray-300">{label}</label>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* IC */}
                      <div className="bg-white/5 rounded-xl p-4 border border-yellow-500/30">
                        <div className="flex items-center gap-2 mb-2"><Coins className="w-4 h-4 text-yellow-400" /><span className="text-white font-semibold text-sm">Imperial Coins</span></div>
                        <p className="text-2xl font-black text-yellow-400 mb-3">{(selectedWallet.tokens||0).toLocaleString()}</p>
                        <Input type="number" value={icAmount} onChange={e => setIcAmount(e.target.value)} placeholder="Amount..." className="bg-white/10 border-white/20 text-white mb-2 text-sm" />
                        <div className="grid grid-cols-2 gap-2">
                          <Button onClick={() => handleAdjust('tokens', selectedWallet.tokens, icAmount, 'add')} disabled={!icAmount} size="sm" className="bg-green-600 hover:bg-green-700"><Plus className="w-3 h-3 mr-1" />Add</Button>
                          <Button onClick={() => handleAdjust('tokens', selectedWallet.tokens, icAmount, 'sub')} disabled={!icAmount} size="sm" className="bg-red-600 hover:bg-red-700"><Minus className="w-3 h-3 mr-1" />Sub</Button>
                        </div>
                      </div>
                      {/* ID */}
                      <div className="bg-white/5 rounded-xl p-4 border border-green-500/30">
                        <div className="flex items-center gap-2 mb-2"><DollarSign className="w-4 h-4 text-green-400" /><span className="text-white font-semibold text-sm">Imperial Dollars</span></div>
                        <p className="text-2xl font-black text-green-400 mb-3">{(selectedWallet.cat_dollars||0).toFixed(2)}</p>
                        <Input type="number" value={idAmount} onChange={e => setIdAmount(e.target.value)} placeholder="Amount..." className="bg-white/10 border-white/20 text-white mb-2 text-sm" />
                        <div className="grid grid-cols-2 gap-2">
                          <Button onClick={() => handleAdjust('cat_dollars', selectedWallet.cat_dollars, idAmount, 'add')} disabled={!idAmount} size="sm" className="bg-green-600 hover:bg-green-700"><Plus className="w-3 h-3 mr-1" />Add</Button>
                          <Button onClick={() => handleAdjust('cat_dollars', selectedWallet.cat_dollars, idAmount, 'sub')} disabled={!idAmount} size="sm" className="bg-red-600 hover:bg-red-700"><Minus className="w-3 h-3 mr-1" />Sub</Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Danger */}
                  <div className="bg-red-900/10 rounded-xl p-4 border border-red-500/20">
                    <p className="text-red-400 font-bold text-xs mb-3 flex items-center gap-2"><AlertTriangle className="w-3.5 h-3.5" />Danger Zone</p>
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => { if(confirm('Reset to defaults?')) updateWalletMutation.mutate({ walletId: selectedWallet.id, data: { tokens: 1000, cat_dollars: 0, total_won:0, total_lost:0, experience_points:0, vip_level:1, purchase_count:0, bonus_50_available:true, bonus_100_available:true, bonus_150_available:true } }); }} size="sm" className="bg-yellow-700 hover:bg-yellow-800"><RefreshCw className="w-3 h-3 mr-1" />Reset</Button>
                      <Button onClick={() => { if(confirm('Zero out balance?')) updateWalletMutation.mutate({ walletId: selectedWallet.id, data: { tokens: 0, cat_dollars: 0 } }); }} size="sm" className="bg-orange-700 hover:bg-orange-800"><Minus className="w-3 h-3 mr-1" />Zero Balance</Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-gradient-to-br from-[#1A1528] to-[#0F0A1E] border border-white/10 rounded-2xl p-6 flex items-center justify-center min-h-[300px]">
                  <p className="text-gray-500">Select a wallet to manage</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== SESSION DATA TAB ===== */}
        {activeTab === 'Session Data' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 bg-gradient-to-br from-[#1A1528] to-[#0F0A1E] border border-white/10 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Monitor className="w-4 h-4 text-blue-400" />
                <h2 className="font-bold text-white">Player Sessions</h2>
                <span className="ml-auto text-xs text-gray-500">{sessionData.length}</span>
              </div>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input value={sessionSearch} onChange={e => setSessionSearch(e.target.value)} placeholder="Search email..." className="pl-9 bg-white/10 border-white/20 text-white placeholder-gray-500 text-sm" />
              </div>
              <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
                {sessionLoading && <p className="text-gray-500 text-sm text-center py-4">Loading...</p>}
                {filteredSessions.map(s => (
                  <div key={s.email} onClick={() => loadDetailedSession(s.email)}
                    className={`p-3 rounded-lg cursor-pointer transition-colors border ${selectedSession?.email === s.email ? 'bg-blue-500/10 border-blue-500/50' : 'bg-white/5 hover:bg-white/10 border-transparent'}`}>
                    <p className="text-white text-xs font-semibold truncate">{s.email}</p>
                    <div className="flex gap-2 text-xs mt-1 text-gray-400">
                      <MapPin className="w-3 h-3" />
                      <span className="truncate">{s.last_location || 'Unknown'}</span>
                    </div>
                    {s.last_seen_at && <p className="text-xs text-gray-600 mt-0.5">{new Date(s.last_seen_at).toLocaleString()}</p>}
                  </div>
                ))}
              </div>
            </div>
            <div className="lg:col-span-2">
              {selectedSession ? (
                <div className="bg-gradient-to-br from-[#1A1528] to-[#0F0A1E] border border-white/10 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center gap-3 mb-2">
                    <User className="w-5 h-5 text-blue-400" />
                    <div>
                      <p className="text-white font-bold">{selectedSession.full_name}</p>
                      <p className="text-gray-400 text-sm">{selectedSession.email}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { label: 'Last IP', value: selectedSession.last_ip, icon: Monitor },
                      { label: 'Last Location', value: selectedSession.last_location, icon: MapPin },
                      { label: 'Registration IP', value: selectedSession.registration_ip, icon: Monitor },
                      { label: 'Registration Location', value: selectedSession.registration_location, icon: MapPin },
                      { label: 'Last Seen', value: selectedSession.last_seen_at ? new Date(selectedSession.last_seen_at).toLocaleString() : null, icon: Clock },
                    ].map(({ label, value, icon: Icon }) => value ? (
                      <div key={label} className="bg-white/5 rounded-lg p-3">
                        <div className="flex items-center gap-1.5 mb-1"><Icon className="w-3.5 h-3.5 text-gray-400" /><span className="text-xs text-gray-400">{label}</span></div>
                        <p className="text-white text-sm font-mono">{value}</p>
                      </div>
                    ) : null)}
                  </div>
                  {selectedSession.last_user_agent && (
                    <div className="bg-white/5 rounded-lg p-3">
                      <p className="text-xs text-gray-400 mb-1">User Agent</p>
                      <p className="text-xs text-gray-300 font-mono break-all">{selectedSession.last_user_agent}</p>
                    </div>
                  )}
                  {selectedSession.ip_history?.length > 0 && (
                    <div className="bg-white/5 rounded-xl p-4">
                      <p className="text-white font-semibold text-sm mb-3">IP History ({selectedSession.ip_history.length})</p>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {[...selectedSession.ip_history].reverse().map((entry, i) => (
                          <div key={i} className="flex items-center gap-3 text-xs bg-black/20 rounded px-3 py-2">
                            <span className="font-mono text-yellow-400">{entry.ip}</span>
                            <span className="text-gray-400">{entry.location}</span>
                            <span className="text-gray-600 ml-auto">{entry.ts ? new Date(entry.ts).toLocaleDateString() : ''}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-gradient-to-br from-[#1A1528] to-[#0F0A1E] border border-white/10 rounded-2xl p-6 flex items-center justify-center min-h-[300px]">
                  <p className="text-gray-500">Select a player to view session data</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== KYC OVERRIDE TAB ===== */}
        {activeTab === 'KYC Override' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 bg-gradient-to-br from-[#1A1528] to-[#0F0A1E] border border-white/10 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <ShieldCheck className="w-4 h-4 text-green-400" />
                <h2 className="font-bold text-white">KYC Override</h2>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-4">
                <p className="text-yellow-400 text-xs font-semibold flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" />Override: bypasses normal criteria</p>
              </div>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input value={kycSearch} onChange={e => setKycSearch(e.target.value)} placeholder="Search..." className="pl-9 bg-white/10 border-white/20 text-white placeholder-gray-500 text-sm" />
              </div>
              <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
                {kycLoading && <p className="text-gray-500 text-sm text-center py-4">Loading...</p>}
                {filteredKYCUsers.map(u => (
                  <div key={u.id} onClick={() => { setSelectedKYCUser(u); setKycNotes(u.kyc_notes||''); }}
                    className={`p-3 rounded-lg cursor-pointer transition-colors border ${selectedKYCUser?.id === u.id ? 'bg-green-500/10 border-green-500/50' : 'bg-white/5 hover:bg-white/10 border-transparent'}`}>
                    <p className="text-white text-xs font-semibold truncate">{u.full_name || u.email}</p>
                    <p className="text-gray-500 text-xs truncate">{u.email}</p>
                    <span className={`text-xs mt-1 inline-block px-2 py-0.5 rounded-full ${u.kyc_status === 'approved' ? 'bg-green-500/20 text-green-400' : u.kyc_status === 'submitted' ? 'bg-yellow-500/20 text-yellow-400' : u.kyc_status === 'rejected' ? 'bg-red-500/20 text-red-400' : 'bg-gray-500/20 text-gray-400'}`}>
                      {u.kyc_status || 'pending'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="lg:col-span-2">
              {selectedKYCUser ? (
                <div className="bg-gradient-to-br from-[#1A1528] to-[#0F0A1E] border border-white/10 rounded-2xl p-6 space-y-5">
                  <div>
                    <p className="text-white font-bold text-lg">{selectedKYCUser.full_name}</p>
                    <p className="text-gray-400 text-sm">{selectedKYCUser.email}</p>
                    <p className="text-xs text-gray-500 mt-1">Current status: <span className="text-yellow-400">{selectedKYCUser.kyc_status || 'pending'}</span></p>
                  </div>

                  {selectedKYCUser.kyc_selfie_url && (
                    <div>
                      <label className="text-xs text-gray-400 block mb-2">Liveness Video</label>
                      <video src={selectedKYCUser.kyc_selfie_url} controls className="w-full rounded-lg border border-white/10 max-h-48 object-contain" />
                    </div>
                  )}
                  {selectedKYCUser.kyc_id_url && (
                    <div>
                      <label className="text-xs text-gray-400 block mb-2">ID Document</label>
                      <img src={selectedKYCUser.kyc_id_url} alt="ID" className="w-full rounded-lg border border-white/10" />
                    </div>
                  )}

                  <div>
                    <label className="text-xs text-gray-400 block mb-2">Override Notes</label>
                    <Textarea value={kycNotes} onChange={e => setKycNotes(e.target.value)} placeholder="Reason for override..." rows={3} className="bg-white/10 border-white/20 text-white" />
                  </div>

                  <div className="flex gap-3">
                    <Button onClick={() => kycOverrideMutation.mutate({ userId: selectedKYCUser.id, status: 'rejected', notes: kycNotes })} disabled={kycOverrideMutation.isPending} variant="outline" className="flex-1 border-red-500 text-red-400 hover:bg-red-500/10">
                      <XCircle className="w-4 h-4 mr-2" /> Force Reject
                    </Button>
                    <Button onClick={() => kycOverrideMutation.mutate({ userId: selectedKYCUser.id, status: 'approved', notes: kycNotes })} disabled={kycOverrideMutation.isPending} className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700">
                      <CheckCircle2 className="w-4 h-4 mr-2" /> Force Approve
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="bg-gradient-to-br from-[#1A1528] to-[#0F0A1E] border border-white/10 rounded-2xl p-6 flex items-center justify-center min-h-[300px]">
                  <p className="text-gray-500">Select a user to override KYC</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}