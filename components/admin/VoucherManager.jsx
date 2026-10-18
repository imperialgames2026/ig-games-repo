import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, Copy } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';

export default function VoucherManager() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState(null);

  const { data: vouchers = [] } = useQuery({
    queryKey: ['vouchers-admin'],
    queryFn: () => base44.entities.Voucher.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Voucher.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['vouchers-admin']);
      toast.success('Voucher created');
      setDialogOpen(false);
      setEditingVoucher(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Voucher.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['vouchers-admin']);
      toast.success('Voucher updated');
      setDialogOpen(false);
      setEditingVoucher(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Voucher.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['vouchers-admin']);
      toast.success('Voucher deleted');
    },
  });

  const GAME_OPTIONS = [
    { value: 'wheel', label: 'Spin Wheel' },
    { value: 'slots', label: 'Slots' },
    { value: 'dice', label: 'Dice' },
    { value: 'mines', label: 'Mines' },
    { value: 'plinko', label: 'Plinko' },
    { value: 'coinflip', label: 'Coin Flip' },
    { value: 'limbo', label: 'Limbo' },
    { value: 'towers', label: 'Towers' },
    { value: 'crash', label: 'Crash' },
  ];

  const VoucherForm = ({ voucher, onSave }) => {
    const [formData, setFormData] = useState(voucher || {
      code: '',
      tokens_reward: 0,
      cat_dollars_reward: 0,
      free_spins: 0,
      free_spin_game: 'wheel',
      free_spin_bet_amount: 0,
      max_uses: 1,
      is_active: true,
      description: '',
      expires_at: '',
    });

    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Voucher Code</Label>
          <Input
            value={formData.code}
            onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})}
            placeholder="e.g., LAUNCH2024"
            disabled={!!voucher}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Imperial Coins (IC)</Label>
            <Input
              type="number"
              value={formData.tokens_reward}
              onChange={(e) => setFormData({...formData, tokens_reward: parseInt(e.target.value) || 0})}
            />
          </div>
          <div className="space-y-2">
            <Label>Imperial Dollars (ID)</Label>
            <Input
              type="number"
              value={formData.cat_dollars_reward}
              onChange={(e) => setFormData({...formData, cat_dollars_reward: parseInt(e.target.value) || 0})}
            />
          </div>
        </div>

        {/* Free Spins */}
        <div className="border border-white/10 rounded-lg p-3 space-y-3 bg-white/5">
          <Label className="text-pink-400 font-bold">Free Spins (optional)</Label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-gray-400">Number of Free Spins</Label>
              <Input
                type="number"
                value={formData.free_spins}
                onChange={(e) => setFormData({...formData, free_spins: parseInt(e.target.value) || 0})}
                min={0}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-400">Bet Amount Per Spin</Label>
              <Input
                type="number"
                value={formData.free_spin_bet_amount}
                onChange={(e) => setFormData({...formData, free_spin_bet_amount: parseFloat(e.target.value) || 0})}
                min={0}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-gray-400">Game</Label>
            <Select
              value={formData.free_spin_game || 'wheel'}
              onValueChange={(v) => setFormData({...formData, free_spin_game: v})}
            >
              <SelectTrigger className="bg-white/5 border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1A1528] border-white/10 text-white">
                {GAME_OPTIONS.map(g => (
                  <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Max Uses (-1 for unlimited)</Label>
          <Input
            type="number"
            value={formData.max_uses}
            onChange={(e) => setFormData({...formData, max_uses: parseInt(e.target.value)})}
          />
        </div>

        <div className="space-y-2">
          <Label>Description (optional)</Label>
          <Textarea
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
            placeholder="e.g., Launch day bonus"
            rows="2"
          />
        </div>

        <div className="space-y-2">
          <Label>Expires At (optional)</Label>
          <Input
            type="datetime-local"
            value={formData.expires_at}
            onChange={(e) => setFormData({...formData, expires_at: e.target.value})}
          />
        </div>

        <div className="flex items-center gap-2">
          <Switch
            checked={formData.is_active}
            onCheckedChange={(v) => setFormData({...formData, is_active: v})}
          />
          <Label>Active</Label>
        </div>

        <Button onClick={() => onSave(formData)} className="w-full bg-gradient-to-r from-pink-500 to-pink-600">
          {voucher ? 'Update' : 'Create'} Voucher
        </Button>
      </div>
    );
  };

  return (
    <Card className="bg-white/5 border-white/10">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-white">Vouchers</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingVoucher(null)} className="bg-gradient-to-r from-pink-500 to-pink-600">
              <Plus className="w-4 h-4 mr-2" />
              Create Voucher
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#1A1528] border-white/10 text-white max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingVoucher ? 'Edit Voucher' : 'New Voucher'}</DialogTitle>
            </DialogHeader>
            <VoucherForm
              voucher={editingVoucher}
              onSave={(data) => {
                if (editingVoucher) {
                  updateMutation.mutate({ id: editingVoucher.id, data });
                } else {
                  createMutation.mutate(data);
                }
              }}
            />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {vouchers.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No vouchers created yet</p>
          ) : (
            vouchers.map((v) => {
              const isExpired = v.expires_at && new Date(v.expires_at) < new Date();
              const isMaxed = v.max_uses !== -1 && v.times_used >= v.max_uses;

              return (
                <div key={v.id} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-white">{v.code}</h3>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(v.code);
                          toast.success('Copied code');
                        }}
                        className="p-1 hover:bg-white/10 rounded"
                      >
                        <Copy className="w-3 h-3 text-gray-400" />
                      </button>
                    </div>
                    <p className="text-sm text-gray-400">
                      {v.tokens_reward > 0 && `${v.tokens_reward} IC`}
                      {v.tokens_reward > 0 && v.cat_dollars_reward > 0 && ' + '}
                      {v.cat_dollars_reward > 0 && `${v.cat_dollars_reward} ID`}
                      {v.free_spins > 0 && ` + ${v.free_spins} Free Spins (${v.free_spin_game}, ${v.free_spin_bet_amount} bet)`}
                      {v.description && ` • ${v.description}`}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Uses: {v.times_used}/{v.max_uses === -1 ? '∞' : v.max_uses}
                      {isExpired && ' • Expired'}
                      {!isExpired && v.expires_at && ` • Expires ${new Date(v.expires_at).toLocaleDateString()}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`px-3 py-1 rounded-full text-xs ${
                      isExpired || isMaxed || !v.is_active
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-green-500/20 text-green-400'
                    }`}>
                      {isExpired ? 'Expired' : isMaxed ? 'Maxed' : v.is_active ? 'Active' : 'Inactive'}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditingVoucher(v);
                        setDialogOpen(true);
                      }}
                    >
                      <Edit className="w-4 h-4 text-gray-400" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(v.id)}
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}