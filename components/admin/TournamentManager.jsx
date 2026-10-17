import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Save, PlusCircle, Minus } from 'lucide-react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const DEFAULT_BLIND_LEVELS = [
  { level: 1, small_blind: 25, big_blind: 50, ante: 0, duration_minutes: 10 },
  { level: 2, small_blind: 50, big_blind: 100, ante: 0, duration_minutes: 10 },
  { level: 3, small_blind: 75, big_blind: 150, ante: 0, duration_minutes: 10 },
  { level: 4, small_blind: 100, big_blind: 200, ante: 25, duration_minutes: 10 },
  { level: 5, small_blind: 150, big_blind: 300, ante: 25, duration_minutes: 10 },
];

const MAX_PAYOUT_SPOTS = 18;

const DEFAULT_FORM = {
  name: '',
  tournament_type: 'freeroll',
  buyin_id: 0,
  starts_at: '',
  max_players: 100,
  starting_stack: 5000,
  prize_pool_description: '',
  prize_voucher_code: '',
  description: '',
  blind_levels: DEFAULT_BLIND_LEVELS,
  status: 'upcoming',
  is_recurring: false,
  recurrence_rule: '',
  in_the_money_spots: 0,
  prize_pool_total: 0,
  prize_payouts: Array.from({ length: MAX_PAYOUT_SPOTS }, (_, i) => ({ position: i + 1, amount: 0, currency: 'ID', voucher_code: '' })),
  bounty_amount: 0.25,
  satellite_tickets_awarded: 1
};

