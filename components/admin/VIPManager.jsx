import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, Edit, Trash2, Crown, Gift, Save } from 'lucide-react';
import VIPBonusIssuer from './VIPBonusIssuer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const tierGroups = ['Bronze', 'Silver', 'Gold', 'Platinum I', 'Platinum II', 'Diamond I', 'Diamond II', 'Diamond III'];
const bonusTypes = ['fixed', 'recharge', 'weekly_cashback', 'monthly_cashback', 'daily_bonus', 'sports_bonus', 'lucky_spin', 'vip_level_up'];

export default function VIPManager() {
  const queryClient = useQueryClient();
  const [userRole, setUserRole] = useState('');
  const canEdit = userRole === 'superadmin';

  useEffect(() => {
    base44.auth.me().then((user) => setUserRole(user?.role || ''));
  }, []);
  const [tierDialogOpen, setTierDialogOpen] = useState(false);
  const [bonusDialogOpen, setBonusDialogOpen] = useState(false);
  const [levelDialogOpen, setLevelDialogOpen] = useState(false);
  const [editingTier, setEditingTier] = useState(null);
  const [editingBonus, setEditingBonus] = useState(null);
  const [editingLevel, setEditingLevel] = useState(null);

  const { data: tiers = [] } = useQuery({
    queryKey: ['vip-tiers'],
    queryFn: () => base44.entities.VIPTier.list(),
  });

  const { data: bonuses = [] } = useQuery({
    queryKey: ['vip-bonuses'],
    queryFn: () => base44.entities.VIPBonus.list(),
  });

  const { data: levels = [] } = useQuery({
    queryKey: ['vip-levels'],
    queryFn: () => base44.entities.VIPLevel.list(),
  });

  const createTierMutation = useMutation({
    mutationFn: (data) => base44.entities.VIPTier.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['vip-tiers']);
      toast.success('Tier created');
      setTierDialogOpen(false);
      setEditingTier(null);
    },
  });

  const updateTierMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.VIPTier.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['vip-tiers']);
      toast.success('Tier updated');
      setTierDialogOpen(false);
      setEditingTier(null);
    },
  });

  const deleteTierMutation = useMutation({
    mutationFn: (id) => base44.entities.VIPTier.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['vip-tiers']);
      toast.success('Tier deleted');
    },
  });

  const createBonusMutation = useMutation({
    mutationFn: (data) => base44.entities.VIPBonus.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['vip-bonuses']);
      toast.success('Bonus created');
      setBonusDialogOpen(false);
      setEditingBonus(null);
    },
  });

  const updateBonusMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.VIPBonus.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['vip-bonuses']);
      toast.success('Bonus updated');
      setBonusDialogOpen(false);
      setEditingBonus(null);
    },
  });

  const deleteBonusMutation = useMutation({
    mutationFn: (id) => base44.entities.VIPBonus.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['vip-bonuses']);
      toast.success('Bonus deleted');
    },
  });

  const createLevelMutation = useMutation({
    mutationFn: (data) => base44.entities.VIPLevel.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['vip-levels']);
      toast.success('Level created');
      setLevelDialogOpen(false);
      setEditingLevel(null);
    },
  });

  const updateLevelMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.VIPLevel.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['vip-levels']);
      toast.success('Level updated');
      setLevelDialogOpen(false);
      setEditingLevel(null);
    },
  });

  const deleteLevelMutation = useMutation({
    mutationFn: (id) => base44.entities.VIPLevel.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['vip-levels']);
      toast.success('Level deleted');
    },
  });

  const TierForm = ({ tier, onSave }) => {
    const [formData, setFormData] = useState(tier || {
      tier_name: '',
      tier_group: 'Bronze',
      min_level: 1,
      max_level: 7,
      color: '#FF6B35',
      icon: '🥉',
      benefits: [],
      is_active: true,
    });

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Tier Name</Label>
            <Input value={formData.tier_name} onChange={(e) => setFormData({...formData, tier_name: e.target.value})} placeholder="e.g., Bronze VIP" />
          </div>
          <div className="space-y-2">
            <Label>Tier Group</Label>
            <Select value={formData.tier_group} onValueChange={(v) => setFormData({...formData, tier_group: v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {tierGroups.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Min Level</Label>
            <Input type="number" value={formData.min_level} onChange={(e) => setFormData({...formData, min_level: parseInt(e.target.value) || 0})} />
          </div>
          <div className="space-y-2">
            <Label>Max Level</Label>
            <Input type="number" value={formData.max_level} onChange={(e) => setFormData({...formData, max_level: parseInt(e.target.value) || 0})} />
          </div>
          <div className="space-y-2">
            <Label>Icon</Label>
            <Input value={formData.icon} onChange={(e) => setFormData({...formData, icon: e.target.value})} placeholder="🥉" maxLength="2" />
          </div>
        </div>

        <Button onClick={() => onSave(formData)} className="w-full bg-gradient-to-r from-pink-500 to-pink-600">
          <Save className="w-4 h-4 mr-2" />
          {tier ? 'Update Tier' : 'Create Tier'}
        </Button>
      </div>
    );
  };

  const BonusForm = ({ bonus, onSave }) => {
    const [formData, setFormData] = useState(bonus || {
      bonus_type: 'fixed',
      display_name: '',
      description: '',
      amount_type: 'fixed',
      base_amount: 0,
      wager_requirement: 0,
      claim_interval_hours: 24,
      min_tier_level: 1,
      is_active: true,
    });

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Bonus Type</Label>
            <Select value={formData.bonus_type} onValueChange={(v) => setFormData({...formData, bonus_type: v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {bonusTypes.map(b => <SelectItem key={b} value={b}>{b.replace('_', ' ')}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Display Name</Label>
            <Input value={formData.display_name} onChange={(e) => setFormData({...formData, display_name: e.target.value})} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Description</Label>
          <Input value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Base Amount</Label>
            <Input type="number" step="0.01" value={formData.base_amount} onChange={(e) => setFormData({...formData, base_amount: parseFloat(e.target.value) || 0})} />
          </div>
          <div className="space-y-2">
            <Label>Wager Required</Label>
            <Input type="number" value={formData.wager_requirement} onChange={(e) => setFormData({...formData, wager_requirement: parseInt(e.target.value) || 0})} />
          </div>
          <div className="space-y-2">
            <Label>Claim Interval (hrs)</Label>
            <Input type="number" value={formData.claim_interval_hours} onChange={(e) => setFormData({...formData, claim_interval_hours: parseInt(e.target.value) || 0})} />
          </div>
        </div>

        <Button onClick={() => onSave(formData)} className="w-full bg-gradient-to-r from-pink-500 to-pink-600">
          <Save className="w-4 h-4 mr-2" />
          {bonus ? 'Update Bonus' : 'Create Bonus'}
        </Button>
      </div>
    );
  };

  const LevelForm = ({ level, onSave }) => {
    const [formData, setFormData] = useState(level || {
      level: 1,
      required_xp: 0,
      tier_group: 'Bronze',
      display_name: 'VIP 01',
      level_up_bonus_amount: 0,
    });

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Level</Label>
            <Input type="number" value={formData.level} onChange={(e) => setFormData({...formData, level: parseInt(e.target.value)})} />
          </div>
          <div className="space-y-2">
            <Label>Required XP</Label>
            <Input type="number" value={formData.required_xp} onChange={(e) => setFormData({...formData, required_xp: parseInt(e.target.value) || 0})} />
          </div>
          <div className="space-y-2">
            <Label>Level-Up Bonus</Label>
            <Input type="number" value={formData.level_up_bonus_amount} onChange={(e) => setFormData({...formData, level_up_bonus_amount: parseFloat(e.target.value) || 0})} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Tier Group</Label>
          <Select value={formData.tier_group} onValueChange={(v) => setFormData({...formData, tier_group: v})}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {tierGroups.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={() => onSave(formData)} className="w-full bg-gradient-to-r from-pink-500 to-pink-600">
          <Save className="w-4 h-4 mr-2" />
          {level ? 'Update Level' : 'Create Level'}
        </Button>
      </div>
    );
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-gray-300">
        <span className="font-semibold text-white">VIP permissions:</span> super admin can edit VIP setup and issue bonuses; admin/tester are view-only.
      </div>

      <VIPBonusIssuer canEdit={canEdit} />

      <Tabs defaultValue="tiers" className="space-y-4">
        <TabsList className="bg-white/5 border border-white/10">
          <TabsTrigger value="tiers" className="data-[state=active]:bg-pink-500">
            <Crown className="w-4 h-4 mr-2" />
            Tiers
          </TabsTrigger>
          <TabsTrigger value="levels" className="data-[state=active]:bg-pink-500">
            <span className="w-4 h-4 mr-2">📊</span>
            Levels
          </TabsTrigger>
          <TabsTrigger value="bonuses" className="data-[state=active]:bg-pink-500">
            <Gift className="w-4 h-4 mr-2" />
            Bonuses
          </TabsTrigger>
        </TabsList>

        {/* Tiers */}
        <TabsContent value="tiers">
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white">VIP Tiers</CardTitle>
              <Dialog open={tierDialogOpen} onOpenChange={setTierDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => setEditingTier(null)} disabled={!canEdit} className="bg-gradient-to-r from-pink-500 to-pink-600 disabled:opacity-40">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Tier
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-[#1A1528] border-white/10 text-white">
                  <DialogHeader>
                    <DialogTitle>{editingTier ? 'Edit Tier' : 'New Tier'}</DialogTitle>
                  </DialogHeader>
                  <TierForm tier={editingTier} onSave={(data) => {
                    if (editingTier) updateTierMutation.mutate({ id: editingTier.id, data });
                    else createTierMutation.mutate(data);
                  }} />
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {tiers.map((tier) => (
                  <div key={tier.id} className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10">
                    <div>
                      <div className="font-bold text-white">{tier.icon} {tier.tier_name}</div>
                      <div className="text-xs text-gray-400">{tier.tier_group} • Levels {tier.min_level}-{tier.max_level}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" disabled={!canEdit} onClick={() => { setEditingTier(tier); setTierDialogOpen(true); }}>
                        <Edit className="w-4 h-4 text-gray-400" />
                      </Button>
                      <Button variant="ghost" size="icon" disabled={!canEdit} onClick={() => deleteTierMutation.mutate(tier.id)}>
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Levels */}
        <TabsContent value="levels">
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white">VIP Levels</CardTitle>
              <Dialog open={levelDialogOpen} onOpenChange={setLevelDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => setEditingLevel(null)} disabled={!canEdit} className="bg-gradient-to-r from-pink-500 to-pink-600 disabled:opacity-40">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Level
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-[#1A1528] border-white/10 text-white">
                  <DialogHeader>
                    <DialogTitle>{editingLevel ? 'Edit Level' : 'New Level'}</DialogTitle>
                  </DialogHeader>
                  <LevelForm level={editingLevel} onSave={(data) => {
                    if (editingLevel) updateLevelMutation.mutate({ id: editingLevel.id, data });
                    else createLevelMutation.mutate(data);
                  }} />
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-y-auto space-y-1">
                {levels.sort((a, b) => a.level - b.level).map((level) => (
                  <div key={level.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10 text-sm">
                    <div>
                      <span className="font-bold text-white">{level.display_name}</span>
                      <span className="text-xs text-gray-400 ml-2">{level.tier_group}</span>
                      <div className="text-xs text-pink-300 mt-1">Level-up bonus: {level.level_up_bonus_amount || 0}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-yellow-400 font-mono">{level.required_xp.toLocaleString()} XP</span>
                      <Button variant="ghost" size="icon" disabled={!canEdit} onClick={() => { setEditingLevel(level); setLevelDialogOpen(true); }}>
                        <Edit className="w-3 h-3 text-gray-400" />
                      </Button>
                      <Button variant="ghost" size="icon" disabled={!canEdit} onClick={() => deleteLevelMutation.mutate(level.id)}>
                        <Trash2 className="w-3 h-3 text-red-400" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bonuses */}
        <TabsContent value="bonuses">
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white">VIP Bonuses</CardTitle>
              <Dialog open={bonusDialogOpen} onOpenChange={setBonusDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => setEditingBonus(null)} disabled={!canEdit} className="bg-gradient-to-r from-pink-500 to-pink-600 disabled:opacity-40">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Bonus
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-[#1A1528] border-white/10 text-white max-w-lg">
                  <DialogHeader>
                    <DialogTitle>{editingBonus ? 'Edit Bonus' : 'New Bonus'}</DialogTitle>
                  </DialogHeader>
                  <BonusForm bonus={editingBonus} onSave={(data) => {
                    if (editingBonus) updateBonusMutation.mutate({ id: editingBonus.id, data });
                    else createBonusMutation.mutate(data);
                  }} />
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {bonuses.map((bonus) => (
                  <div key={bonus.id} className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10">
                    <div>
                      <div className="font-bold text-white">{bonus.display_name}</div>
                      <div className="text-xs text-gray-400">{bonus.bonus_type.replace(/_/g, ' ')} • {bonus.base_amount} {bonus.amount_type}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" disabled={!canEdit} onClick={() => { setEditingBonus(bonus); setBonusDialogOpen(true); }}>
                        <Edit className="w-4 h-4 text-gray-400" />
                      </Button>
                      <Button variant="ghost" size="icon" disabled={!canEdit} onClick={() => deleteBonusMutation.mutate(bonus.id)}>
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}