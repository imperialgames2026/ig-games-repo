import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { 
  Gamepad2, Coins, Plus, Edit, Trash2, Power, Star, Save, X, 
  BarChart3, Users, TrendingUp, Package, Zap, Crown, DollarSign, Ticket, Upload, FileSearch
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import CrashRoundManager from '@/components/admin/CrashRoundManager';
import VIPManager from '@/components/admin/VIPManager';
import WithdrawalManager from '@/components/admin/WithdrawalManager.jsx';
import VoucherManager from '@/components/admin/VoucherManager';
import SitAndGoManager from '@/components/admin/SitAndGoManager';
import TournamentManager from '@/components/admin/TournamentManager';
import RakeSettings from '@/components/admin/RakeSettings';
import WheelRewardManager from '@/components/admin/WheelRewardManager';
import BlackjackTableManager from '@/components/admin/BlackjackTableManager';
import WeeklyTournamentManager from '@/components/admin/WeeklyTournamentManager';
import AdminSweepstakesAudit from '@/pages/AdminSweepstakesAudit';
import SlotDropSettings from '@/components/admin/SlotDropSettings';
import OriginalsWinLoseSettings from '@/components/admin/OriginalsWinLoseSettings';

export default function Admin() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [gameDialogOpen, setGameDialogOpen] = useState(false);
  const [packDialogOpen, setPackDialogOpen] = useState(false);
  const [editingGame, setEditingGame] = useState(null);
  const [editingPack, setEditingPack] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const u = await base44.auth.me();
        if (u.role !== 'admin' && u.role !== 'superadmin' && u.role !== 'tester') {
          window.location.href = '/';
        }
        setUser(u);
      } catch (e) {
        base44.auth.redirectToLogin();
      }
    };
    loadUser();
  }, []);

  const { data: games = [] } = useQuery({
    queryKey: ['games-admin'],
    queryFn: () => base44.entities.Game.list(),
  });

  const { data: packs = [] } = useQuery({
    queryKey: ['packs-admin'],
    queryFn: () => base44.entities.TokenPack.list(),
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions-admin'],
    queryFn: () => base44.entities.Transaction.list('-created_date', 100),
  });

  const { data: wallets = [] } = useQuery({
    queryKey: ['wallets-admin'],
    queryFn: () => base44.entities.UserWallet.list(),
  });

  // Game mutations
  const createGameMutation = useMutation({
    mutationFn: (data) => base44.entities.Game.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['games-admin']);
      toast.success('Game created successfully');
      setGameDialogOpen(false);
      setEditingGame(null);
    },
  });

  const updateGameMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Game.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['games-admin']);
      toast.success('Game updated successfully');
      setGameDialogOpen(false);
      setEditingGame(null);
    },
  });

  const deleteGameMutation = useMutation({
    mutationFn: (id) => base44.entities.Game.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['games-admin']);
      toast.success('Game deleted successfully');
    },
  });

  // Pack mutations
  const createPackMutation = useMutation({
    mutationFn: (data) => base44.entities.TokenPack.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['packs-admin']);
      toast.success('Token pack created successfully');
      setPackDialogOpen(false);
      setEditingPack(null);
    },
  });

  const updatePackMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.TokenPack.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['packs-admin']);
      toast.success('Token pack updated successfully');
      setPackDialogOpen(false);
      setEditingPack(null);
    },
  });

  const deletePackMutation = useMutation({
    mutationFn: (id) => base44.entities.TokenPack.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['packs-admin']);
      toast.success('Token pack deleted successfully');
    },
  });

  // Stats
  const totalTokensInCirculation = wallets.reduce((sum, w) => sum + (w.cent_balance || 0), 0);
  const totalRevenue = transactions.filter(t => t.type === 'purchase').reduce((sum, t) => sum + (t.igd_amount || 0), 0);
  const activeGames = games.filter(g => g.is_active).length;

  const GameForm = ({ game, onSave }) => {
    const [formData, setFormData] = useState(game || {
      name: '',
      slug: '',
      description: '',
      image_url: '',
      category: 'table',
      min_bet: 10,
      max_bet: 10000,
      is_active: true,
      is_featured: false,
    });

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="Game name"
            />
          </div>
          <div className="space-y-2">
            <Label>Slug (URL identifier)</Label>
            <Input
              value={formData.slug}
              onChange={(e) => setFormData({...formData, slug: e.target.value})}
              placeholder="e.g., Blackjack"
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
            placeholder="Game description"
          />
        </div>

        <div className="space-y-2">
          <Label>Image URL</Label>
          <Input
            value={formData.image_url}
            onChange={(e) => setFormData({...formData, image_url: e.target.value})}
            placeholder="https://..."
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={formData.category} onValueChange={(v) => setFormData({...formData, category: v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="table">Table</SelectItem>
                <SelectItem value="slots">Slots</SelectItem>
                <SelectItem value="instant">Instant</SelectItem>
                <SelectItem value="cards">Cards</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Min Bet</Label>
            <Input
              type="number"
              value={formData.min_bet}
              onChange={(e) => setFormData({...formData, min_bet: parseInt(e.target.value)})}
            />
          </div>
          <div className="space-y-2">
            <Label>Max Bet</Label>
            <Input
              type="number"
              value={formData.max_bet}
              onChange={(e) => setFormData({...formData, max_bet: parseInt(e.target.value)})}
            />
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Switch
              checked={formData.is_active}
              onCheckedChange={(v) => setFormData({...formData, is_active: v})}
            />
            <Label>Active</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={formData.is_featured}
              onCheckedChange={(v) => setFormData({...formData, is_featured: v})}
            />
            <Label>Featured</Label>
          </div>
        </div>

        <Button onClick={() => onSave(formData)} className="w-full bg-gradient-to-r from-pink-500 to-pink-600">
          <Save className="w-4 h-4 mr-2" />
          {game ? 'Update Game' : 'Create Game'}
        </Button>
      </div>
    );
  };

  const PackForm = ({ pack, onSave }) => {
    const [formData, setFormData] = useState(pack || {
      name: '',
      tokens: 1000,
      cat_dollars: 0,
      price: 9.99,
      is_active: true,
      is_featured: false,
      badge: '',
      image_url: '',
    });
    const [uploading, setUploading] = useState(false);

    const handleImageUpload = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setUploading(true);
      try {
        const { data } = await base44.functions.invoke('Core', {
          method: 'UploadFile',
          file: file,
        });
        setFormData({...formData, image_url: data.file_url});
      } catch (err) {
        toast.error('Failed to upload image');
      } finally {
        setUploading(false);
      }
    };

    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Name</Label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            placeholder="Pack name"
          />
        </div>

        <div className="space-y-2">
          <Label>Package Image</Label>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="flex items-center justify-center w-full h-24 px-4 transition bg-white/5 border-2 border-dashed border-white/10 rounded-lg cursor-pointer hover:border-pink-500/50">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-5 h-5 text-gray-400 mb-1" />
                  <p className="text-xs text-gray-400">{uploading ? 'Uploading...' : 'Click to upload'}</p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
            </div>
            {formData.image_url && (
              <img src={formData.image_url} alt="Preview" className="w-24 h-24 rounded-lg object-cover" />
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>CENT</Label>
            <Input
              type="number"
              value={formData.tokens}
              onChange={(e) => setFormData({...formData, tokens: parseInt(e.target.value)})}
            />
          </div>
          <div className="space-y-2">
            <Label>IGD</Label>
            <Input
              type="number"
              value={formData.cat_dollars}
              onChange={(e) => setFormData({...formData, cat_dollars: parseInt(e.target.value)})}
            />
          </div>
          <div className="space-y-2">
            <Label>Price ($)</Label>
            <Input
              type="number"
              step="0.01"
              value={formData.price}
              onChange={(e) => setFormData({...formData, price: parseFloat(e.target.value)})}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Badge (optional)</Label>
          <Input
            value={formData.badge}
            onChange={(e) => setFormData({...formData, badge: e.target.value})}
            placeholder="e.g., Best Value"
          />
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Switch
              checked={formData.is_active}
              onCheckedChange={(v) => setFormData({...formData, is_active: v})}
            />
            <Label>Active</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={formData.is_featured}
              onCheckedChange={(v) => setFormData({...formData, is_featured: v})}
            />
            <Label>Featured</Label>
          </div>
        </div>

        <Button onClick={() => onSave(formData)} className="w-full bg-gradient-to-r from-pink-500 to-pink-600">
          <Save className="w-4 h-4 mr-2" />
          {pack ? 'Update Pack' : 'Create Pack'}
        </Button>
      </div>
    );
  };

  const isTester = user?.role === 'tester';

  return (
    <div className="min-h-screen bg-[#0A0612] p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-white">Admin Dashboard</h1>
          <p className="text-gray-400">{isTester ? 'Read-only view — Tester access' : 'Manage your casino games and token packs'}</p>
          {isTester && (
            <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-yellow-500/20 border border-yellow-500/30 rounded-full text-yellow-400 text-sm">
              🔒 Tester Mode — View Only
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Active Games', value: activeGames, icon: Gamepad2, color: 'green' },
            { label: 'Total Players', value: wallets.length, icon: Users, color: 'blue' },
            { label: 'Tokens in Circulation', value: totalTokensInCirculation.toLocaleString(), icon: Coins, color: 'amber' },
            { label: 'Total Purchases', value: totalRevenue.toLocaleString(), icon: TrendingUp, color: 'purple' },
          ].map((stat) => (
            <Card key={stat.label} className="bg-white/5 border-white/10">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl bg-${stat.color}-500/20`}>
                    <stat.icon className={`w-6 h-6 text-${stat.color}-400`} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">{stat.label}</p>
                    <p className="text-2xl font-bold text-white">{stat.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="games" className="space-y-6">
          <TabsList className="bg-white/5 border border-white/10">
            <TabsTrigger value="games" className="data-[state=active]:bg-pink-500">
              <Gamepad2 className="w-4 h-4 mr-2" />
              Games
            </TabsTrigger>
            <TabsTrigger value="packs" className="data-[state=active]:bg-pink-500">
              <Package className="w-4 h-4 mr-2" />
              Token Packs
            </TabsTrigger>
            <TabsTrigger value="crash" className="data-[state=active]:bg-pink-500">
              <Zap className="w-4 h-4 mr-2" />
              Crash Rounds
            </TabsTrigger>
            <TabsTrigger value="vip" className="data-[state=active]:bg-pink-500">
              <Crown className="w-4 h-4 mr-2" />
              VIP System
            </TabsTrigger>
            <TabsTrigger value="withdrawals" className="data-[state=active]:bg-pink-500">
              <DollarSign className="w-4 h-4 mr-2" />
              Withdrawals
            </TabsTrigger>
            <TabsTrigger value="vouchers" className="data-[state=active]:bg-pink-500">
              <Ticket className="w-4 h-4 mr-2" />
              Vouchers
            </TabsTrigger>
            <TabsTrigger value="poker" className="data-[state=active]:bg-pink-500">
              ♠ Poker
            </TabsTrigger>
            <TabsTrigger value="wheel" className="data-[state=active]:bg-pink-500">
              🎡 Spin Wheel
            </TabsTrigger>
            <TabsTrigger value="blackjack" className="data-[state=active]:bg-pink-500">
              🃏 Blackjack
            </TabsTrigger>
            <TabsTrigger value="weekly-tournaments" className="data-[state=active]:bg-pink-500">
              🏆 Weekly Tournaments
            </TabsTrigger>
            <TabsTrigger value="slot-drops" className="data-[state=active]:bg-pink-500">
              🎰 Slot Drops
            </TabsTrigger>
            <TabsTrigger value="originals-drops" className="data-[state=active]:bg-pink-500">
              🎮 Originals Drops
            </TabsTrigger>
            <TabsTrigger value="sweepstakes-audit" className="data-[state=active]:bg-pink-500">
              <FileSearch className="w-4 h-4 mr-2" />
              Sweepstakes Audit
            </TabsTrigger>
          </TabsList>

          {/* Games Tab */}
          <TabsContent value="games">
            <Card className="bg-white/5 border-white/10">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-white">Games</CardTitle>
                {!isTester && <Dialog open={gameDialogOpen} onOpenChange={setGameDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => setEditingGame(null)} className="bg-gradient-to-r from-pink-500 to-pink-600">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Game
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-[#1A1528] border-white/10 text-white max-w-lg">
                    <DialogHeader>
                      <DialogTitle>{editingGame ? 'Edit Game' : 'New Game'}</DialogTitle>
                    </DialogHeader>
                    <GameForm
                      game={editingGame}
                      onSave={(data) => {
                        if (editingGame) {
                          updateGameMutation.mutate({ id: editingGame.id, data });
                        } else {
                          createGameMutation.mutate(data);
                        }
                      }}
                    />
                  </DialogContent>
                </Dialog>}
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {games.map((game) => (
                    <div key={game.id} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-pink-500 to-pink-600 flex items-center justify-center">
                          <Gamepad2 className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-white">{game.name}</h3>
                            {game.is_featured && <Star className="w-4 h-4 text-pink-400 fill-pink-400" />}
                          </div>
                          <p className="text-sm text-gray-400">{game.category} • {game.slug}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`px-3 py-1 rounded-full text-xs ${game.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                          {game.is_active ? 'Active' : 'Inactive'}
                        </div>
                        {!isTester && <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingGame(game);
                              setGameDialogOpen(true);
                            }}
                          >
                            <Edit className="w-4 h-4 text-gray-400" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteGameMutation.mutate(game.id)}
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </Button>
                        </>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Token Packs Tab */}
          <TabsContent value="packs">
            <Card className="bg-white/5 border-white/10">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-white">Token Packs</CardTitle>
                {!isTester && <Dialog open={packDialogOpen} onOpenChange={setPackDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => setEditingPack(null)} className="bg-gradient-to-r from-pink-500 to-pink-600">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Pack
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-[#1A1528] border-white/10 text-white max-w-lg">
                    <DialogHeader>
                      <DialogTitle>{editingPack ? 'Edit Token Pack' : 'New Token Pack'}</DialogTitle>
                    </DialogHeader>
                    <PackForm
                      pack={editingPack}
                      onSave={(data) => {
                        if (editingPack) {
                          updatePackMutation.mutate({ id: editingPack.id, data });
                        } else {
                          createPackMutation.mutate(data);
                        }
                      }}
                    />
                  </DialogContent>
                </Dialog>}
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {packs.map((pack) => (
                    <div key={pack.id} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-pink-500 to-pink-600 flex items-center justify-center">
                          <Coins className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-white">{pack.name}</h3>
                            {pack.badge && (
                              <span className="px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-400 text-xs">
                                {pack.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-400">
                            {pack.tokens.toLocaleString()} CENT
                            {pack.cat_dollars > 0 && ` + ${pack.cat_dollars} IGD`}
                            • ${pack.price}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`px-3 py-1 rounded-full text-xs ${pack.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                          {pack.is_active ? 'Active' : 'Inactive'}
                        </div>
                        {!isTester && <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingPack(pack);
                              setPackDialogOpen(true);
                            }}
                          >
                            <Edit className="w-4 h-4 text-gray-400" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deletePackMutation.mutate(pack.id)}
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </Button>
                        </>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Crash Rounds Tab */}
          <TabsContent value="crash">
            <CrashRoundManager />
          </TabsContent>

          {/* VIP System Tab */}
          <TabsContent value="vip">
            <VIPManager />
          </TabsContent>

          {/* Withdrawals Tab */}
          <TabsContent value="withdrawals">
            <WithdrawalManager />
          </TabsContent>

          {/* Vouchers Tab */}
          <TabsContent value="vouchers">
            <VoucherManager />
          </TabsContent>

          {/* Wheel Tab */}
          <TabsContent value="wheel">
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-6">
                <WheelRewardManager />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Blackjack Tab */}
          <TabsContent value="blackjack">
            <BlackjackTableManager />
          </TabsContent>

          {/* Weekly Tournaments Tab */}
          <TabsContent value="weekly-tournaments">
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-6">
                <WeeklyTournamentManager />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="slot-drops">
            <SlotDropSettings isTester={isTester} />
          </TabsContent>

          <TabsContent value="originals-drops">
            <OriginalsWinLoseSettings isTester={isTester} />
          </TabsContent>

          {/* Poker Tab */}
          <TabsContent value="poker">
            <div className="space-y-8">
              <Card className="bg-white/5 border-white/10">
                <CardContent className="p-6">
                  <RakeSettings />
                </CardContent>
              </Card>
              <Card className="bg-white/5 border-white/10">
                <CardContent className="p-6">
                  <SitAndGoManager />
                </CardContent>
              </Card>
              <Card className="bg-white/5 border-white/10">
                <CardContent className="p-6">
                  {user?.role==='superadmin'&&<a href="/SuperadminPokerTournaments" className="mb-4 inline-flex rounded-lg bg-amber-400 px-5 py-3 font-black text-gray-950">Configure 6–8 Seat / 1–30 Table Poker Tournaments →</a>}
                  <TournamentManager />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="sweepstakes-audit">
            <AdminSweepstakesAudit />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}