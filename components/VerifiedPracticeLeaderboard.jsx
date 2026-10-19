import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { requireSupabase } from '@/lib/supabaseClient';
import { Trophy, RefreshCw, ShieldCheck, Crown } from 'lucide-react';

export default function VerifiedPracticeLeaderboard() {
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const { data, error: invokeError } = await requireSupabase().functions.invoke('legacy-leaderboard-v1', {
        body: { action: 'getWeeklyTokenLeaderboard' },
      });
      if (invokeError) throw invokeError;
      if (!data?.success || data.practiceOnly !== true || !Array.isArray(data.leaderboard)) {
        throw new Error('Unexpected practice leaderboard response');
      }
      setResult(data);
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : 'Leaderboard unavailable');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  return <main className="bg-[#0A0612] text-white min-h-screen pb-24">
    <header className="bg-gradient-to-r from-[#301a35] to-[#121b31] border-b border-white/10">
      <div className="max-w-4xl mx-auto px-4 py-10">
        <Link to="/Games" className="text-amber-300 text-sm hover:underline">← Games library</Link>
        <div className="flex justify-between flex-wrap items-start gap-5 mt-5">
          <div>
            <h1 className="text-3xl sm:text-5xl font-black flex items-center gap-3"><Crown className="text-amber-300" size={36}/> Weekly Practice Board</h1>
            <p className="text-gray-300 mt-3">Anonymous display names and server-aggregated practice results only.</p>
          </div>
          <button disabled={loading} type="button" onClick={() => void refresh()} className="flex gap-2 items-center bg-amber-400 text-gray-950 font-black rounded-xl px-5 py-3 disabled:opacity-50"><RefreshCw size={17}/> Refresh</button>
        </div>
      </div>
    </header>
    <section className="max-w-4xl mx-auto px-4 py-8">
      <p className="border border-amber-500/30 text-amber-100 bg-amber-500/5 rounded-xl p-4 text-sm mb-6 flex gap-2">
        <ShieldCheck size={20} className="shrink-0"/> Legacy nonredeemable practice CENT results, not IGN, IGD, deposits, or monetary winnings. Rankings carry no prizes.
      </p>
      {loading && <p role="status" className="text-center text-gray-300 py-12">Loading server-confirmed weekly results…</p>}
      {error && <div role="alert" className="p-5 rounded-xl border border-rose-500/50 text-rose-300">
        {error} <button type="button" className="underline ml-3" onClick={() => void refresh()}>Retry</button>
      </div>}
      {result && <>
        <p className="text-gray-400 text-sm mb-4">Current UTC week starts: {new Date(result.week_start).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric',timeZone:'UTC'})}</p>
        {result.leaderboard.length === 0 ? <div className="bg-[#191528] border border-white/10 rounded-2xl p-12 text-center">
          <Trophy className="mx-auto text-amber-300" size={48}/>
          <h2 className="text-xl font-bold mt-4">No eligible practice results yet</h2>
          <p className="text-gray-400 mt-2">Rankings will appear after verified practice activity is recorded.</p>
        </div> : <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#191528]">
          <table className="min-w-full text-left">
            <thead className="text-sm text-gray-400 border-b border-white/10">
              <tr><th scope="col" className="py-4 px-5">Rank</th><th scope="col" className="py-4 px-5">Display name</th><th scope="col" className="py-4 px-5 text-right">Verified practice total</th></tr>
            </thead>
            <tbody>{result.leaderboard.map((row, i) =>
              <tr key={row.rank+'-'+i} className="border-b border-white/5">
                <td className="py-4 px-5 font-bold text-amber-300">{row.rank === 1?'🥇':row.rank===2?'🥈':row.rank===3?'🥉':'#'+row.rank}</td>
                <td className="py-4 px-5 break-words">{row.name || 'Player'}</td>
                <td className="py-4 px-5 text-right font-bold text-amber-200">{Number(row.total_won || 0).toLocaleString(undefined,{maximumFractionDigits:2})}</td>
              </tr>)}</tbody>
          </table>
        </div>}
      </>}
    </section>
  </main>;
}
