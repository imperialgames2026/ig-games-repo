import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Trophy, Edit, CheckCircle, Clock, Zap, Users } from 'lucide-react';
import { toast } from 'sonner';

function TournamentForm({ tournament, onSave, onClose }) {
  const now = new Date();
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + ((8 - now.getDay()) % 7 || 7));
  nextMonday.setHours(0, 0, 0, 0);
  const nextSunday = new Date(nextMonday);
  nextSunday.setDate(nextMonday.getDate() + 6);
  nextSunday.setHours(23, 59, 59, 0);

  const toLocal = (iso) => {
    if (!iso) return '';
    return new Date(iso).toISOString().slice(0, 16);
  };

  const [form, setForm] = useState(tournament || {
    name: `Weekly Wager War`,
    status: 'upcoming',
    starts_at: nextMonday.toISOString(),
    ends_at: nextSunday.toISOString(),
    prize_type: 'IC',
    first_place_ic: 50000,
    first_place_id: 0,
    second_place_ic: 25000,
    second_place_id: 0,
    third_place_ic: 10000,
    third_place_id: 0,
    prize_voucher_code: '',
    description: 'Wager the most this week to win big prizes! All games count.',
    min_wager_to_qualify: 0,
    auto_renew: true,
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-2">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-1">
          <Label>Tournament Name</Label>
          <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Weekly Wager War" className="bg-white/5 border-white/10 text-white" />
        </div>
        <div className="space-y-1">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={v => set('status', v)}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="upcoming">Upcoming</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Prize Type</Label>
          <Select value={form.prize_type} onValueChange={v => set('prize_type', v)}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="IC">Imperial Coins (IC)</SelectItem>
              <SelectItem value="ID">Imperial Dollars (ID)</SelectItem>
              <SelectItem value="both">Both IC + ID</SelectItem>
              <SelectItem value="voucher">Voucher Code</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Starts At</Label>
          <Input type="datetime-local" value={toLocal(form.starts_at)} onChange={e => set('starts_at', new Date(e.target.value).toISOString())} className="bg-white/5 border-white/10 text-white" />
        </div>
        <div className="space-y-1">
          <Label>Ends At</Label>
          <Input type="datetime-local" value={toLocal(form.ends_at)} onChange={e => set('ends_at', new Date(e.target.value).toISOString())} className="bg-white/5 border-white/10 text-white" />
        </div>
      </div>

      {/* Prize Configuration */}
      <div className="border border-white/10 rounded-xl p-4 space-y-3">
        <p className="text-sm font-bold text-yellow-400 flex items-center gap-2"><Trophy className="w-4 h-4" /> Prize Configuration</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-yellow-300">🥇 1st Place IC</Label>
            <Input type="number" value={form.first_place_ic} onChange={e => set('first_place_ic', +e.target.value)} className="bg-white/5 border-white/10 text-white" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-yellow-300">🥇 1st Place ID</Label>
            <Input type="number" value={form.first_place_id} onChange={e => set('first_place_id', +e.target.value)} className="bg-white/5 border-white/10 text-white" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-gray-300">🥈 2nd Place IC</Label>
            <Input type="number" value={form.second_place_ic} onChange={e => set('second_place_ic', +e.target.value)} className="bg-white/5 border-white/10 text-white" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-gray-300">🥈 2nd Place ID</Label>
            <Input type="number" value={form.second_place_id} onChange={e => set('second_place_id', +e.target.value)} className="bg-white/5 border-white/10 text-white" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-amber-700">🥉 3rd Place IC</Label>
            <Input type="number" value={form.third_place_ic} onChange={e => set('third_place_ic', +e.target.value)} className="bg-white/5 border-white/10 text-white" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-amber-700">🥉 3rd Place ID</Label>
            <Input type="number" value={form.third_place_id} onChange={e => set('third_place_id', +e.target.value)} className="bg-white/5 border-white/10 text-white" />
          </div>
        </div>
        {(form.prize_type === 'voucher') && (
          <div className="space-y-1">
            <Label className="text-xs text-purple-300">Voucher Code (winner gets this)</Label>
            <Input value={form.prize_voucher_code} onChange={e => set('prize_voucher_code', e.target.value)} placeholder="e.g. WINNER2024" className="bg-white/5 border-white/10 text-white" />
          </div>
        )}
      </div>

      <div className="space-y-1">
        <Label>Description / Rules</Label>
        <Input value={form.description} onChange={e => set('description', e.target.value)} placeholder="Wager the most to win..." className="bg-white/5 border-white/10 text-white" />
      </div>

      <div className="space-y-1">
        <Label>Min Wager to Qualify (0 = no minimum)</Label>
        <Input type="number" value={form.min_wager_to_qualify} onChange={e => set('min_wager_to_qualify', +e.target.value)} className="bg-white/5 border-white/10 text-white" />
      </div>

      <div className="flex items-center gap-2">
        <Switch checked={form.auto_renew} onCheckedChange={v => set('auto_renew', v)} />
        <Label>Auto-create next week's tournament when this one ends</Label>
      </div>

      <div className="flex gap-2 pt-2">
        <Button onClick={() => onSave(form)} className="flex-1 bg-gradient-to-r from-pink-500 to-pink-600">
          <Trophy className="w-4 h-4 mr-2" />
          {tournament ? 'Update Tournament' : 'Create Tournament'}
        </Button>
        <Button variant="outline" onClick={onClose} className="border-white/20 text-white hover:bg-white/10">Cancel</Button>
      </div>
    </div>
  );
}

