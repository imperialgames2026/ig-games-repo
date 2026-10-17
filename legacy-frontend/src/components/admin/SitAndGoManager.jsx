import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Save, X, ToggleLeft, ToggleRight, Info } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const DEFAULT_FORM = {
  name: '',
  small_blind: 5,
  big_blind: 10,
  min_buyin: 100,
  max_buyin: 1000,
  max_players: 6,
  is_active: true,
  insurance_mode: false,
  insurance_pot_percentage: 5,
  ante_enabled: false,
  ante_bb_multiplier: 1,
  bomb_pot_enabled: false,
  bomb_pot_trigger_minutes: 30,
  bomb_pot_bb_multiplier: 8
};

export default function SitAndGoManager() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(DEFAULT_FORM);

  const { data: tables = [], refetch } = useQuery({
    queryKey: ['admin-sng-tables'],
    queryFn: () => base44.entities.SitAndGoTable.list()
  });

  const openCreate = () => {
    setEditing(null);
    setForm(DEFAULT_FORM);
    setDialogOpen(true);
  };

  const openEdit = (table) => {
    setEditing(table);
    setForm({
      name: table.name,
      small_blind: table.small_blind,
      big_blind: table.big_blind,
      min_buyin: table.min_buyin,
      max_buyin: table.max_buyin,
      max_players: table.max_players,
      is_active: table.is_active,
      insurance_mode: table.insurance_mode || false,
      insurance_pot_percentage: table.insurance_pot_percentage || 5,
      ante_enabled: table.ante_enabled || false,
      ante_bb_multiplier: table.ante_bb_multiplier || 1,
      bomb_pot_enabled: table.bomb_pot_enabled || false,
      bomb_pot_trigger_minutes: table.bomb_pot_trigger_minutes || 30,
      bomb_pot_bb_multiplier: table.bomb_pot_bb_multiplier || 8
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (editing) {
      await base44.entities.SitAndGoTable.update(editing.id, form);
    } else {
      await base44.entities.SitAndGoTable.create({
        ...form,
        status: 'waiting',
        seated_players: [],
        hand_number: 0
      });
    }
    setDialogOpen(false);
    refetch();
  };

  const toggleActive = async (table) => {
    await base44.entities.SitAndGoTable.update(table.id, { is_active: !table.is_active });
    refetch();
  };

  const deleteTable = async (table) => {
    if (!confirm(`Delete "${table.name}"?`)) return;
    await base44.entities.SitAndGoTable.delete(table.id);
    refetch();
  };

  const f = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.type === 'number' ? parseFloat(e.target.value) : e.target.value }));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-bold text-lg">Sit & Go Tables</h2>
        <Button onClick={openCreate} className="bg-pink-500 hover:bg-pink-600 gap-2">
          <Plus className="w-4 h-4" /> New Table
        </Button>
      </div>

      <div className="space-y-3">
        {tables.map(table => (
          <div key={table.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-white font-semibold">{table.name}</span>
                <Badge className={table.is_active ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}>
                  {table.is_active ? 'Active' : 'Inactive'}
                </Badge>
                <Badge className="bg-blue-500/20 text-blue-400">
                  {table.status}
                </Badge>
              </div>
              <div className="text-gray-400 text-sm mt-1">
                Blinds: <span className="text-pink-400">{table.small_blind}/{table.big_blind} ID</span>
                &nbsp;·&nbsp; Buy-in: <span className="text-yellow-400">{table.min_buyin}–{table.max_buyin} ID</span>
                &nbsp;·&nbsp; Max seats: <span className="text-white">{table.max_players}</span>
                &nbsp;·&nbsp; Seated: <span className="text-green-400">{table.seated_players?.length || 0}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="icon" variant="ghost" onClick={() => toggleActive(table)} className="text-gray-400 hover:text-white">
                {table.is_active ? <ToggleRight className="w-5 h-5 text-green-400" /> : <ToggleLeft className="w-5 h-5" />}
              </Button>
              <Button size="icon" variant="ghost" onClick={() => openEdit(table)} className="text-gray-400 hover:text-white">
                <Pencil className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => deleteTable(table)} className="text-gray-400 hover:text-red-400">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
        {tables.length === 0 && (
          <p className="text-gray-500 text-center py-8">No tables yet. Create one above.</p>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-[#1A1030] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Table' : 'Create Table'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-gray-300">Table Name</Label>
              <Input value={form.name} onChange={f('name')} placeholder="e.g. Imperial Table #1" className="bg-white/5 border-white/10 text-white mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-gray-300">Small Blind (ID)</Label>
                <Input type="number" value={form.small_blind} onChange={f('small_blind')} className="bg-white/5 border-white/10 text-white mt-1" />
              </div>
              <div>
                <Label className="text-gray-300">Big Blind (ID)</Label>
                <Input type="number" value={form.big_blind} onChange={f('big_blind')} className="bg-white/5 border-white/10 text-white mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-gray-300">Min Buy-in (ID)</Label>
                <Input type="number" value={form.min_buyin} onChange={f('min_buyin')} className="bg-white/5 border-white/10 text-white mt-1" />
              </div>
              <div>
                <Label className="text-gray-300">Max Buy-in (ID)</Label>
                <Input type="number" value={form.max_buyin} onChange={f('max_buyin')} className="bg-white/5 border-white/10 text-white mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-gray-300">Max Players (2–9)</Label>
              <Input type="number" min={2} max={9} value={form.max_players} onChange={f('max_players')} className="bg-white/5 border-white/10 text-white mt-1" />
            </div>

            {/* Insurance Mode */}
            <div className="border border-blue-500/20 rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-blue-300 font-semibold">🛡️ Insurance Mode</Label>
                  <p className="text-gray-500 text-xs mt-0.5">Players can buy insurance when all-in</p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, insurance_mode: !prev.insurance_mode }))}
                  className={`w-11 h-6 rounded-full transition-colors ${form.insurance_mode ? 'bg-blue-500' : 'bg-gray-600'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full mx-0.5 transition-transform ${form.insurance_mode ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
              {form.insurance_mode && (
                <div>
                  <Label className="text-gray-300 text-xs">% of each pot → Insurance Fund</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input type="number" min={1} max={20} value={form.insurance_pot_percentage} onChange={f('insurance_pot_percentage')} className="bg-white/5 border-white/10 text-white w-24" />
                    <span className="text-gray-400 text-sm">%</span>
                  </div>
                </div>
              )}
            </div>

            {/* Ante */}
            <div className="border border-yellow-500/20 rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-yellow-300 font-semibold">🪙 Ante (per hand)</Label>
                  <p className="text-gray-500 text-xs mt-0.5">Each player posts an ante — goes to the current hand pot</p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, ante_enabled: !prev.ante_enabled }))}
                  className={`w-11 h-6 rounded-full transition-colors ${form.ante_enabled ? 'bg-yellow-500' : 'bg-gray-600'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full mx-0.5 transition-transform ${form.ante_enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
              {form.ante_enabled && (
                <div>
                  <Label className="text-gray-300 text-xs">BB ante per player · 1–5</Label>
                  <Input type="number" min={1} max={5} value={form.ante_bb_multiplier} onChange={f('ante_bb_multiplier')} className="bg-white/5 border-white/10 text-white mt-1 w-24" />
                </div>
              )}
            </div>

            {/* Bomb Pot */}
            <div className="border border-orange-500/20 rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Label className="text-orange-300 font-semibold">💣 Bomb Pot</Label>
                    <button
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, _showBombPotInfo: !prev._showBombPotInfo }))}
                      className="text-gray-400 hover:text-orange-300 transition-colors"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-gray-500 text-xs mt-0.5">Each hand builds a hidden fund — releases as a pot (flop-start) on timer</p>
                  {form._showBombPotInfo && (
                    <div className="mt-2 bg-[#2a1f10] border border-orange-500/30 rounded-lg p-3 text-xs text-gray-300 space-y-2">
                      <p>After the game starts, set a specific minute. Before cards are dealt, all participating players automatically contribute a pre-defined "Bomb Bet" to the pot.</p>
                      <p>The game then proceeds directly to the flop round after the cards are dealt. If a player's chip stack is insufficient to cover the Bomb Bet, they will automatically go all-in.</p>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, bomb_pot_enabled: !prev.bomb_pot_enabled }))}
                  className={`w-11 h-6 rounded-full transition-colors ${form.bomb_pot_enabled ? 'bg-orange-500' : 'bg-gray-600'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full mx-0.5 transition-transform ${form.bomb_pot_enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
              {form.bomb_pot_enabled && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-gray-300 text-xs">Trigger every (mins) · 2–10</Label>
                    <Input type="number" min={2} max={10} value={form.bomb_pot_trigger_minutes} onChange={f('bomb_pot_trigger_minutes')} className="bg-white/5 border-white/10 text-white mt-1" />
                  </div>
                  <div>
                    <Label className="text-gray-300 text-xs">BB post per player · 1–14</Label>
                    <Input type="number" min={1} max={14} value={form.bomb_pot_bb_multiplier} onChange={f('bomb_pot_bb_multiplier')} className="bg-white/5 border-white/10 text-white mt-1" />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setDialogOpen(false)} className="text-gray-400">Cancel</Button>
              <Button onClick={save} className="bg-pink-500 hover:bg-pink-600">
                <Save className="w-4 h-4 mr-2" /> {editing ? 'Save Changes' : 'Create Table'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}