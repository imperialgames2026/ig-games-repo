import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Coins, Crown, ShieldCheck, Users, BookOpen, HelpCircle, ChevronDown, Clock3, RefreshCw, LifeBuoy } from 'lucide-react';

const questions = [
  { question: 'Do my chips have a cash value?', answer: 'No. Tester chips are fictional, cannot be bought or redeemed, and are not a deposit balance. There are no cash prizes or payouts in this test site.' },
  { question: 'What happens if I refresh or lose my connection?', answer: 'Open the same invite link and sign back in with the same account. The table loads its latest state, including your existing seat and stack. Rejoining does not add another starting stack.' },
  { question: 'How does the next hand start?', answer: 'At least two seated players must have chips. Seated players use the table controls to advance streets and resolve the showdown. When the hand ends, the host deals the next hand. The room keeps each player’s remaining stack.' },
  { question: 'Can I take more time on a turn?', answer: 'The table displays the server’s 10-second turn clock. When offered, the free +30-second practice timebank extends that turn once. It does not spend chips or another currency.' },
  { question: 'Why can’t my tester account take a seat?', answer: 'A read-only tester account is for reviewing permitted screens. Playing requires an eligible player account. Ask your testing coordinator to arrange a player account for your session.' },
  { question: 'Are bot players already at my table?', answer: 'Creating a private room does not create bots. Bot sessions are arranged separately by an operator, and bot seats are labeled [AI BOT]. Invite another player for a regular private session.' },
];

