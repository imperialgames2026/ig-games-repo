import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const ORIGINAL_GAMES = [
  { slug: 'stellar-rush', name: 'Stellar Rush' },
  { slug: 'dice', name: 'Dice' },
  { slug: 'dice-zone', name: 'Dice Zone' },
  { slug: 'mines', name: 'Mines' },
  { slug: 'plinko', name: 'Plinko' },
  { slug: 'towers', name: 'Towers' },
  { slug: 'wheel', name: 'Wheel' },
  { slug: 'hilo', name: 'Hi-Lo' },
  { slug: 'coinflip', name: 'Coin Flip' },
  { slug: 'hashdice', name: 'Hash Dice' },
  { slug: 'limbo', name: 'Limbo' },
];

const DEFAULT_SETTINGS = {
  game_slug: 'stellar-rush',
  lose_weight: 100,
  sx_weight: 100,
  mx_weight: 35,
  lx_weight: 12,
  xl_weight: 4,
  xxl_weight: 1,
  is_active: true,
};

const FIELDS = [
  { key: 'lose_weight', label: 'Lose', helper: 'No win' },
  { key: 'sx_weight', label: 'SX', helper: '1.01x-6.0x' },
  { key: 'mx_weight', label: 'MX', helper: '6.01x-16.0x' },
  { key: 'lx_weight', label: 'LX', helper: '16.01x-33.0x' },
  { key: 'xl_weight', label: 'XL', helper: '33.01x-133.0x' },
  { key: 'xxl_weight', label: 'XXL', helper: '133.01x-1200.00x' },
];

export default function OriginalsWinLoseSettings({ isTester = false }) {
  const queryClient = useQueryClient();
  const [selectedGame, setSelectedGame] = useState('stellar-rush');
  const [formData, setFormData] = useState(DEFAULT_SETTINGS);

  const { data: settings = [] } = useQuery({
    queryKey: ['original-game-settings', selectedGame],
    queryFn: () => base44.entities.OriginalGameSetting.filter({ game_slug: selectedGame }),
  });

  const setting = settings[0];

  useEffect(() => {
    setFormData({
      ...DEFAULT_SETTINGS,
      game_slug: selectedGame,
      ...(setting || {}),
    });
  }, [selectedGame, setting]);

  const saveMutation = useMutation({
    mutationFn: (data) => setting
      ? base44.entities.OriginalGameSetting.update(setting.id, data)
      : base44.entities.OriginalGameSetting.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['original-game-settings', selectedGame] });
      toast.success('Originals win/loss settings saved');
    },
  });

  const updateNumber = (field, value) => {
    const cleanValue = value.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');
    setFormData((current) => ({ ...current, [field]: cleanValue }));
  };

  const saveSettings = () => {
    const payload = { game_slug: selectedGame, is_active: true };
    FIELDS.forEach(({ key }) => { payload[key] = Number(formData[key]) || 0; });
    saveMutation.mutate(payload);
  };

  return (
    <Card className="bg-white/5 border-white/10">
      <CardHeader>
        <CardTitle className="text-white">Originals Server-Side Win/Loss Controls</CardTitle>
        <p className="text-sm text-gray-400">SSRCR reads these category weights server-side. Higher numbers make that outcome group more likely.</p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="max-w-sm space-y-2">
          <Label className="text-gray-300">Original Game</Label>
          <Select value={selectedGame} onValueChange={setSelectedGame}>
            <SelectTrigger className="bg-black/30 border-white/10 text-white"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-[#1A1528] border-white/10 text-white">
              {ORIGINAL_GAMES.map((game) => (
                <SelectItem key={game.slug} value={game.slug}>{game.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {FIELDS.map((field) => (
            <div key={field.key} className="space-y-2">
              <Label className="text-gray-300">{field.label}</Label>
              <Input
                type="number"
                min="0"
                value={formData[field.key]}
                onChange={(e) => updateNumber(field.key, e.target.value)}
                disabled={isTester}
                className="bg-black/30 border-white/10 text-white"
              />
              <p className="text-xs text-gray-500">{field.helper}</p>
            </div>
          ))}
        </div>

        {!isTester && (
          <Button
            onClick={saveSettings}
            disabled={saveMutation.isPending}
            className="bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Originals Settings
          </Button>
        )}
      </CardContent>
    </Card>
  );
}