function LiveLeaderboard({ tournament }) {
  const { data: entries = [] } = useQuery({
    queryKey: ['weekly-wagers', tournament.id],
    queryFn: () => base44.entities.WeeklyWager.filter({ tournament_id: tournament.id }),
    enabled: !!tournament.id,
    refetchInterval: 30000,
  });

  const sorted = [...entries].sort((a, b) => (b.total_wagered || 0) - (a.total_wagered || 0));

  return (
    <div className="mt-4 border border-white/10 rounded-xl overflow-hidden">
      <div className="bg-white/5 px-4 py-2 flex items-center gap-2">
        <Users className="w-4 h-4 text-pink-400" />
        <span className="text-sm font-bold text-white">Live Leaderboard</span>
        <span className="ml-auto text-xs text-gray-400">{sorted.length} participants</span>
      </div>
      {sorted.length === 0 ? (
        <div className="px-4 py-6 text-center text-gray-500 text-sm">No wagers tracked yet</div>
      ) : (
        <div className="divide-y divide-white/5">
          {sorted.slice(0, 10).map((entry, i) => (
            <div key={entry.id} className="flex items-center gap-3 px-4 py-3">
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${i === 0 ? 'bg-yellow-500 text-black' : i === 1 ? 'bg-gray-400 text-black' : i === 2 ? 'bg-amber-700 text-white' : 'bg-white/10 text-gray-300'}`}>
                {i + 1}
              </span>
              <span className="flex-1 text-white text-sm truncate">{entry.display_name || entry.user_email}</span>
              <span className="text-pink-400 font-bold text-sm">{(entry.total_wagered || 0).toLocaleString()} IC</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function WeeklyTournamentManager() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewingId, setViewingId] = useState(null);

  const { data: tournaments = [] } = useQuery({
    queryKey: ['weekly-tournaments'],
    queryFn: () => base44.entities.WeeklyTournament.list('-starts_at', 20),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.WeeklyTournament.create(data),
    onSuccess: () => { queryClient.invalidateQueries(['weekly-tournaments']); toast.success('Tournament created!'); setDialogOpen(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.WeeklyTournament.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries(['weekly-tournaments']); toast.success('Tournament updated!'); setDialogOpen(false); setEditing(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.WeeklyTournament.delete(id),
    onSuccess: () => { queryClient.invalidateQueries(['weekly-tournaments']); toast.success('Tournament deleted'); },
  });

  const statusColor = { upcoming: 'bg-blue-500/20 text-blue-400', active: 'bg-green-500/20 text-green-400', completed: 'bg-gray-500/20 text-gray-400' };
  const statusIcon = { upcoming: <Clock className="w-3 h-3" />, active: <Zap className="w-3 h-3" />, completed: <CheckCircle className="w-3 h-3" /> };

  const viewing = tournaments.find(t => t.id === viewingId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><Trophy className="w-5 h-5 text-yellow-400" /> Weekly Wager Tournaments</h2>
          <p className="text-sm text-gray-400 mt-1">Whoever wagers the most in a week wins the prize. Tracks all game activity automatically.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(null)} className="bg-gradient-to-r from-pink-500 to-pink-600">
              <Plus className="w-4 h-4 mr-2" /> New Tournament
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#1A1528] border-white/10 text-white max-w-lg">
            <DialogHeader><DialogTitle>{editing ? 'Edit Tournament' : 'Create Weekly Tournament'}</DialogTitle></DialogHeader>
            <TournamentForm
              tournament={editing}
              onSave={(data) => editing ? updateMutation.mutate({ id: editing.id, data }) : createMutation.mutate(data)}
              onClose={() => { setDialogOpen(false); setEditing(null); }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Prize Summary for active tournament */}
      {tournaments.filter(t => t.status === 'active').map(t => (
        <Card key={t.id} className="bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border-yellow-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-5 h-5 text-yellow-400" />
              <span className="font-bold text-yellow-400">ACTIVE: {t.name}</span>
              <span className="ml-auto text-xs text-gray-400">Ends {new Date(t.ends_at).toLocaleDateString()}</span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center text-sm">
              <div className="bg-yellow-500/10 rounded-lg p-2">
                <div className="text-yellow-400 text-lg">🥇</div>
                <div className="text-white font-bold">{(t.first_place_ic || 0).toLocaleString()} IC</div>
                {t.first_place_id > 0 && <div className="text-green-400 text-xs">+{t.first_place_id} ID</div>}
              </div>
              <div className="bg-gray-500/10 rounded-lg p-2">
                <div className="text-gray-300 text-lg">🥈</div>
                <div className="text-white font-bold">{(t.second_place_ic || 0).toLocaleString()} IC</div>
                {t.second_place_id > 0 && <div className="text-green-400 text-xs">+{t.second_place_id} ID</div>}
              </div>
              <div className="bg-amber-700/10 rounded-lg p-2">
                <div className="text-amber-600 text-lg">🥉</div>
                <div className="text-white font-bold">{(t.third_place_ic || 0).toLocaleString()} IC</div>
                {t.third_place_id > 0 && <div className="text-green-400 text-xs">+{t.third_place_id} ID</div>}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Tournament List */}
      <div className="space-y-3">
        {tournaments.length === 0 && (
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-8 text-center text-gray-400">
              No tournaments yet. Create your first weekly tournament above!
            </CardContent>
          </Card>
        )}
        {tournaments.map(t => (
          <Card key={t.id} className="bg-white/5 border-white/10">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">{t.status === 'active' ? '🏆' : t.status === 'completed' ? '✅' : '📅'}</div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-white">{t.name}</h3>
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${statusColor[t.status]}`}>
                        {statusIcon[t.status]} {t.status}
                      </span>
                      {t.prize_paid && <span className="px-2 py-0.5 rounded-full text-xs bg-green-500/20 text-green-400">Prize Paid</span>}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(t.starts_at).toLocaleDateString()} → {new Date(t.ends_at).toLocaleDateString()} •
                      🥇 {(t.first_place_ic || 0).toLocaleString()} IC
                    </p>
                    {t.winner_email && (
                      <p className="text-xs text-yellow-400 mt-0.5">Winner: {t.winner_display_name || t.winner_email} ({(t.winner_total_wagered || 0).toLocaleString()} IC wagered)</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setViewingId(viewingId === t.id ? null : t.id)} className="text-blue-400 hover:text-blue-300 text-xs">
                    {viewingId === t.id ? 'Hide' : 'Leaderboard'}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => { setEditing(t); setDialogOpen(true); }}>
                    <Edit className="w-4 h-4 text-gray-400" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(t.id)}>
                    <span className="text-red-400 text-sm">✕</span>
                  </Button>
                </div>
              </div>
              {viewingId === t.id && <LiveLeaderboard tournament={t} />}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}