import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CircleAlert, LoaderCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { readApprovedPracticeGames } from '@/lib/supabaseLegacyReads';
import { approvedCatalogRoute, approvedPracticeGames } from '@/lib/approvedPracticeGames';

export const practiceGroups = [
  { id: 'all', label: 'All games' },
  { id: 'poker', label: 'Poker' },
  { id: 'table', label: 'Table games' },
  { id: 'originals', label: 'Originals' },
  { id: 'flight', label: 'Crash & flight' },
];

export function practiceGroup(game) {
  if (['poker', 'omaha'].includes(game.slug)) return 'poker';
  if (['blackjack', 'baccarat', 'craps', 'roulette'].includes(game.slug)) return 'table';
  if (['rocket', 'crash', 'trenball'].includes(game.slug)) return 'flight';
  return 'originals';
}

/** Public descriptions never imply the selected backend has enabled a game. */
export function usePracticeCollection() {
  const { user } = useAuth();
  const shouldRead = !!user?.id && !user.is_excluded;
  const query = useQuery({
    queryKey: ['approved-practice-game-collection', user?.id],
    queryFn: () => readApprovedPracticeGames({ is_active: true }),
    enabled: shouldRead,
    retry: 1,
  });
  const available = new Set((query.data || [])
    .filter(game => game.is_active === true && approvedCatalogRoute(game))
    .map(game => game.slug));
  return {
    games: user?.is_excluded ? [] : user
      ? approvedPracticeGames.filter(game => available.has(game.slug))
      : approvedPracticeGames,
    signedIn: !!user,
    excluded: !!user?.is_excluded,
    loading: shouldRead && query.isPending,
    error: shouldRead && query.isError,
    refreshing: shouldRead && query.isFetching,
    refresh: query.refetch,
  };
}

export function PracticeCollectionMessage({ collection }) {
  if (collection.excluded) return <div className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-5 text-sm text-amber-100">
    Practice play is unavailable for this account. <Link to="/ResponsiblePlay" className="font-semibold underline underline-offset-4">View responsible play information</Link>.
  </div>;
  if (collection.loading) return <div role="status" className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-slate-300">
    <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin text-pink-300" /> Checking your available practice games…
  </div>;
  if (collection.error) return <div role="alert" className="flex flex-col gap-4 rounded-2xl border border-amber-300/25 bg-amber-300/5 p-5 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex items-start gap-3">
      <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
      <div><p className="font-semibold text-amber-100">Your game catalog could not load.</p>
        <p className="mt-1 text-sm text-slate-300">We couldn’t confirm which games are available. Please try again.</p></div>
    </div>
    <button type="button" onClick={() => collection.refresh()} disabled={collection.refreshing}
      className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-amber-200/30 px-4 text-sm font-semibold text-amber-100 hover:bg-amber-100/10 disabled:opacity-60">
      <RefreshCw aria-hidden="true" className={`h-4 w-4 ${collection.refreshing ? 'animate-spin' : ''}`} /> Try again
    </button>
  </div>;
  if (collection.signedIn && collection.games.length === 0) return <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-slate-300">
    <p className="font-semibold text-white">No practice games are currently available.</p>
    <p className="mt-2 text-sm">Refresh your library or visit support if you expected to see a game.</p>
    <div className="mt-4 flex flex-wrap gap-4 text-sm font-semibold">
      <button type="button" onClick={() => collection.refresh()} className="text-pink-300 underline underline-offset-4">Check again</button>
      <Link to="/Support" className="text-amber-200 underline underline-offset-4">Open support</Link>
    </div>
  </div>;
  return null;
}

const themes = {
  poker: { surface: 'from-[#432343] via-[#23152E] to-[#17101F]', color: 'text-amber-200', line: 'border-amber-300/20', label: 'Poker', symbol: '♠' },
  table: { surface: 'from-[#173D35] via-[#102B2B] to-[#101D26]', color: 'text-emerald-200', line: 'border-emerald-300/20', label: 'Table games', symbol: '♣' },
  originals: { surface: 'from-[#312652] via-[#241936] to-[#171020]', color: 'text-violet-200', line: 'border-violet-300/20', label: 'Originals', symbol: '✦' },
  flight: { surface: 'from-[#3F2044] via-[#28172D] to-[#1B1024]', color: 'text-pink-200', line: 'border-pink-300/20', label: 'Crash & flight', symbol: '↗' },
};
const symbols = { poker: '♠', omaha: '♦', blackjack: 'A♠', baccarat: '♥', craps: '⚄', roulette: '◎', dice: '⚄', 'dice-zone': '⚂', mines: '◇', towers: '♜', hilo: 'A↕', 'coin-flip': '◉', hashdice: '⚅', plinko: '⠿', wheel: '◈', darts: '◎', limbo: '↗', rocket: '↗', crash: '↗', trenball: '☾' };

export function PracticeGameCard({ game, signedIn = false }) {
  const theme = themes[practiceGroup(game)];
  return <Link to={game.route} className="group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#15101F] transition duration-200 hover:-translate-y-1 hover:border-pink-300/40 hover:shadow-xl hover:shadow-black/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-pink-300">
    <div className={`relative flex h-36 items-center justify-center overflow-hidden border-b ${theme.line} bg-gradient-to-br ${theme.surface}`}>
      <div aria-hidden="true" className="absolute h-40 w-40 rotate-45 rounded-3xl border border-white/[0.06] transition-transform duration-300 group-hover:rotate-[55deg]" />
      <div aria-hidden="true" className="absolute h-28 w-28 rotate-45 rounded-2xl border border-white/[0.05]" />
      <span aria-hidden="true" className={`relative text-6xl leading-none drop-shadow-xl ${theme.color}`}>{symbols[game.slug] || theme.symbol}</span>
      <span className="absolute left-3 top-3 rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-200">{theme.label}</span>
    </div>
    <div className="flex flex-1 flex-col p-4 sm:p-5">
      <h3 className="text-lg font-bold leading-snug text-white">{game.name}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-400">{game.description}</p>
      <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/[0.06] pt-3">
        <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-400"><ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" /> Practice only</span>
        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${theme.color}`}>{signedIn ? 'Open game' : 'Explore game'} <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></span>
      </div>
    </div>
  </Link>;
}
