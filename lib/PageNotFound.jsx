import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Compass, Crown } from 'lucide-react';

export default function PageNotFound() {
  const { pathname } = useLocation();
  return <main className="mx-auto flex min-h-[65vh] max-w-3xl items-center px-4 py-16 text-white">
    <section className="w-full rounded-3xl border border-white/10 bg-gradient-to-br from-[#21162e] to-[#110c1c] p-7 sm:p-12">
      <Compass aria-hidden="true" className="h-12 w-12 text-amber-300" />
      <p className="mt-6 text-xs font-bold uppercase tracking-[0.24em] text-pink-300">Imperial Games · 404</p>
      <h1 className="mt-3 text-3xl font-black sm:text-4xl">Page not found</h1>
      <p className="mt-4 leading-7 text-gray-300">This link doesn’t lead to a page in Imperial Games. Find your next game in the library or head back to the poker lobby.</p>
      <p className="mt-4 break-all rounded-xl bg-black/20 px-4 py-3 font-mono text-xs text-gray-400">{pathname}</p>
      <div className="mt-7 flex flex-wrap gap-3">
        <Link to="/Games" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-pink-600 px-5 py-3 font-bold hover:bg-pink-500">Explore games <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
        <Link to="/PokerLobby" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 px-5 py-3 font-bold hover:bg-white/5"><Crown className="h-4 w-4 text-amber-300" aria-hidden="true" /> Poker lobby</Link>
      </div>
      <Link to="/" className="mt-6 inline-block text-sm text-gray-300 underline underline-offset-4 hover:text-white">Return home</Link>
    </section>
  </main>;
}
