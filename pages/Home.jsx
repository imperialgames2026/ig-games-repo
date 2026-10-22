import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight, Crown, Dices, Gamepad2, Headphones, LockKeyhole,
  ShieldCheck, Smartphone, Sparkles, UserRound, Wallet
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { readApprovedPracticeGames } from '@/lib/supabaseLegacyReads';
import { approvedPracticeGames } from '@/lib/approvedPracticeGames';
import GameCard from '@/components/casino/GameCard';
import WeeklyTokenLeaderboard from '@/components/casino/WeeklyTokenLeaderboard';

const featuredSlugs = ['poker', 'blackjack', 'roulette', 'craps', 'baccarat', 'crash'];

const quickLinks = [
  { label: 'Game Library', to: '/Games', icon: Gamepad2, description: 'Browse every approved Imperial Games table and original.' },
  { label: 'Poker', to: '/PokerLobby', icon: Crown, description: 'Open the poker lobby and find your next table.' },
  { label: 'Profile', to: '/Profile', icon: UserRound, description: 'Manage your player profile, preferences and account tools.' },
  { label: 'Support', to: '/Support', icon: Headphones, description: 'Open private support tickets and account help.' },
];

function FeaturedGame({ game }) {
  return (
    <Link
      to={game.route}
      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#1d1630] via-[#151020] to-[#0d0a15] p-5 transition hover:-translate-y-1 hover:border-pink-400/50 hover:shadow-2xl hover:shadow-pink-950/30"
    >
      <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-pink-500/10 blur-2xl transition group-hover:bg-pink-500/20" />
      <div className="relative">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-2xl">
          {game.icon || (game.slug === 'poker' ? '♠️' : game.slug === 'blackjack' ? '🂡' : '🎰')}
        </div>
        <h3 className="text-lg font-black text-white">{game.name}</h3>
        <p className="mt-2 min-h-10 text-sm leading-5 text-slate-400">{game.description}</p>
        <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-pink-300">
          Enter game <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  );
}