export default function TesterChips() {
  return <main className="min-h-screen bg-[#0A0612] px-4 py-12 text-white sm:py-16">
    <div className="mx-auto max-w-5xl">
      <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-300">Imperial Games · Practice play</p>
      <h1 className="mt-4 text-4xl font-black sm:text-5xl">Your seat. Your tester chips.</h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-gray-300">Everything at these tables uses fictional practice chips. Bring your strategy, invite other players and learn the games together.</p>

      <section aria-labelledby="chip-basics" className="mt-9 rounded-2xl border border-amber-300/25 bg-gradient-to-br from-[#2a1d24] to-[#161022] p-6 sm:p-8">
        <Coins className="h-9 w-9 text-amber-300" aria-hidden="true"/>
        <h2 id="chip-basics" className="mt-4 text-2xl font-black">A practice stack, issued by the table</h2>
        <p className="mt-3 max-w-3xl leading-7 text-gray-300">When you create or join a poker practice room, a new seat starts with 1,000 tester chips. Your chip count and the pot appear at that table. Stacks belong to that room; there is no shared poker wallet or currency conversion.</p>
        <div className="mt-5 grid gap-3 border-t border-amber-200/10 pt-5 sm:grid-cols-3">
          <div><p className="text-xl font-black text-amber-200">1,000</p><p className="mt-1 text-xs leading-5 text-gray-400">Starting chips for a new private seat</p></div>
          <div><p className="text-xl font-black text-pink-200">Your room</p><p className="mt-1 text-xs leading-5 text-gray-400">Stacks stay with the same table</p></div>
          <div><p className="text-xl font-black text-purple-200">Free to practice</p><p className="mt-1 text-xs leading-5 text-gray-400">No chip purchases or redemption</p></div>
        </div>
        <p className="mt-3 max-w-3xl leading-7 text-gray-300">Other practice games show their own rules and starting chips. There are no deposits, withdrawals, chip purchases or cash prizes. Historical account-token balances are separate from practice play.</p>
      </section>

      <section aria-labelledby="first-session" className="mt-10">
        <h2 id="first-session" className="text-2xl font-black">Start your first poker session</h2>
        <ol className="mt-5 grid gap-4 sm:grid-cols-3">
          {[
            { icon: Users, title: 'Sign in', text: 'Create an account and confirm your email. Each player uses their own account.' },
            { icon: Crown, title: 'Choose a practice room', text: 'Open the poker lobby and choose Hold’em or Omaha. Create a new room or paste the invite link your host shared.' },
            { icon: BookOpen, title: 'Play your first hand', text: 'Invite another player, then take your seats. When at least two players have chips, the host can deal. Keep the invite to return to the same room.' },
          ].map(({ icon: Icon, title, text }, index) => <li key={title} className="rounded-2xl border border-white/10 bg-[#181125] p-6">
            <div className="flex items-center justify-between"><Icon className="h-6 w-6 text-pink-300" aria-hidden="true"/><span className="text-sm font-bold text-amber-300">0{index + 1}</span></div>
            <h3 className="mt-4 text-lg font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-gray-400">{text}</p>
          </li>)}
        </ol>
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/PokerLobby" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-pink-600 px-6 py-3 font-bold hover:bg-pink-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0612]">Open poker lobby <ArrowRight className="h-4 w-4" aria-hidden="true"/></Link>
        <Link to="/Games" className="inline-flex min-h-12 items-center rounded-xl border border-white/20 px-6 py-3 font-bold hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300">Explore all games</Link>
      </div>

      <section aria-labelledby="table-expectations" className="mt-10 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-[#181125] p-6"><Clock3 className="h-6 w-6 text-amber-300" aria-hidden="true"/><h2 id="table-expectations" className="mt-3 text-lg font-bold">A shared, player-led session</h2><p className="mt-2 text-sm leading-6 text-gray-400">Watch the turn clock and use your own action controls. Seated players advance the streets and settle the showdown; the host starts each new hand.</p></div>
        <div className="rounded-2xl border border-white/10 bg-[#181125] p-6"><RefreshCw className="h-6 w-6 text-pink-300" aria-hidden="true"/><h2 className="mt-3 text-lg font-bold">Come back to the same stack</h2><p className="mt-2 text-sm leading-6 text-gray-400">If your connection drops, open the same room invite and let the table refresh. Check the current hand and stack before trying your action again.</p></div>
      </section>

      <section aria-labelledby="practice-questions" className="mt-10">
        <h2 id="practice-questions" className="flex items-center gap-2 text-2xl font-black"><HelpCircle className="h-6 w-6 text-pink-300" aria-hidden="true"/>Before you take a seat</h2>
        <div className="mt-5 divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-[#151020]">
          {questions.map(({ question, answer }) => <details key={question} className="group px-5 sm:px-6"><summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-4 font-semibold marker:content-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-pink-300 [&::-webkit-details-marker]:hidden"><span>{question}</span><ChevronDown className="h-4 w-4 shrink-0 text-pink-300 transition-transform group-open:rotate-180" aria-hidden="true"/></summary><p className="pb-5 pr-5 text-sm leading-7 text-gray-400">{answer}</p></details>)}
        </div>
      </section>
      <section aria-labelledby="fair-play" className="mt-10 flex gap-4 rounded-2xl border border-white/10 p-6">
        <ShieldCheck className="h-7 w-7 shrink-0 text-amber-300" aria-hidden="true"/>
        <div><h2 id="fair-play" className="text-lg font-bold">Play fairly, even in practice</h2><p className="mt-2 text-sm leading-6 text-gray-400">Practice hands and chip actions are checked by the server. Keep your room key within your testing group and use <Link className="text-pink-300 underline" to="/Support">support tickets</Link> to report a problem. Bot sessions are coordinated separately through the operator’s poker lab.</p></div>
      </section>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-pink-300/20 bg-pink-500/5 p-5"><div className="flex items-center gap-3"><LifeBuoy className="h-6 w-6 shrink-0 text-pink-300" aria-hidden="true"/><div><h2 className="font-bold">Something didn’t go as expected?</h2><p className="mt-1 text-sm leading-6 text-gray-400">Keep the table ID, hand number and what you expected to happen.</p></div></div><Link to="/Support" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-pink-300/30 px-4 py-2 text-sm font-bold text-pink-200 hover:bg-pink-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300">Get support <ArrowRight className="h-4 w-4" aria-hidden="true"/></Link></div>
    </div>
  </main>;
}
