import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Coins, Crown, Gamepad2, RefreshCw, Search, ShieldCheck, X } from 'lucide-react';
import { PracticeCollectionMessage, PracticeGameCard, practiceGroup, practiceGroups, usePracticeCollection } from '@/components/casino/PracticeGameDiscovery';

export default function Games() {
  const collection = usePracticeCollection();
  const [searchParams, setSearchParams] = useSearchParams();
  const search = (searchParams.get('q') || '').slice(0, 80);
  const requestedCategory = searchParams.get('category') || 'all';
  const category = practiceGroups.some(group => group.id === requestedCategory) ? requestedCategory : 'all';
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filteredGames = collection.games.filter(game =>
    (category === 'all' || practiceGroup(game) === category) &&
    (!normalizedSearch || `${game.name} ${game.description}`.toLocaleLowerCase().includes(normalizedSearch)));
  const canBrowse = !collection.loading && !collection.error && !collection.excluded;
  const updateSearch = value => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set('q', value); else next.delete('q');
    setSearchParams(next, { replace: true });
  };
  const updateCategory = value => {
    const next = new URLSearchParams(searchParams);
    if (value === 'all') next.delete('category'); else next.set('category', value);
    setSearchParams(next);
  };

  return <main className="min-h-screen bg-[#0B0812] text-white">
    <header className="relative overflow-hidden border-b border-white/[0.07] bg-gradient-to-br from-[#29142E] via-[#181021] to-[#0B0812]">
      <div aria-hidden="true" className="absolute -right-14 -top-20 h-80 w-80 rounded-full bg-purple-700/10 blur-3xl" />
      <div className="relative mx-auto flex max-w-7xl items-center gap-6 px-4 py-10 sm:px-6 lg:py-12">
        <div className="min-w-0 flex-1">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-amber-200">Imperial Games · The practice collection</p>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">Game Library</h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">A favorite table. A different kind of challenge. Find your next game and play with fictional tester chips.</p>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-3 text-xs text-slate-400">
            <span className="inline-flex items-center gap-2"><ShieldCheck aria-hidden="true" className="h-4 w-4 text-amber-200/75" /> Practice only</span>
            <span className="inline-flex items-center gap-2"><Coins aria-hidden="true" className="h-4 w-4 text-pink-300/75" /> No purchases or cash prizes</span>
          </div>
        </div>
        <img src="/imperial-gaming.png" alt="" width="1024" height="1024" className="hidden h-36 w-36 shrink-0 rounded-2xl border border-amber-200/15 object-cover opacity-90 lg:block" />
      </div>
    </header>

    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:py-10">
      <section aria-labelledby="poker-entry" className="flex flex-col items-start justify-between gap-5 rounded-2xl border border-amber-200/20 bg-gradient-to-r from-[#302031] to-[#1B1424] p-5 sm:flex-row sm:items-center sm:p-6">
        <div className="flex items-start gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-200/20 bg-amber-200/5"><Crown aria-hidden="true" className="h-5 w-5 text-amber-200" /></span>
          <div><h2 id="poker-entry" className="text-lg font-bold">Bring your group to the poker table</h2><p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-400">Create a private Hold’em or Omaha room, or join your group with a room key.</p></div>
        </div>
        <Link to="/PokerLobby" className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-200 px-5 py-3 text-sm font-bold text-[#211326] transition hover:bg-amber-100 sm:w-auto">Open poker lobby <ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
      </section>

      <section aria-label="Game collection">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div><h2 className="text-2xl font-black tracking-tight">Find your next practice game</h2><p className="mt-2 text-sm text-slate-400">Browse the collection by name or choose your style of play.</p></div>
          {collection.signedIn && !collection.excluded && <button type="button" onClick={() => collection.refresh()} disabled={collection.refreshing}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-4 text-xs font-semibold text-slate-300 hover:bg-white/5 disabled:opacity-60"><RefreshCw aria-hidden="true" className={`h-3.5 w-3.5 ${collection.refreshing ? 'animate-spin' : ''}`} /> Refresh library</button>}
        </div>

        <div className="mb-5 space-y-4">
          <div className="relative max-w-xl">
            <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <label htmlFor="practice-game-search" className="sr-only">Search practice games</label>
            <input id="practice-game-search" type="search" value={search} maxLength={80} onChange={event => updateSearch(event.target.value)} placeholder="Search games…"
              className="min-h-12 w-full rounded-xl border border-white/10 bg-[#15101F] py-3 pl-11 pr-12 text-sm text-white placeholder:text-slate-400 focus:border-pink-300/60 focus:outline-none focus:ring-2 focus:ring-pink-300/15" />
            {search && <button type="button" onClick={() => updateSearch('')} aria-label="Clear game search" className="absolute right-1 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white"><X aria-hidden="true" className="h-4 w-4" /></button>}
          </div>
          <div aria-label="Filter game category" role="group" className="flex flex-wrap gap-2">
            {practiceGroups.map(group => <button key={group.id} type="button" aria-pressed={category === group.id} onClick={() => updateCategory(group.id)}
              className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${category === group.id ? 'border-pink-300/35 bg-pink-400/15 text-pink-100' : 'border-white/[0.08] bg-white/[0.02] text-slate-400 hover:border-white/20 hover:text-slate-200'}`}>
              {group.label}{canBrowse && <span aria-hidden="true" className="text-[10px] opacity-60">{group.id === 'all' ? collection.games.length : collection.games.filter(game => practiceGroup(game) === group.id).length}</span>}
            </button>)}
          </div>
        </div>

        {!collection.signedIn && <div className="mb-6 flex flex-col gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="leading-relaxed text-slate-400">Browse first. <span className="text-slate-200">Sign in when you’re ready.</span> Your available games are checked after sign-in.</p>
          <Link to="/login" className="inline-flex min-h-10 shrink-0 items-center gap-2 font-semibold text-pink-200 hover:text-pink-100">Sign in to play <ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
        </div>}

        <PracticeCollectionMessage collection={collection} />
        {canBrowse && collection.games.length > 0 && <>
          <p role="status" aria-live="polite" className="mb-4 text-xs text-slate-400">{filteredGames.length} {filteredGames.length === 1 ? 'game' : 'games'}{search.trim() ? ` matching “${search.trim()}”` : ''}{category !== 'all' ? ` · ${practiceGroups.find(group => group.id === category).label}` : ''}</p>
          {filteredGames.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {filteredGames.map(game => <PracticeGameCard key={game.slug} game={game} signedIn={collection.signedIn} />)}
          </div> : <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-5 py-14 text-center">
            <Gamepad2 aria-hidden="true" className="mx-auto mb-4 h-9 w-9 text-slate-600" /><h3 className="text-lg font-bold text-white">No matching games</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-400">Try another game name or clear your filters to browse the full collection.</p>
            <button type="button" onClick={() => setSearchParams({})} className="mt-5 min-h-11 rounded-xl border border-pink-300/25 bg-pink-300/5 px-5 text-sm font-semibold text-pink-200 hover:bg-pink-300/10">Clear filters</button>
          </div>}
        </>}

      </section>
      <aside className="flex flex-col gap-3 border-t border-white/[0.08] pt-6 text-xs leading-relaxed text-slate-400 sm:flex-row sm:items-center sm:justify-between">
        <p>Only reviewed practice game routes are included. Other games remain unavailable in this preview.</p>
        <Link to="/TesterChips" className="inline-flex min-h-11 shrink-0 items-center gap-2 font-semibold text-amber-200/80 hover:text-amber-200">How tester chips work <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" /></Link>
      </aside>
    </div>
  </main>;
}