export default function TournamentManager() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(DEFAULT_FORM);

  const { data: tournaments = [], refetch } = useQuery({
    queryKey: ['admin-tournaments'],
    queryFn: () => base44.entities.PokerTournament.list('-starts_at')
  });

  const openCreate = () => {
    setEditing(null);
    setForm(DEFAULT_FORM);
    setDialogOpen(true);
  };

  const openEdit = (t) => {
    setEditing(t);
    setForm({
      name: t.name,
      tournament_type: t.tournament_type,
      buyin_id: t.buyin_id || 0,
      starts_at: t.starts_at ? new Date(t.starts_at).toISOString().slice(0, 16) : '',
      max_players: t.max_players || 100,
      starting_stack: t.starting_stack || 5000,
      prize_pool_description: t.prize_pool_description || '',
      prize_voucher_code: t.prize_voucher_code || '',
      description: t.description || '',
      blind_levels: t.blind_levels || DEFAULT_BLIND_LEVELS,
      status: t.status,
      is_recurring: t.is_recurring || false,
      recurrence_rule: t.recurrence_rule || '',
      in_the_money_spots: t.in_the_money_spots || 0,
      prize_pool_total: t.prize_pool_total || 0,
      prize_payouts: (() => {
        const existing = t.prize_payouts || [];
        return Array.from({ length: MAX_PAYOUT_SPOTS }, (_, i) => existing[i] || { position: i + 1, amount: 0, currency: 'ID', voucher_code: '' });
      })(),
      bounty_amount: t.bounty_amount ?? 0.25,
      satellite_tickets_awarded: t.satellite_tickets_awarded || 1
    });
    setDialogOpen(true);
  };

  const save = async () => {
    const data = { ...form, starts_at: new Date(form.starts_at).toISOString() };
    if (editing) {
      await base44.entities.PokerTournament.update(editing.id, data);
    } else {
      await base44.entities.PokerTournament.create({ ...data, registered_count: 0, current_level: 1 });
    }
    setDialogOpen(false);
    refetch();
  };

  const changeStatus = async (t, status) => {
    await base44.entities.PokerTournament.update(t.id, { status });
    refetch();
  };

  const deleteTournament = async (t) => {
    if (!confirm(`Delete "${t.name}"?`)) return;
    await base44.entities.PokerTournament.delete(t.id);
    refetch();
  };

  const f = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.type === 'number' ? parseFloat(e.target.value) : e.target.value }));

  const updateBlindLevel = (idx, field, value) => {
    setForm(prev => ({
      ...prev,
      blind_levels: prev.blind_levels.map((l, i) =>
        i === idx ? { ...l, [field]: parseFloat(value) || 0 } : l
      )
    }));
  };

  const addBlindLevel = () => {
    const last = form.blind_levels[form.blind_levels.length - 1];
    setForm(prev => ({
      ...prev,
      blind_levels: [...prev.blind_levels, {
        level: (last?.level || 0) + 1,
        small_blind: (last?.big_blind || 100),
        big_blind: (last?.big_blind || 100) * 2,
        ante: last?.ante || 0,
        duration_minutes: last?.duration_minutes || 10
      }]
    }));
  };

  const removeBlindLevel = (idx) => {
    setForm(prev => ({
      ...prev,
      blind_levels: prev.blind_levels.filter((_, i) => i !== idx).map((l, i) => ({ ...l, level: i + 1 }))
    }));
  };

  const statusColors = {
    upcoming: 'bg-gray-500/20 text-gray-400',
    registration_open: 'bg-green-500/20 text-green-400',
    running: 'bg-yellow-500/20 text-yellow-400',
    finished: 'bg-blue-500/20 text-blue-400',
    cancelled: 'bg-red-500/20 text-red-400'
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-bold text-lg">Tournaments & MTT</h2>
        <Button onClick={openCreate} className="bg-pink-500 hover:bg-pink-600 gap-2">
          <Plus className="w-4 h-4" /> New Tournament
        </Button>
      </div>

      <div className="space-y-3">
        {tournaments.map(t => (
          <div key={t.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white font-semibold">{t.name}</span>
                  <Badge className={`text-xs capitalize ${t.tournament_type === 'freeroll' ? 'bg-green-500/20 text-green-400' : 'bg-purple-500/20 text-purple-400'}`}>
                    {t.tournament_type}
                  </Badge>
                  <Badge className={`text-xs ${statusColors[t.status]}`}>{t.status.replace('_', ' ')}</Badge>
                </div>
                <div className="text-gray-400 text-sm mt-1">
                  {t.starts_at && <span>{format(new Date(t.starts_at), 'MMM d, h:mm a')}</span>}
                  &nbsp;·&nbsp; Buy-in: <span className="text-pink-400">{t.buyin_id || 0} ID</span>
                  &nbsp;·&nbsp; Registered: <span className="text-white">{t.registered_count || 0}</span>
                  {t.max_players && <span className="text-gray-500">/{t.max_players}</span>}
                  {t.prize_pool_total > 0 && <>&nbsp;·&nbsp; Prize Pool: <span className="text-yellow-400">{t.prize_pool_total.toLocaleString()} ID</span></>}
                  {t.in_the_money_spots > 0 && <>&nbsp;·&nbsp; ITM: <span className="text-green-400">Top {t.in_the_money_spots}</span></>}
                </div>
                {/* Quick status controls */}
                <div className="flex gap-2 mt-2 flex-wrap">
                  {['upcoming', 'registration_open', 'running', 'finished', 'cancelled'].map(s => (
                    <button
                      key={s}
                      onClick={() => changeStatus(t, s)}
                      className={`text-xs px-2 py-1 rounded transition-all ${
                        t.status === s
                          ? 'bg-pink-500 text-white'
                          : 'bg-white/5 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      {s.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <Button size="icon" variant="ghost" onClick={() => openEdit(t)} className="text-gray-400 hover:text-white">
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => deleteTournament(t)} className="text-gray-400 hover:text-red-400">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
        {tournaments.length === 0 && (
          <p className="text-gray-500 text-center py-8">No tournaments yet. Create one above.</p>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-[#1A1030] border-white/10 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Tournament' : 'Create Tournament'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-gray-300">Tournament Name</Label>
                <Input value={form.name} onChange={f('name')} placeholder="e.g. Daily Freeroll" className="bg-white/5 border-white/10 text-white mt-1" />
              </div>
              <div>
                <Label className="text-gray-300">Type</Label>
                <Select value={form.tournament_type} onValueChange={v => setForm(p => ({ ...p, tournament_type: v, buyin_id: v === 'freeroll' ? 0 : p.buyin_id }))}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1A1030] border-white/10 text-white">
                    <SelectItem value="freeroll">Freeroll</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="special">Special</SelectItem>
                    <SelectItem value="apex">Apex</SelectItem>
                    <SelectItem value="satellite">Satellite</SelectItem>
                    <SelectItem value="bounty">Bounty (PKO)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-gray-300">Buy-in (ID) {form.tournament_type === 'freeroll' ? '(0 = free)' : ''}</Label>
                <Input type="number" value={form.buyin_id} onChange={f('buyin_id')} disabled={form.tournament_type === 'freeroll'} className="bg-white/5 border-white/10 text-white mt-1 disabled:opacity-40" />
              </div>
              <div>
                <Label className="text-gray-300">Start Time</Label>
                <Input type="datetime-local" value={form.starts_at} onChange={f('starts_at')} className="bg-white/5 border-white/10 text-white mt-1" />
              </div>
              <div>
                <Label className="text-gray-300">Max Players</Label>
                <Input type="number" value={form.max_players} onChange={f('max_players')} className="bg-white/5 border-white/10 text-white mt-1" />
              </div>
              <div>
                <Label className="text-gray-300">Starting Stack</Label>
                <Input type="number" value={form.starting_stack} onChange={f('starting_stack')} className="bg-white/5 border-white/10 text-white mt-1" />
              </div>
              <div>
                <Label className="text-gray-300">ITM Spots (In The Money)</Label>
                <Input type="number" value={form.in_the_money_spots} onChange={f('in_the_money_spots')} placeholder="e.g. 3" className="bg-white/5 border-white/10 text-white mt-1" />
              </div>
              <div>
                <Label className="text-gray-300">Total Prize Pool (ID)</Label>
                <Input type="number" value={form.prize_pool_total} onChange={f('prize_pool_total')} placeholder="e.g. 10000" className="bg-white/5 border-white/10 text-white mt-1" />
              </div>
            </div>

            {/* Bounty Settings */}
            {form.tournament_type === 'bounty' && (
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4 space-y-3">
                <div className="text-orange-400 font-bold text-sm">💥 Progressive Knockout (PKO) Settings</div>
                <div>
                  <Label className="text-gray-300">Base Bounty Per Player (ID)</Label>
                  <Input type="number" step="0.01" value={form.bounty_amount} onChange={f('bounty_amount')} className="bg-white/5 border-white/10 text-white mt-1" />
                  <p className="text-gray-500 text-xs mt-1">Each player starts with this bounty on their head. When you knock someone out, you collect their full bounty. Your own bounty grows each time YOU knock someone out — so the more kills you rack up, the bigger your head gets.</p>
                </div>
              </div>
            )}

            {/* Satellite Settings */}
            {form.tournament_type === 'satellite' && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 space-y-3">
                <div className="text-blue-400 font-bold text-sm">🛰️ Satellite Settings</div>
                <div>
                  <Label className="text-gray-300">Tickets Awarded to Top Finishers</Label>
                  <Input type="number" value={form.satellite_tickets_awarded} onChange={f('satellite_tickets_awarded')} className="bg-white/5 border-white/10 text-white mt-1" />
                </div>
              </div>
            )}

            {/* Prize Info */}
            <div>
              <Label className="text-gray-300">Prize Description</Label>
              <Input value={form.prize_pool_description} onChange={f('prize_pool_description')} placeholder="e.g. 1st: Sunday Ticket, 2nd: 500 IC" className="bg-white/5 border-white/10 text-white mt-1" />
            </div>
            {form.tournament_type === 'freeroll' && (
              <div>
                <Label className="text-gray-300">Winner Voucher Code (optional)</Label>
                <Input value={form.prize_voucher_code} onChange={f('prize_voucher_code')} placeholder="e.g. SUNDAY_TICKET" className="bg-white/5 border-white/10 text-white mt-1" />
              </div>
            )}

            {/* Prize Payouts */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-gray-300 text-base">Prize Payouts by Position</Label>
                <span className="text-gray-500 text-xs">Leave 0 for unpaid spots</span>
              </div>
              <div className="bg-white/5 rounded-lg overflow-hidden">
                <div className="grid grid-cols-4 text-xs text-gray-500 px-3 py-2 border-b border-white/5">
                  <span>Position</span>
                  <span>Amount</span>
                  <span>Currency</span>
                  <span>Ticket Voucher</span>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {form.prize_payouts.map((payout, idx) => (
                    <div key={idx} className={`grid grid-cols-4 gap-2 px-3 py-1.5 items-center border-t border-white/5 ${payout.amount > 0 ? 'bg-yellow-500/5' : ''}`}>
                      <span className={`text-sm font-bold ${idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-gray-300' : idx === 2 ? 'text-orange-400' : 'text-gray-500'}`}>
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                      </span>
                      <Input
                        type="number"
                        min="0"
                        value={payout.amount}
                        onChange={e => setForm(prev => ({
                          ...prev,
                          prize_payouts: prev.prize_payouts.map((p, i) => i === idx ? { ...p, amount: parseFloat(e.target.value) || 0 } : p)
                        }))}
                        className="bg-white/5 border-white/10 text-white h-8 text-xs px-2"
                      />
                      <Select
                        value={payout.currency}
                        onValueChange={v => setForm(prev => ({
                          ...prev,
                          prize_payouts: prev.prize_payouts.map((p, i) => i === idx ? { ...p, currency: v } : p)
                        }))}
                      >
                        <SelectTrigger className="bg-white/5 border-white/10 text-white h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#1A1030] border-white/10 text-white">
                          <SelectItem value="ID">ID (Imperial Dollars)</SelectItem>
                          <SelectItem value="IC">IC (Imperial Coins)</SelectItem>
                          <SelectItem value="ticket">Tournament Ticket</SelectItem>
                        </SelectContent>
                      </Select>
                      {idx < 3 ? (
                        <Input
                          placeholder="Voucher code"
                          value={payout.voucher_code || ''}
                          onChange={e => setForm(prev => ({
                            ...prev,
                            prize_payouts: prev.prize_payouts.map((p, i) => i === idx ? { ...p, voucher_code: e.target.value } : p)
                          }))}
                          className="bg-white/5 border-white/10 text-white h-8 text-xs px-2"
                        />
                      ) : (
                        <span className="text-gray-600 text-xs">—</span>
                      )}
                    </div>
                  ))}
                </div>
                {form.prize_payouts.some(p => p.amount > 0) && (
                  <div className="px-3 py-2 border-t border-white/10 text-xs text-gray-400 flex justify-between">
                    <span>Paid spots: <span className="text-green-400 font-bold">{form.prize_payouts.filter(p => p.amount > 0).length}</span></span>
                    <span>Total ID out: <span className="text-yellow-400 font-bold">{form.prize_payouts.filter(p => p.currency === 'ID').reduce((s, p) => s + p.amount, 0).toLocaleString()}</span></span>
                  </div>
                )}
              </div>
            </div>

            {/* Blind Structure */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-gray-300 text-base">Blind Level Structure</Label>
                <Button size="sm" variant="ghost" onClick={addBlindLevel} className="text-pink-400 hover:text-pink-300 gap-1">
                  <PlusCircle className="w-4 h-4" /> Add Level
                </Button>
              </div>
              <div className="bg-white/5 rounded-lg overflow-hidden">
                <div className="grid grid-cols-6 gap-px bg-white/5 text-xs text-gray-500 px-3 py-2">
                  <span>Level</span>
                  <span>SB</span>
                  <span>BB</span>
                  <span>Ante</span>
                  <span>Min</span>
                  <span></span>
                </div>
                {form.blind_levels.map((level, idx) => (
                  <div key={idx} className="grid grid-cols-6 gap-1 px-3 py-2 border-t border-white/5 items-center">
                    <span className="text-gray-400 text-sm font-bold">L{level.level}</span>
                    <Input type="number" value={level.small_blind} onChange={e => updateBlindLevel(idx, 'small_blind', e.target.value)} className="bg-white/5 border-white/10 text-white h-8 text-xs px-2" />
                    <Input type="number" value={level.big_blind} onChange={e => updateBlindLevel(idx, 'big_blind', e.target.value)} className="bg-white/5 border-white/10 text-white h-8 text-xs px-2" />
                    <Input type="number" value={level.ante} onChange={e => updateBlindLevel(idx, 'ante', e.target.value)} className="bg-white/5 border-white/10 text-white h-8 text-xs px-2" />
                    <Input type="number" value={level.duration_minutes} onChange={e => updateBlindLevel(idx, 'duration_minutes', e.target.value)} className="bg-white/5 border-white/10 text-white h-8 text-xs px-2" />
                    <Button size="icon" variant="ghost" onClick={() => removeBlindLevel(idx)} className="h-8 w-8 text-red-400 hover:text-red-300">
                      <Minus className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setDialogOpen(false)} className="text-gray-400">Cancel</Button>
              <Button onClick={save} className="bg-pink-500 hover:bg-pink-600">
                <Save className="w-4 h-4 mr-2" /> {editing ? 'Save Changes' : 'Create Tournament'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}