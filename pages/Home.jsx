import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Coins, Crown, Dices, Headphones, ShieldCheck, UserRound, Users } from 'lucide-react';
import WeeklyTokenLeaderboard from '@/components/casino/WeeklyTokenLeaderboard';
import { PracticeCollectionMessage, PracticeGameCard, usePracticeCollection } from '@/components/casino/PracticeGameDiscovery';

const accountLinks = [
  { label: 'Your player profile', to: '/Profile', icon: UserRound, description: 'Make yourself at home. Manage your name, avatar and account.' },
  { label: 'How tester chips work', to: '/TesterChips', icon: Coins, description: 'A fresh table stack. No purchases, deposits or withdrawals.' },
  { label: 'Provably Fair', to: '/ProvablyFair', icon: ShieldCheck, description: 'Learn how to check the proof of a completed practice round.' },
  { label: 'Support center', to: '/Support', icon: Headphones, description: 'Need a hand? Open a private ticket with the support team.' },
];
const featuredSlugs = ['poker', 'omaha', 'blackjack', 'roulette', 'mines', 'dice'];

export default function Home() {
  const collection = usePracticeCollection();
  const featuredGames = featuredSlugs.map(slug => collection.games.find(game => game.slug === slug)).filter(Boolean);
  const showGames = !collection.loading && !collection.error && !collection.excluded;

  return <main className="min-h-screen bg-[#0B0812] text-white">
    <section className="relative isolate overflow-hidden border-b border-white/[0.07]">
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-br from-[#29112E] via-[#130D20] to-[#0B0812]" />
      <div aria-hidden="true" className="absolute -left-40 top-0 -z-10 h-96 w-96 rounded-full bg-pink-700/10 blur-3xl" />
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:gap-8 lg:py-16">
        <div className="relative min-w-0">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-200/15 bg-amber-100/[0.04] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200 sm:text-xs">
            <Crown aria-hidden="true" className="h-3.5 w-3.5" /> Imperial Games · Tester-chip preview
          </p>
          <h1 className="max-w-2xl text-4xl font-black leading-[1.08] tracking-tight sm:text-5xl xl:text-6xl">
            Join the table. <span className="bg-gradient-to-r from-[#E9C777] via-[#F18DBC] to-[#C8A5E9] bg-clip-text text-transparent">Play together.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
            Your table. Your people. The Imperial way to play.
            Discover poker and casino-style games with fictional practice chips,
            and make the next hand one to remember.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link to="/PokerLobby" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 px-6 py-3.5 text-sm font-bold shadow-lg shadow-pink-900/20 transition hover:brightness-110">
              <Crown aria-hidden="true" className="h-4 w-4" /> Find your poker table <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
            <Link to="/Games" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.03] px-6 py-3.5 text-sm font-bold transition hover:bg-white/[0.07]">
              <Dices aria-hidden="true" className="h-4 w-4 text-amber-200" /> Explore the game library
            </Link>
          </div>
          <p className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-slate-400">
            <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-amber-200/70" />
            Tester chips have no cash value and cannot be purchased or redeemed.
          </p>
          <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 border-t border-white/[0.08] pt-5 text-xs text-slate-300">
            <span className="inline-flex items-center gap-2"><Users aria-hidden="true" className="h-4 w-4 text-pink-300" /> Private poker rooms</span>
            <span className="inline-flex items-center gap-2"><Coins aria-hidden="true" className="h-4 w-4 text-amber-200" /> Table-owned practice stacks</span>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-[400px] lg:max-w-[440px]">
          <div aria-hidden="true" className="absolute inset-8 rounded-full bg-pink-700/20 blur-3xl" />
          <div className="relative overflow-hidden rounded-[2rem] border border-amber-200/15 bg-[#0B0A13] p-2 shadow-2xl shadow-black/50">
            <img src="/imperial-gaming.png" width="1024" height="1024" alt="The original Imperial Games crowned pink panther artwork" className="aspect-square w-full rounded-[1.5rem] object-cover" fetchPriority="high" />
          </div>
          <p className="mt-3 text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-200/60">Welcome to the Imperial table</p>
        </div>
      </div>
    </section>

    <div className="mx-auto max-w-7xl space-y-12 px-4 py-10 sm:px-6 lg:space-y-16 lg:py-14">
      <section aria-labelledby="available-games">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-pink-300">Take your pick</p>
            <h2 id="available-games" className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Find your next favorite</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-400">Start with a table classic or explore an Imperial Original.</p></div>
          <Link to="/Games" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-amber-200 hover:text-amber-100">View game library <ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
        </div>
        {!collection.signedIn && <p className="mb-5 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-sm leading-relaxed text-slate-400">
          <Link to="/Games" className="font-semibold text-pink-200 underline underline-offset-4">Browse the practice tables</Link> first. Sign in when you’re ready; your available games are checked after sign-in.
        </p>}
        <PracticeCollectionMessage collection={collection} />
        {showGames && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {(featuredGames.length ? featuredGames : collection.games.slice(0, 6)).map(game => <PracticeGameCard key={game.slug} game={game} signedIn={collection.signedIn} />)}
        </div>}
      </section>

      <section aria-labelledby="first-hand" className="overflow-hidden rounded-3xl border border-amber-200/15 bg-gradient-to-br from-[#261A2A] via-[#1A1423] to-[#16121E] p-6 sm:p-8">
        <div className="grid items-start gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-200">From lobby to first hand</p>
            <h2 id="first-hand" className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">A seat for your whole group.</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">Create a private Hold’em or Omaha room, share its room key and bring your testing group together.</p>
            <Link to="/TesterChips" className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-amber-200 hover:text-amber-100">Plan your first practice session <ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
          </div>
          <ol className="grid gap-5 sm:grid-cols-3">
            {[{ title: 'Choose your room', text: 'Open the poker lobby and pick Hold’em or Omaha.' }, { title: 'Invite your players', text: 'Share the private room key with your group.' }, { title: 'Play with tester chips', text: 'Poker starts each new seat with 1,000 fictional chips. Stacks stay with the table.' }].map((step, index) => <li key={step.title}>
              <span aria-hidden="true" className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-amber-200/20 bg-amber-200/5 text-xs font-bold text-amber-200">0{index + 1}</span>
              <h3 className="font-bold text-white">{step.title}</h3><p className="mt-2 text-sm leading-relaxed text-slate-400">{step.text}</p>
            </li>)}
          </ol>
        </div>
      </section>

      <section aria-labelledby="quick-access">
        <div className="mb-5"><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-pink-300">Your corner of the club</p><h2 id="quick-access" className="mt-2 text-2xl font-black tracking-tight">Everything around the game</h2></div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {accountLinks.map(item => <Link to={item.to} key={item.to} className="group rounded-2xl border border-white/[0.08] bg-[#15101F] p-5 transition-colors hover:border-pink-300/30">
            <item.icon aria-hidden="true" className="mb-4 h-6 w-6 text-pink-300" /><h3 className="font-bold text-white">{item.label}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.description}</p><ArrowRight aria-hidden="true" className="mt-4 h-4 w-4 text-amber-200 transition-transform group-hover:translate-x-1" />
          </Link>)}
        </div>
      </section>

      <WeeklyTokenLeaderboard />
    </div>
  </main>;
}
