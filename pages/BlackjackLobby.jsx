import React from 'react';
import { Link } from 'react-router-dom';

export default function BlackjackLobby() {
 return <main className="min-h-screen bg-[#0a0612] p-8 text-white">
  <div className="mx-auto max-w-2xl rounded-2xl border border-amber-400/30 bg-[#1d1727] p-8">
   <h1 className="text-4xl font-black">Multiplayer Blackjack</h1>
   <p className="mt-4 text-gray-300">Seven-seat shared table with six-deck shoe, 3:2 Blackjack, main-hand practice betting, and Perfect Pairs side wagers. Dealer and turn order are controlled by the staging server.</p>
   <Link to="/PlayMultiplayerBlackjack" className="mt-6 inline-block rounded-lg bg-amber-300 px-6 py-3 font-black text-slate-950">Enter Blackjack table →</Link>
  </div>
 </main>;
}
