import React from 'react';
import { Link } from 'react-router-dom';

export default function PokerLobby() {
 return <main className="min-h-screen bg-[#0a0612] p-8 text-white">
   <div className="mx-auto max-w-3xl rounded-2xl border border-amber-400/30 bg-[#1d1727] p-8">
     <p className="text-xs font-black uppercase tracking-widest text-amber-300">Staging practice only</p>
     <h1 className="mt-2 text-4xl font-black">Multiplayer Poker</h1>
     <p className="mt-4 text-gray-300">Texas Hold’em has a shared six-seat table with server-controlled blinds, private hole cards, community cards, betting turns, and showdown. Practice chips cannot be purchased or redeemed.</p>
     <Link to="/PlayPoker" className="mt-6 inline-block rounded-lg bg-amber-400 px-5 py-3 font-black text-slate-950">Create or join a Hold’em table</Link>
     <Link to="/PokerTournaments" className="ml-3 mt-6 inline-block rounded-lg border border-amber-300 px-5 py-3 font-black text-amber-200">Browse practice tournaments</Link>
     <h2 className="mt-9 text-xl font-bold">Multiplayer Omaha</h2>
     <p className="mt-2 text-gray-300">Four private hole cards, three shared betting streets, and a distinct server evaluator using exactly two hole cards and three board cards.</p>
     <Link to="/PlayOmaha" className="mt-4 inline-block rounded-lg border border-amber-300 px-5 py-3 font-black text-amber-200">Create or join an Omaha table</Link>
   </div>
 </main>;
}
