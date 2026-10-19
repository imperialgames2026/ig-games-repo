import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { requireSupabase } from '@/lib/supabaseClient';
import { Trophy } from 'lucide-react';

// The preserved original layout uses this card on Home. This read-only replacement
// deliberately labels the new Supabase leaderboard as practice-only, not IGN/IGT.
export default function WeeklyTokenLeaderboard() {
  const { data, isPending, error } = useQuery({
    queryKey: ['staging-practice-leaderboard'],
    queryFn: async () => {
      const { data, error } = await requireSupabase().functions.invoke('legacy-leaderboard-v1', {
        body: { action: 'getWeeklyTokenLeaderboard' },
      });
      if (error || data?.success !== true || data?.practiceOnly !== true) {
        throw new Error(data?.error || error?.message || 'Practice leaderboard unavailable');
      }
      return data;
    },
    retry: 1,
    refetchInterval: 60_000,
  });
  const entries = Array.isArray(data?.leaderboard) ? data.leaderboard : [];
  return <section aria-label="Staging practice leaderboard"
    className="mb-10 rounded-3xl border border-pink-500/20 bg-[#151024] p-6 text-white shadow-xl">
    <div className="flex items-center gap-3">
      <Trophy className="h-6 w-6 text-amber-300" aria-hidden="true" />
      <div>
        <h2 className="text-xl font-bold">Weekly practice-coin wins</h2>
        <p className="text-sm text-gray-400">Staging test data only. Pseudonymous names; no cash, IGN or IGT prizes.</p>
      </div>
    </div>
    {isPending && <p role="status" className="mt-4 text-gray-300">Loading practice results…</p>}
    {error && <p role="alert" className="mt-4 text-amber-200">Practice leaderboard is unavailable right now.</p>}
    {!isPending && !error && entries.length === 0 &&
      <p className="mt-4 text-gray-300">No completed practice wins this week.</p>}
    <ol className="mt-4 space-y-2">
      {entries.map(({ rank, name, total_won }) => <li key={rank}
        className="flex justify-between gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
        <span>#{rank} · {name}</span>
        <strong>{Number(total_won).toLocaleString(undefined, { maximumFractionDigits: 2 })} practice coins</strong>
      </li>)}
    </ol>
  </section>;
}
