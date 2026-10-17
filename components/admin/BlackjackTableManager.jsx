import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, Save, Crown } from 'lucide-react';
import { toast } from 'sonner';

const TableForm = ({ table, onSave }) => {
  const [form, setForm] = useState(table || {
    name: '',
    min_bet: 0,
    max_bet: 3000,
    currency: 'both',
    is_high_roller: false,
    is_active: true,
    max_seats: 7,
  });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-white">Table Name</Label>
        <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="bg-white/10 border-white/20 text-white min-h-[44px] text-base" placeholder="e.g. Imperial Table #1" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-white">Min Bet (0 = no min)</Label>
          <Input type="number" value={form.min_bet} onChange={e => setForm({ ...form, min_bet: e.target.value === '' ? '' : parseFloat(e.target.value) })} className="bg-white/10 border-white/20 text-white min-h-[44px] text-base" />
        </div>
        <div className="space-y-2">
          <Label className="text-white">Max Bet</Label>
          <Input type="number" value={form.max_bet} onChange={e => setForm({ ...form, max_bet: e.target.value === '' ? '' : parseFloat(e.target.value) })} className="bg-white/10 border-white/20 text-white min-h-[44px] text-base" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-white">Max Seats</Label>
          <Input type="number" min="1" max="7" value={form.max_seats} onChange={e => setForm({ ...form, max_seats: e.target.value === '' ? '' : parseInt(e.target.value) })} className="bg-white/10 border-white/20 text-white min-h-[44px] text-base" />
        </div>
        <div className="space-y-2">
          <Label className="text-white">Currency</Label>
          <Select value={form.currency} onValueChange={(value) => setForm({ ...form, currency: value })}>
            <SelectTrigger className="w-full bg-white/10 border-white/20 text-white min-h-[44px] text-base">
              <SelectValue placeholder="Select currency" />
            </SelectTrigger>
            <SelectContent className="bg-[#1A1528] border-white/10 text-white">
              <SelectItem value="both">Both IC & ID</SelectItem>
              <SelectItem value="IC">IC Only</SelectItem>
              <SelectItem value="ID">ID Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
        <div className="flex items-center gap-2">
          <Switch checked={form.is_high_roller} onCheckedChange={v => setForm({ ...form, is_high_roller: v })} />
          <Label className="text-white">High Roller Table</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
          <Label className="text-white">Active</Label>
        </div>
      </div>
      <Button onClick={() => onSave(form)} className="w-full bg-gradient-to-r from-pink-500 to-pink-600">
        <Save className="w-4 h-4 mr-2" />
        {table ? 'Update Table' : 'Create Table'}
      </Button>
    </div>
  );
};

export default function BlackjackTableManager() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const { data: tables = [] } = useQuery({
    queryKey: ['bj-tables'],
    queryFn: () => base44.entities.BlackjackTable.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.BlackjackTable.create(data),
    onSuccess: () => { queryClient.invalidateQueries(['bj-tables']); toast.success('Table created'); setDialogOpen(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.BlackjackTable.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries(['bj-tables']); toast.success('Table updated'); setDialogOpen(false); setEditing(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.BlackjackTable.delete(id),
    onSuccess: () => { queryClient.invalidateQueries(['bj-tables']); toast.success('Table deleted'); },
  });

  return (
    <Card className="bg-white/5 border-white/10">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-white flex items-center gap-2">
          🃏 Blackjack Tables
        </CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(null)} className="bg-gradient-to-r from-pink-500 to-pink-600">
              <Plus className="w-4 h-4 mr-2" /> Add Table
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#1A1528] border-white/10 text-white">
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit Table' : 'New Table'}</DialogTitle>
            </DialogHeader>
            <TableForm table={editing} onSave={(data) => {
              if (editing) updateMutation.mutate({ id: editing.id, data });
              else createMutation.mutate(data);
            }} />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {tables.map(table => (
            <div key={table.id} className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10">
              <div>
                <div className="flex items-center gap-2 font-bold text-white">
                  {table.is_high_roller && <Crown className="w-4 h-4 text-yellow-400" />}
                  {table.name}
                  {!table.is_active && <span className="text-xs text-red-400 ml-2">(Inactive)</span>}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Bet: {table.min_bet > 0 ? table.min_bet : 'No min'} – {table.max_bet} {table.currency} | {table.max_seats} seats
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="icon" onClick={() => { setEditing(table); setDialogOpen(true); }}>
                  <Edit className="w-4 h-4 text-gray-400" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(table.id)}>
                  <Trash2 className="w-4 h-4 text-red-400" />
                </Button>
              </div>
            </div>
          ))}
          {tables.length === 0 && (
            <p className="text-gray-500 text-center py-4">No tables yet. Create one above.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}