import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save } from 'lucide-react';
import { toast } from 'sonner';

export default function RakeSettings() {
  const [settings, setSettings] = useState(null);
  const [rakePercent, setRakePercent] = useState(5);
  const [rakeMaxBB, setRakeMaxBB] = useState(3);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const all = await base44.entities.PokerSettings.list();
      if (all.length > 0) {
        setSettings(all[0]);
        setRakePercent(all[0].rake_percentage ?? 5);
        setRakeMaxBB(all[0].rake_max_bb ?? 3);
      }
    };
    load();
  }, []);

  const save = async () => {
    setSaving(true);
    if (settings) {
      await base44.entities.PokerSettings.update(settings.id, {
        rake_percentage: parseFloat(rakePercent),
        rake_max_bb: parseFloat(rakeMaxBB)
      });
    } else {
      const created = await base44.entities.PokerSettings.create({
        rake_percentage: parseFloat(rakePercent),
        rake_max_bb: parseFloat(rakeMaxBB)
      });
      setSettings(created);
    }
    setSaving(false);
    toast.success('Rake settings saved');
  };

  return (
    <div>
      <h2 className="text-white font-bold text-lg mb-1">Rake Settings</h2>
      <p className="text-gray-400 text-sm mb-4">Applied globally across all Sit & Go tables</p>

      <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4 max-w-sm">
        <div>
          <Label className="text-gray-300">Rake Percentage</Label>
          <div className="flex items-center gap-2 mt-1">
            <Input
              type="number"
              min={0}
              max={25}
              step={0.5}
              value={rakePercent}
              onChange={(e) => setRakePercent(e.target.value)}
              className="bg-white/5 border-white/10 text-white w-28"
            />
            <span className="text-gray-400">%</span>
          </div>
          <p className="text-gray-500 text-xs mt-1">% of each pot taken as rake</p>
        </div>

        <div>
          <Label className="text-gray-300">Max Rake Cap (in BB)</Label>
          <div className="flex items-center gap-2 mt-1">
            <Input
              type="number"
              min={0}
              max={50}
              step={0.5}
              value={rakeMaxBB}
              onChange={(e) => setRakeMaxBB(e.target.value)}
              className="bg-white/5 border-white/10 text-white w-28"
            />
            <span className="text-gray-400">BB</span>
          </div>
          <p className="text-gray-500 text-xs mt-1">Rake will never exceed this many big blinds</p>
        </div>

        <div className="pt-1 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2 text-yellow-300 text-xs">
          Example: 5% rake, 3 BB cap → on a 10 BB pot, rake = 0.5 BB (5%). On a 100 BB pot, rake = 3 BB (capped).
        </div>

        <Button onClick={save} disabled={saving} className="bg-pink-500 hover:bg-pink-600 w-full">
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : 'Save Rake Settings'}
        </Button>
      </div>
    </div>
  );
}