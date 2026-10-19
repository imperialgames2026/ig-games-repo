import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { requireSupabase } from '@/lib/supabaseClient';
import { ShieldCheck, RefreshCw, BarChart3, BookOpen, Target } from 'lucide-react';

const METRICS = [["vpip","VPIP","Voluntary preflop investment"],["pfr","PFR","Preflop raise"],["threeBet","3-Bet","Three-bets / opportunities"],["foldToThreeBet","Fold to 3-Bet","Folds when facing a 3-bet"],["flopCBet","Flop C-Bet","Continuation bet frequency"],["foldToFlopCBet","Fold to C-Bet","Facing a flop continuation bet"],["steal","Steal","Blind steal attempts"],["blindDefense","Blind Defense","Blind defense frequency"],["wentToShowdown","WTSD","Reached showdown after seeing flop"],["wonAtShowdown","W$SD","Won showdowns / showdowns seen"],["wonWhenSawFlop","WWSF","Won when seeing flop"],["handsWon","Hands Won","Won / recorded hands"]];
function PercentStat({ item, result }) {
  return <article className="rounded-2xl border border-white/10 bg-[#18182c] p-5">
    <p className="font-bold text-sm text-gray-300">{item[1]}</p>
    <p className="text-3xl text-amber-200 font-black mt-2" style={{fontVariantNumeric:'tabular-nums'}}>
      {result?.percent == null ? 'N/A' : Number(result.percent).toFixed(2) + '%'}
    </p>
    <p className="text-xs text-gray-400 mt-2">{item[2]}</p>
    <p className="text-xs text-gray-500 mt-2">{result ? result.numerator + ' / ' + result.denominator + ' opportunities' : 'No records'}</p>
  </article>;
}
export default function VerifiedPlayerAnalytics() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const { data: body, error: invokeError } =
        await requireSupabase().functions.invoke('ig-player-analytics-v1', { body: { action: 'mine' } });
      if (invokeError) throw invokeError;
      if (!body || body.practiceOnly !== true || body.realMoneyEnabled !== false ||
          body.source !== 'server_archived_completed_hands') throw new Error('Invalid analytics response');
      setData(body);
    } catch (e) { setError(e instanceof Error ? e.message : 'Analytics unavailable'); setData(null); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  return <main className="min-h-screen text-white bg-[#0A0612] pb-20">
    <header className="bg-gradient-to-r from-[#2c1833] via-[#19152d] to-[#111d35] border-b border-white/10">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <Link to="/Profile" className="text-amber-300 hover:underline text-sm">← Player profile</Link>
        <div className="flex flex-wrap justify-between items-start gap-4 mt-4">
          <div><h1 className="text-3xl sm:text-5xl font-black">Verified Player Analytics</h1>
            <p className="text-gray-300 mt-3 max-w-xl">Private post-hand poker statistics from server-archived completed hands, not opponent tracking.</p>
          </div>
          <button type="button" disabled={loading} onClick={() => void load()} className="flex items-center gap-2 rounded-xl px-5 py-3 bg-amber-400 text-slate-950 font-bold disabled:opacity-50">
            <RefreshCw size={16}/> Refresh statistics
          </button>
        </div>
      </div>
    </header>
    <div className="max-w-6xl mx-auto px-4 py-8">
      <p className="p-4 border border-amber-500/30 rounded-xl text-sm text-amber-100 bg-amber-900/10 mb-6">
        Staging practice analytics only. No financial P&amp;L, wagers, rewards or IGN transfers.
      </p>
      {loading && <p role="status" className="p-8 text-center">Loading verified server data…</p>}
      {error && <div role="alert" className="p-5 text-rose-300 border border-rose-600/40 rounded-xl">
        {error} <button type="button" className="underline ml-3" onClick={() => void load()}>Retry</button>
      </div>}
      {data && <>
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <article className="rounded-2xl p-5 border border-white/10 bg-[#18182c]">
            <p className="text-gray-400 text-sm">Verified player</p>
            <p className="text-xl font-bold mt-2 break-words">{data.player?.displayName || user?.username || 'Imperial Player'}</p>
            <p className="text-xs text-gray-500 mt-2">You can only access your own analytics.</p>
          </article>
          <article className="rounded-2xl p-5 border border-white/10 bg-[#18182c]">
            <p className="flex gap-2 items-center text-gray-400 text-sm"><BarChart3 size={16}/> Hands sampled</p>
            <p className="text-3xl font-black text-amber-200 mt-2">{Number(data.sample?.hands ?? 0).toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-2">{data.sample?.sampled ? 'Latest sample, not entire career' : 'All verified archived hands available'}</p>
          </article>
          <article className="rounded-2xl p-5 border border-white/10 bg-[#18182c]">
            <p className="flex gap-2 items-center text-gray-400 text-sm"><ShieldCheck size={16}/> Skill score (0–1000)</p>
            <p className="text-3xl font-black text-amber-200 mt-2">{data.skillScore?.value == null ? 'N/A' : data.skillScore.value}</p>
            <p className="text-xs text-gray-500 mt-2">{data.skillScore?.label || 'Insufficient data'}</p>
          </article>
        </section>
        <h2 className="font-black text-2xl mb-4 flex items-center gap-2"><Target className="text-pink-400" size={22}/> Poker Statistics</h2>
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {METRICS.map(item => <PercentStat key={item[0]} item={item} result={data.stats?.[item[0]]}/>)}
        </section>
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
          <article className="rounded-2xl border border-white/10 bg-[#18182c] p-5">
            <p className="text-gray-300 font-bold">Aggression factor</p>
            <p className="text-3xl text-amber-200 font-black mt-2">{data.stats?.aggressionFactor == null ? 'N/A' : Number(data.stats.aggressionFactor).toFixed(2)}</p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-[#18182c] p-5">
            <p className="text-gray-300 font-bold">Net BB / 100 hands</p>
            <p className="text-3xl text-amber-200 font-black mt-2">{data.stats?.netBBPer100 == null ? 'N/A' : Number(data.stats.netBBPer100).toFixed(2)}</p>
          </article>
        </section>
        <div className="rounded-xl border border-white/10 bg-[#141b2b] p-5 mt-6">
          <h3 className="flex gap-2 items-center font-bold"><BookOpen size={18}/> About your score</h3>
          <p className="text-sm text-gray-400 mt-2">Percentages are based on verified opportunity counts. A rate with no valid denominator is N/A, never a fabricated 0%. A provisional skill score requires at least 100 completed hands and 50 independently graded post-hand decisions using a single grader version. It is not a predictor of profit.</p>
          {data.sample?.sampled && <p className="text-sm text-amber-200 mt-2">Only the latest {data.sample.hands} hands of {data.sample.totalHandsRecorded} are included; lifetime rates may differ.</p>}
        </div>
      </>}
    </div>
  </main>;
}