export default function Home() {
  const { user } = useAuth();
  const approvedGames = useQuery({
    queryKey: ['approved-staging-practice-games', user?.id],
    enabled: !!user?.id,
    queryFn: () => readApprovedPracticeGames({ is_active: true }),
    retry: 1,
  });

  const featuredGames = featuredSlugs
    .map(slug => approvedPracticeGames.find(game => game.slug === slug))
    .filter(Boolean);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#09060f] text-white">
      <section className="relative isolate overflow-hidden border-b border-white/10">
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(236,72,153,.20),transparent_33%),radial-gradient(circle_at_80%_0%,rgba(168,85,247,.20),transparent_34%),linear-gradient(135deg,#09060f_0%,#130a20_55%,#09060f_100%)]" />
        <div aria-hidden="true" className="absolute left-1/2 top-12 h-72 w-72 -translate-x-1/2 rounded-full border border-pink-300/10 bg-pink-500/5 blur-3xl" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:py-16 lg:grid-cols-[1.1fr_.9fr] lg:py-24">
          <div className="text-center lg:text-left">
            <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-pink-400/30 bg-pink-500/10 px-4 py-2 text-xs font-black uppercase tracking-[.22em] text-pink-300 lg:mx-0">
              <Sparkles className="h-4 w-4" /> Imperial Gaming
            </div>

            <h1 className="text-5xl font-black leading-[.93] tracking-tight sm:text-7xl">
              <span className="block bg-gradient-to-r from-pink-400 via-fuchsia-300 to-purple-300 bg-clip-text text-transparent">IMPERIAL</span>
              <span className="block text-white">GAMES</span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg leading-7 text-slate-300 lg:mx-0">
              Poker, blackjack, baccarat, craps, roulette and fast originals in one Imperial Games account,
              built for desktop and mobile.
            </p>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
              <Link to="/Games" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 to-fuchsia-600 px-6 py-3 font-black text-white shadow-lg shadow-pink-950/40 transition hover:brightness-110">
                <Gamepad2 className="h-5 w-5" /> Browse Games <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to={user ? '/PokerLobby' : '/login'} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 py-3 font-bold text-white transition hover:bg-white/10">
                <Crown className="h-5 w-5 text-amber-300" /> {user ? 'Poker Lobby' : 'Sign In'}
              </Link>
            </div>

            <div className="mt-7 inline-flex max-w-2xl items-start gap-3 rounded-xl border border-amber-300/20 bg-black/25 p-4 text-left text-sm leading-6 text-slate-300">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
              Private APK and current website builds remain practice-only: no cash redemption, deposits or real-value wagering are enabled.
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md">
            <div className="absolute inset-8 rounded-full bg-pink-500/20 blur-3xl" />
            <div className="relative rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/10 to-white/[.025] p-5 shadow-2xl backdrop-blur">
              <div className="rounded-[1.5rem] border border-white/10 bg-[#0d0914] p-6">
                <img src="/imperial-gaming.png" alt="Imperial Gaming" className="mx-auto h-52 w-52 object-contain drop-shadow-[0_20px_45px_rgba(236,72,153,.28)] sm:h-64 sm:w-64" />
                <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-white/5 px-2 py-3"><strong className="block text-lg text-white">{approvedPracticeGames.length}</strong><span className="text-[11px] text-slate-400">Reviewed games</span></div>
                  <div className="rounded-xl bg-white/5 px-2 py-3"><strong className="block text-lg text-white">24/7</strong><span className="text-[11px] text-slate-400">App access</span></div>
                  <div className="rounded-xl bg-white/5 px-2 py-3"><strong className="block text-lg text-white">1</strong><span className="text-[11px] text-slate-400">Player account</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-14 px-4 py-12 pb-28 md:pb-12">
        <section aria-labelledby="featured-games">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[.2em] text-pink-300">Imperial tables</p>
              <h2 id="featured-games" className="mt-2 text-3xl font-black">Featured Games</h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-400">Fast access to the core Imperial Games experience. Sign-in and server permissions still control actual table access.</p>
            </div>
            <Link to="/Games" className="inline-flex items-center gap-2 font-bold text-pink-300 hover:text-pink-200">View full lobby <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featuredGames.map(game => <FeaturedGame key={game.slug} game={game} />)}
          </div>
        </section>

        {user && (
          <section aria-labelledby="live-catalog">
            <div className="mb-5">
              <p className="text-xs font-black uppercase tracking-[.2em] text-emerald-300">Your approved catalog</p>
              <h2 id="live-catalog" className="mt-2 text-2xl font-black">Available Now</h2>
            </div>
            {approvedGames.isLoading && <p role="status" className="text-slate-300">Loading approved games…</p>}
            {approvedGames.error && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-red-200">The approved game catalog is unavailable. No game has been enabled.</p>}
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {(approvedGames.data || []).slice(0, 6).map(game => <GameCard key={game.id} game={game} />)}
            </div>
          </section>
        )}

        <section aria-labelledby="account-tools">
          <div className="mb-6">
            <p className="text-xs font-black uppercase tracking-[.2em] text-amber-300">One account everywhere</p>
            <h2 id="account-tools" className="mt-2 text-3xl font-black">Your Imperial Games</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {quickLinks.map(item => (
              <Link key={item.to} to={item.to} className="group rounded-2xl border border-white/10 bg-[#13101d] p-5 transition hover:border-pink-400/40 hover:bg-[#181324]">
                <item.icon className="h-7 w-7 text-pink-300" />
                <h3 className="mt-4 font-black">{item.label}</h3>
                <p className="mt-2 text-sm leading-5 text-slate-400">{item.description}</p>
                <ArrowRight className="mt-4 h-4 w-4 text-amber-300 transition group-hover:translate-x-1" />
              </Link>
            ))}
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.4fr_.6fr]">
          <WeeklyTokenLeaderboard />
          <div className="space-y-5">
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#171323] to-[#0d0a14] p-6">
              <Wallet className="h-8 w-8 text-amber-300" />
              <h2 className="mt-4 text-xl font-black">Wallet at a Glance</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">Your authenticated wallet toolbar stays available throughout the app, with currency preference and balances protected by the current Supabase account rules.</p>
              <Link to="/CryptoWallet" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-amber-300">Wallet status <ArrowRight className="h-4 w-4" /></Link>
            </div>
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#171323] to-[#0d0a14] p-6">
              <Smartphone className="h-8 w-8 text-pink-300" />
              <h2 className="mt-4 text-xl font-black">Built for Mobile</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">Responsive navigation, safe-area spacing, lifecycle handling and bundled assets keep the Android experience under version control instead of wrapping the live website.</p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 rounded-3xl border border-white/10 bg-white/[.035] p-6 sm:grid-cols-3 sm:p-8">
          <div><LockKeyhole className="h-6 w-6 text-emerald-300" /><h3 className="mt-3 font-black">Protected Sessions</h3><p className="mt-2 text-sm text-slate-400">Native account restrictions and approved authentication paths remain intact.</p></div>
          <div><Dices className="h-6 w-6 text-pink-300" /><h3 className="mt-3 font-black">Verified Outcomes</h3><p className="mt-2 text-sm text-slate-400">Reviewed practice handlers and fairness records stay separate from the visual redesign.</p></div>
          <div><ShieldCheck className="h-6 w-6 text-amber-300" /><h3 className="mt-3 font-black">Controlled Release</h3><p className="mt-2 text-sm text-slate-400">The Android package, signing identity and release evidence remain owner-controlled.</p></div>
        </section>
      </div>
    </main>
  );
}
