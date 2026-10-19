import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Dices, ShieldCheck, Wallet, Headphones, UserRound, ArrowRight, CircleAlert } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { readApprovedPracticeGames } from '@/lib/supabaseLegacyReads';
import GameCard from '@/components/casino/GameCard';
import WeeklyTokenLeaderboard from '@/components/casino/WeeklyTokenLeaderboard';

/**
 * Preserved Imperial Games brand and layout, but NO unconverted Base44 reward,
 * deposit, staking, leaderboard or client-authoritative wagering actions.
 */
const safeLinks = [
  { label: 'Player profile', to: '/Profile', icon: UserRound, description: 'Account settings and test balances' },
  { label: 'Game library', to: '/Games', icon: Dices, description: 'Browse multiplayer practice games' },
  { label: 'Player analytics', to: '/ProfileStats', icon: ShieldCheck, description: 'Verified post-hand poker statistics' },
  { label: 'Weekly practice board', to: '/Leaderboard', icon: Dices, description: 'Anonymous practice results' },
  { label: 'Verification status', to: '/KYCVerification', icon: UserRound, description: 'View your account verification status' },
  { label: 'Transaction history', to: '/TransactionHistory', icon: Wallet, description: 'Your own internal test-currency history' },
  { label: 'Provably Fair', to: '/ProvablyFair', icon: ShieldCheck, description: 'Verify revealed practice rounds' },
  { label: 'Support center', to: '/Support', icon: Headphones, description: 'Private support tickets' },
];
export default function Home() {
  const { user } = useAuth();
  const approvedGames = useQuery({
    queryKey: ['approved-staging-practice-games', user?.id],
    enabled: !!user?.id,
    queryFn: () => readApprovedPracticeGames({ is_active: true }),
    retry: 1,
  });
  return <main className="min-h-screen bg-[#0A0612] text-white">
    <section className="relative overflow-hidden border-b border-white/10">
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-pink-900/30 via-[#100923] to-purple-900/30"/>
      <div aria-hidden="true" className="absolute top-[-120px] right-[-90px] h-[420px] w-[420px] rounded-full bg-pink-600/15 blur-3xl"/>
      <div className="relative mx-auto max-w-7xl px-4 py-14 md:py-24">
        <p className="font-bold uppercase tracking-[0.24em] text-amber-300 text-sm mb-5">Imperial Games · Practice preview</p>
        <h1 className="text-4xl md:text-6xl font-black max-w-3xl leading-tight">
          Join the table. <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-pink-400 to-purple-300">Play together.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-gray-300">
          Play multiplayer poker and casino-style games with fictional practice chips.
          Explore the tables, review completed hands and track your progress.
        </p>
        <div className="flex flex-wrap gap-3 mt-8">
          <Link to="/PlayDice" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 px-7 py-4 font-bold hover:brightness-110">
            <Dices className="h-5 w-5"/> Play practice Dice <ArrowRight className="h-4 w-4"/>
          </Link>
          <Link to="/Support" className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-7 py-4 font-bold hover:bg-white/10">
            <Headphones className="h-5 w-5"/> Support
          </Link>
        </div>
        <div role="status" className="mt-8 flex max-w-2xl items-start gap-3 rounded-xl border border-amber-400/30 bg-black/30 p-4 text-amber-100 text-sm">
          <CircleAlert className="h-5 w-5 shrink-0 text-amber-300"/>
          Practice chips have no cash value and cannot be purchased or redeemed.
          Payment processing is not active.
        </div>
      </div>
    </section>
    <div className="mx-auto max-w-7xl px-4 py-12 space-y-12">
      <section aria-labelledby="available-games">
        <div className="mb-5">
          <p className="uppercase tracking-widest text-pink-300 text-xs font-bold">Your next game</p>
          <h2 id="available-games" className="text-3xl font-black mt-1">Available practice games</h2>
          <p className="text-gray-400 mt-2">Browse multiplayer tables and explore games with fictional practice chips.</p>
        </div>
        {approvedGames.isLoading && <p role="status">Loading approved games…</p>}
        {approvedGames.error && <p role="alert">The approved game catalog is unavailable. No game has been enabled.</p>}
        {!user && <p className="rounded-xl border border-white/10 p-5 text-gray-300"><Link to="/Games" className="text-pink-300 underline">Browse the practice tables</Link> or <Link to="/login" className="text-pink-300 underline">sign in to open your game library</Link>.</p>}
        {user && !approvedGames.isLoading && !approvedGames.error && (approvedGames.data || []).length === 0 &&
          <p className="rounded-xl border border-white/10 p-5 text-gray-400">No approved games are currently available.</p>}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {(approvedGames.data || []).map(game => <GameCard key={game.id} game={game}/>)}
        </div>
      </section>

      <section aria-labelledby="quick-access">
        <h2 id="quick-access" className="text-2xl font-black mb-5">Your Imperial Games account</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {safeLinks.map(item => <Link to={item.to} key={item.to}
            className="group rounded-2xl border border-white/10 bg-gradient-to-br from-[#20152F] to-[#110E20] p-5 hover:border-pink-500/50 transition-colors">
            <item.icon className="w-7 h-7 text-pink-300 mb-4"/>
            <h3 className="text-lg font-bold">{item.label}</h3>
            <p className="text-sm text-gray-400 mt-2">{item.description}</p>
            <ArrowRight className="w-5 h-5 text-amber-300 mt-4 group-hover:translate-x-1 transition-transform"/>
          </Link>)}
        </div>
      </section>

      <section className="grid lg:grid-cols-[2fr_1fr] gap-5 items-start">
        <WeeklyTokenLeaderboard />
        <div className="rounded-2xl border border-white/10 bg-[#1B142B] p-6">
          <Wallet className="w-8 h-8 text-amber-300 mb-4"/>
          <h2 className="font-black text-xl mb-2">Planned crypto networks</h2>
          <p className="text-sm text-gray-300 mb-5">
            Solana, Ethereum, BNB Smart Chain, Arbitrum, OP Mainnet, Polygon,
            Bitcoin, Litecoin, XRP Ledger, Cardano, Monero and Zephyr are configured
            as disabled future deposit options.
          </p>
          <Link className="inline-flex items-center gap-2 text-amber-300 font-bold hover:underline" to="/DepositNetworks">
            View network roadmap <ArrowRight className="h-4 w-4"/>
          </Link>
        </div>
      </section>
    </div>
  </main>;
}
