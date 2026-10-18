import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Zap, RefreshCw, Plus, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function CrashRoundManager() {
  const [generating, setGenerating] = useState(false);
  const [count, setCount] = useState(25);

  // Custom rounds state
  const [customInput, setCustomInput] = useState('');
  const [customRows, setCustomRows] = useState([{ value: '' }]);
  const [customGenerating, setCustomGenerating] = useState(false);
  const [customMode, setCustomMode] = useState('bulk'); // 'bulk' | 'manual'

  const { data: stats = {}, refetch } = useQuery({
    queryKey: ['crash-round-stats'],
    queryFn: async () => {
      const pending = await base44.asServiceRole.entities.CrashRound.filter({ status: 'pending' });
      const live = await base44.asServiceRole.entities.CrashRound.filter({ status: 'live' });
      const completed = await base44.asServiceRole.entities.CrashRound.filter({ status: 'completed' });
      return { pending: pending.length, live: live.length, completed: completed.length };
    },
    refetchInterval: 5000
  });

  const handleGenerateRounds = async () => {
    setGenerating(true);
    try {
      const { data } = await base44.functions.invoke('generateCrashRounds', { count });
      refetch();
      alert(`✓ Generated ${data.generated} rounds (starting at round ${data.starting_round})`);
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleCustomGenerate = async () => {
    let crashPoints = [];
    if (customMode === 'bulk') {
      crashPoints = customInput
        .split(/[\n,\s]+/)
        .map(v => parseFloat(v.trim()))
        .filter(v => !isNaN(v) && v >= 1);
    } else {
      crashPoints = customRows
        .map(r => parseFloat(r.value))
        .filter(v => !isNaN(v) && v >= 1);
    }

    if (crashPoints.length === 0) {
      alert('Please enter at least one valid crash point (≥ 1.00)');
      return;
    }
    if (crashPoints.length > 100) {
      alert('Max 100 rounds at a time');
      return;
    }

    setCustomGenerating(true);
    try {
      const { data } = await base44.functions.invoke('generateCrashRoundsCustom', { crashPoints });
      refetch();
      alert(`✓ Generated ${data.generated} custom rounds (starting at round ${data.starting_round})`);
      setCustomInput('');
      setCustomRows([{ value: '' }]);
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setCustomGenerating(false);
    }
  };

  const addRow = () => setCustomRows(prev => [...prev, { value: '' }]);
  const removeRow = (i) => setCustomRows(prev => prev.filter((_, idx) => idx !== i));
  const updateRow = (i, value) => setCustomRows(prev => prev.map((r, idx) => idx === i ? { value } : r));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-[#1A1528] to-[#0F0A1E] border border-white/10 rounded-2xl p-6"
    >
      <h2 className="text-2xl font-bold text-white mb-6">Crash Round Manager</h2>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white/5 rounded-lg p-4 border border-white/10">
          <div className="text-sm text-gray-400 mb-1">Pending</div>
          <div className="text-3xl font-bold text-blue-400">{stats.pending || 0}</div>
        </div>
        <div className="bg-white/5 rounded-lg p-4 border border-white/10">
          <div className="text-sm text-gray-400 mb-1">Live</div>
          <div className="text-3xl font-bold text-green-400">{stats.live || 0}</div>
        </div>
        <div className="bg-white/5 rounded-lg p-4 border border-white/10">
          <div className="text-sm text-gray-400 mb-1">Completed</div>
          <div className="text-3xl font-bold text-purple-400">{stats.completed || 0}</div>
        </div>
      </div>

      <Tabs defaultValue="random">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="random">Random Rounds</TabsTrigger>
          <TabsTrigger value="custom">Custom Rounds</TabsTrigger>
        </TabsList>

        {/* Random Tab */}
        <TabsContent value="random">
          <div className="bg-white/5 rounded-lg p-4 border border-white/10 space-y-3">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Rounds to Generate</label>
              <input
                type="number"
                value={count}
                onChange={(e) => setCount(e.target.value === '' ? '' : Math.min(100, parseInt(e.target.value) || 1))}
                onBlur={(e) => setCount(Math.max(1, Math.min(100, parseInt(e.target.value) || 25)))}
                min="1"
                max="100"
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white outline-none"
              />
              <p className="text-xs text-gray-500 mt-1">Min: 1, Max: 100 per batch</p>
            </div>
            <Button
              onClick={handleGenerateRounds}
              disabled={generating}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold h-12"
            >
              {generating ? (
                <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Generating...</>
              ) : (
                <><Zap className="w-4 h-4 mr-2" />Generate {count} Rounds</>
              )}
            </Button>
          </div>
        </TabsContent>

        {/* Custom Tab */}
        <TabsContent value="custom">
          <div className="bg-white/5 rounded-lg p-4 border border-white/10 space-y-4">
            <p className="text-sm text-gray-400">
              Manually specify crash points for upcoming rounds. These will be queued in order. Min value: <span className="text-white font-bold">1.00</span>
            </p>

            {/* Mode toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => setCustomMode('manual')}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-all ${customMode === 'manual' ? 'bg-pink-500/20 border-pink-500/50 text-pink-300' : 'bg-white/5 border-white/10 text-gray-400'}`}
              >
                Manual Entry
              </button>
              <button
                onClick={() => setCustomMode('bulk')}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-all ${customMode === 'bulk' ? 'bg-pink-500/20 border-pink-500/50 text-pink-300' : 'bg-white/5 border-white/10 text-gray-400'}`}
              >
                Bulk Paste
              </button>
            </div>

            {customMode === 'manual' ? (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {customRows.map((row, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-gray-500 text-xs w-6 text-right">{i + 1}.</span>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      value={row.value}
                      onChange={(e) => updateRow(i, e.target.value)}
                      placeholder="e.g. 2.50"
                      className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white outline-none text-sm"
                    />
                    <button
                      onClick={() => removeRow(i)}
                      disabled={customRows.length === 1}
                      className="text-red-400 hover:text-red-300 disabled:opacity-30 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={addRow}
                  disabled={customRows.length >= 100}
                  className="w-full mt-2 py-2 border border-dashed border-white/20 rounded-lg text-gray-400 hover:text-white hover:border-white/40 text-sm flex items-center justify-center gap-1 transition-all disabled:opacity-30"
                >
                  <Plus className="w-4 h-4" /> Add Row ({customRows.length}/100)
                </button>
              </div>
            ) : (
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Paste crash points (one per line, or comma/space separated)
                </label>
                <textarea
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  placeholder={"1.00\n2.50\n5.00\n1.00\n10.00"}
                  rows={8}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white outline-none text-sm font-mono resize-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {customInput.split(/[\n,\s]+/).filter(v => !isNaN(parseFloat(v)) && parseFloat(v) >= 1).length} valid values detected
                </p>
              </div>
            )}

            <Button
              onClick={handleCustomGenerate}
              disabled={customGenerating}
              className="w-full bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white font-bold h-12"
            >
              {customGenerating ? (
                <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Generating...</>
              ) : (
                <><Zap className="w-4 h-4 mr-2" />Queue Custom Rounds</>
              )}
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {stats.pending < 50 && (
        <div className="p-3 bg-yellow-900/30 border border-yellow-500/30 rounded-lg mt-4">
          <p className="text-yellow-300 text-sm">
            ⚠️ Low on pending rounds ({stats.pending}). Consider generating more to keep the game running smoothly.
          </p>
        </div>
      )}

      <div className="mt-4 p-3 bg-blue-900/30 border border-blue-500/30 rounded-lg">
        <p className="text-blue-300 text-sm">
          ✅ Auto-replenish is active — runs every 5 minutes to keep 100+ pending rounds in queue.
        </p>
      </div>
    </motion.div>
  );
}