import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const DEFAULT_SETTINGS = {
  slot_type: 'farmageddon',
  high_weight: 10,
  medium_weight: 76,
  low_weight: 300,
};

export default function SlotDropSettings({ isTester = false }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState(DEFAULT_SETTINGS);

  const { data: settings = [] } = useQuery({
    queryKey: ['slot-settings', 'farmageddon'],
    queryFn: () => base44.entities.SlotSetting.filter({ slot_type: 'farmageddon' }),
  });

  const setting = settings[0];

  useEffect(() => {
    if (setting) {
      setFormData({
        slot_type: 'farmageddon',
        high_weight: setting.high_weight ?? DEFAULT_SETTINGS.high_weight,
        medium_weight: setting.medium_weight ?? DEFAULT_SETTINGS.medium_weight,
        low_weight: setting.low_weight ?? DEFAULT_SETTINGS.low_weight,
      });
    }
  }, [setting]);

  const saveMutation = useMutation({
    mutationFn: (data) => setting
      ? base44.entities.SlotSetting.update(setting.id, data)
      : base44.entities.SlotSetting.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slot-settings', 'farmageddon'] });
      toast.success('Farmageddon drop settings saved');
    },
  });

  const updateNumber = (field, value) => {
    const cleanValue = value.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');
    setFormData((current) => ({
      ...current,
      [field]: cleanValue,
    }));
  };

  const saveSettings = () => {
    saveMutation.mutate({
      slot_type: 'farmageddon',
      high_weight: Number(formData.high_weight) || 0,
      medium_weight: Number(formData.medium_weight) || 0,
      low_weight: Number(formData.low_weight) || 0,
    });
  };

  return (
    <Card className="bg-white/5 border-white/10">
      <CardHeader>
        <CardTitle className="text-white">Farmageddon SSRCR Drop Controls</CardTitle>
        <p className="text-sm text-gray-400">These values are read by the server before each SSRCR spin. Higher numbers drop more often.</p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="text-gray-300">High Symbols</Label>
            <Input
              type="number"
              min="0"
              value={formData.high_weight}
              onChange={(e) => updateNumber('high_weight', e.target.value)}
              disabled={isTester}
              className="bg-black/30 border-white/10 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-300">Medium Symbols</Label>
            <Input
              type="number"
              min="0"
              value={formData.medium_weight}
              onChange={(e) => updateNumber('medium_weight', e.target.value)}
              disabled={isTester}
              className="bg-black/30 border-white/10 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-300">Low Symbols</Label>
            <Input
              type="number"
              min="0"
              value={formData.low_weight}
              onChange={(e) => updateNumber('low_weight', e.target.value)}
              disabled={isTester}
              className="bg-black/30 border-white/10 text-white"
            />
          </div>
        </div>

        {!isTester && (
          <Button
            onClick={saveSettings}
            disabled={saveMutation.isPending}
            className="bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700"
          >
            <Save className="w-4 h-4 mr-2" />
            Save SSRCR Drops
          </Button>
        )}
      </CardContent>
    </Card>
  );
}