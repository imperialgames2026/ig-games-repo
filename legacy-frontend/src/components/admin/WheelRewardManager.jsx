import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Trash2, Plus, Edit2 } from 'lucide-react';

const TIERS = [
  { key: 'luck', name: 'Luck Win 🍀', color: 'text-green-400' },
  { key: 'super', name: 'Super Win ⭐', color: 'text-amber-400' },
  { key: 'mega', name: 'Mega Win 👑', color: 'text-purple-400' },
];

const REWARD_TYPES = ['IC', 'ID', 'xp_boost', 'free_spin', 'other'];

const emptySlot = { tier: 'luck', slot_number: 1, label: '', reward_type: 'ID', ic_amount: 0, id_amount: 0, free_spin_count: 1, free_spin_game: 'wheel', free_spin_bet_amount: 0, color: '#16a34a', weight: 10, is_jackpot: false, is_active: true };

export default function WheelRewardManager() {
  const queryClient = useQueryClient();
  const [activeTier, setActiveTier] = useState('luck');
  const [editSlot, setEditSlot] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState(emptySlot);

  const { data: rewards = [] } = useQuery({
    queryKey: ['wheel-rewards-admin'],
    queryFn: () => base44.entities.WheelReward.list(),
  });

  const { data: configs = [] } = useQuery({
    queryKey: ['wheel-config-admin'],
    queryFn: () => base44.entities.WheelConfig.list(),
  });

  const globalSpinCount = configs.find(c => c.key === 'global_spin_count')?.value || 0;

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.WheelReward.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['wheel-rewards-admin'] }); queryClient.invalidateQueries({ queryKey: ['wheel-rewards'] }); setShowDialog(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.WheelReward.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['wheel-rewards-admin'] }); queryClient.invalidateQueries({ queryKey: ['wheel-rewards'] }); setShowDialog(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.WheelReward.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['wheel-rewards-admin'] }); queryClient.invalidateQueries({ queryKey: ['wheel-rewards'] }); },
  });

  const tierRewards = rewards.filter(r => r.tier === activeTier).sort((a, b) => a.slot_number - b.slot_number);

  const openNew = () => {
    setEditSlot(null);
    setForm({ ...emptySlot, tier: activeTier, slot_number: tierRewards.length + 1 });
    setShowDialog(true);
  };

  const openEdit = (slot) => {
    setEditSlot(slot);
    setForm({ ...slot });
    setShowDialog(true);
  };

  const handleSave = () => {
    const data = {
      ...form,
      slot_number: parseInt(form.slot_number) || 1,
      ic_amount: parseFloat(form.ic_amount) || 0,
      id_amount: parseFloat(form.id_amount) || 0,
      weight: parseInt(form.weight) || 10,
      free_spin_count: parseInt(form.free_spin_count) || 1,
      free_spin_bet_amount: parseFloat(form.free_spin_bet_amount) || 0,
    };
    if (editSlot) {
      updateMutation.mutate({ id: editSlot.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white">Lucky Spin Wheel Prizes</h3>
        <div className="text-xs text-gray-400">Global Spins: <span className="text-white font-bold">{globalSpinCount.toLocaleString()}</span> / 500,000</div>
      </div>

      {/* Tier tabs */}
      <div className="flex gap-2 mb-4">
        {TIERS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTier(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTier === t.key ? 'bg-white/20 ' + t.color : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
          >
            {t.name}
          </button>
        ))}
      </div>

      <div className="text-xs text-gray-500 mb-3">
        Tip: Higher <strong>weight</strong> = more likely to land on. Jackpot slots have weight 0 and only trigger on spin #500,000.
      </div>

      {/* Slot list */}
      <div className="space-y-2 mb-4">
        {tierRewards.map((slot) => (
          <div key={slot.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10">
            <div className="w-6 h-6 rounded-full flex-shrink-0" style={{ background: slot.color }} />
            <div className="flex-1">
              <div className="text-white font-bold text-sm">{slot.label}</div>
              <div className="text-gray-400 text-xs">
                Slot #{slot.slot_number} • {slot.reward_type} • Weight: {slot.weight}
                {slot.is_jackpot && <span className="ml-2 text-yellow-400 font-bold">⚡ JACKPOT</span>}
                {!slot.is_active && <span className="ml-2 text-red-400">Inactive</span>}
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="icon" variant="ghost" className="text-gray-400 hover:text-white h-8 w-8" onClick={() => openEdit(slot)}>
                <Edit2 className="w-3.5 h-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="text-red-400 hover:text-red-300 h-8 w-8" onClick={() => deleteMutation.mutate(slot.id)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}

        {tierRewards.length === 0 && (
          <div className="text-center py-6 text-gray-500 text-sm">
            No custom slots yet — using defaults. Add slots to override.
          </div>
        )}
      </div>

      <Button onClick={openNew} className="w-full bg-white/10 hover:bg-white/20 text-white border border-white/20">
        <Plus className="w-4 h-4 mr-2" />
        Add Slot to {TIERS.find(t => t.key === activeTier)?.name}
      </Button>

      {/* Edit/Create Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-[#1A1528] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>{editSlot ? 'Edit Slot' : 'Add New Slot'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Tier</label>
                <Select value={form.tier} onValueChange={v => setForm({ ...form, tier: v })}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1A1528] border-white/10 text-white">
                    {TIERS.map(t => <SelectItem key={t.key} value={t.key}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Slot #</label>
                <Input type="number" value={form.slot_number} onChange={e => setForm({ ...form, slot_number: e.target.value })} className="bg-white/5 border-white/10 text-white" />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1 block">Display Label</label>
              <Input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="e.g. 500 ID" className="bg-white/5 border-white/10 text-white" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Reward Type</label>
                <Select value={form.reward_type} onValueChange={v => setForm({ ...form, reward_type: v })}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1A1528] border-white/10 text-white">
                    {REWARD_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Color</label>
                <div className="flex gap-2">
                  <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} className="w-10 h-9 rounded cursor-pointer border-0 bg-transparent" />
                  <Input value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} className="bg-white/5 border-white/10 text-white" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">IC Amount</label>
                <Input type="number" value={form.ic_amount} onChange={e => setForm({ ...form, ic_amount: e.target.value })} className="bg-white/5 border-white/10 text-white" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">ID Amount</label>
                <Input type="number" value={form.id_amount} onChange={e => setForm({ ...form, id_amount: e.target.value })} className="bg-white/5 border-white/10 text-white" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Weight</label>
                <Input type="number" value={form.weight} onChange={e => setForm({ ...form, weight: e.target.value })} className="bg-white/5 border-white/10 text-white" />
              </div>
            </div>

            {/* Free Spin fields — only shown when reward_type is free_spin */}
            {form.reward_type === 'free_spin' && (
              <div className="border border-pink-500/30 rounded-lg p-3 space-y-3 bg-pink-500/5">
                <div className="text-xs text-pink-400 font-bold">Free Spin Settings</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Number of Spins</label>
                    <Input type="number" value={form.free_spin_count} onChange={e => setForm({ ...form, free_spin_count: e.target.value })} className="bg-white/5 border-white/10 text-white" min={1} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Bet Amount Per Spin</label>
                    <Input type="number" value={form.free_spin_bet_amount} onChange={e => setForm({ ...form, free_spin_bet_amount: e.target.value })} className="bg-white/5 border-white/10 text-white" min={0} />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Game</label>
                  <Select value={form.free_spin_game || 'wheel'} onValueChange={v => setForm({ ...form, free_spin_game: v })}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1A1528] border-white/10 text-white">
                      <SelectItem value="wheel">Wheel</SelectItem>
                      <SelectItem value="slots">Slots</SelectItem>
                      <SelectItem value="dice">Dice</SelectItem>
                      <SelectItem value="mines">Mines</SelectItem>
                      <SelectItem value="plinko">Plinko</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_jackpot} onChange={e => setForm({ ...form, is_jackpot: e.target.checked })} className="w-4 h-4" />
                <span className="text-sm text-yellow-400">Jackpot Slot (500k spin)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="w-4 h-4" />
                <span className="text-sm text-gray-300">Active</span>
              </label>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowDialog(false)} className="flex-1 border-white/20 text-white hover:bg-white/10">Cancel</Button>
              <Button onClick={handleSave} className="flex-1 bg-pink-500 hover:bg-pink-600 text-white">
                {editSlot ? 'Update Slot' : 'Add Slot'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}