import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Lock, Eye, History } from 'lucide-react';

const protections = [
  { icon: Lock, title: 'The deck is fixed before the deal', body: 'The server creates the shuffle and records its card commitments and destinations before assigning the first hole card. The hand’s deck cannot be changed through the normal game functions once play begins.' },
  { icon: Eye, title: 'Your private cards stay private', body: 'You can review your own hole cards, even when you folded. Opponents’ cards are revealed only if they did not fold and the hand reached a completed showdown. A hand won by folds does not reveal opponents’ cards.' },
  { icon: History, title: 'Your hand has a record', body: 'Completed recorded hands include the action sequence, community cards, chip movements and settlement. You can select a hand, play it back, move forward or backward, or jump to a specific step.' },
];

export default function FairnessManifesto() {
  return <main className="min-h-screen bg-[#0A0612] px-4 py-12 text-white sm:px-6">
    <div className="mx-auto max-w-4xl space-y-10">
      <header className="rounded-3xl border border-emerald-400/20 bg-gradient-to-br from-emerald-950/50 to-[#151025] p-6 sm:p-10">
        <ShieldCheck aria-hidden="true" className="mb-5 h-10 w-10 text-emerald-300"/>
        <p className="text-sm font-bold uppercase tracking-widest text-emerald-300">Our commitment to players</p>
        <h1 className="mt-3 text-3xl font-black leading-tight sm:text-5xl">Your security and fair play are our #1 priority.</h1>
        <p className="mt-4 text-xl font-bold text-emerald-200">Every player. Every hand. Every time.</p>
        <p className="mt-6 text-lg leading-relaxed text-slate-200">We’re real players too. We know how it feels to question a deal. You deserve clear records, private cards and a way to check what happened for yourself. From the first card to the final action, our commitment is to give you something you can inspect—not just a promise you have to take on faith.</p>
        <p className="mt-4 font-semibold text-emerald-200">We’ve got your back. We’ll earn your trust, hand by hand.</p>
      </header>

      <section id="poker-verification" className="space-y-5">
        <h2 className="text-2xl font-black sm:text-3xl">SSRCR™ — Server Side Real Crypto Randomness</h2>
        <p className="leading-relaxed text-slate-300">SSRCR™ is our name for the server-side cryptographic randomness and verification records used in our supported practice games. In Hold’em and Omaha, the server knows the deck, but records its shuffle and card destinations before the deal. Players can check that their visible cards and the recorded hand sequence match those commitments.</p>
        <p className="leading-relaxed text-slate-300">The cards are set before play. Your decisions, your opponents’ decisions and the betting action determine how the hand unfolds, including who folds and who reaches showdown.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          {protections.map(({icon:Icon,title,body})=><article key={title} className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <Icon aria-hidden="true" className="mb-3 h-6 w-6 text-emerald-300"/>
            <h3 className="font-bold text-white">{title}</h3><p className="mt-3 text-sm leading-6 text-slate-300">{body}</p>
          </article>)}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#171222] p-6 sm:p-8">
        <h2 className="text-2xl font-black">How the poker tracking works</h2>
        <ol className="mt-6 space-y-6 pl-5 list-decimal marker:font-bold marker:text-emerald-300">
          <li className="pl-2"><h3 className="font-bold">Create, shuffle and lock before dealing</h3><p className="mt-2 leading-relaxed text-slate-300">The server generates a cryptographically secure random seed and uses it to shuffle a standard 52-card deck. Before hole cards are assigned, the database records a SHA-256 deck commitment, the seed commitment, 52 individual card hashes and the fixed positions for each seat and the community cards.</p></li>
          <li className="pl-2"><h3 className="font-bold">Give every card a designator for this specific hand</h3><p className="mt-2 leading-relaxed text-slate-300">Each card hash is tied to its table, hand number, deck position, card identity and a fresh private reveal secret. It identifies that card in that particular deck. Each table and each new hand has its own records, so a proof from one table or hand cannot be substituted into another.</p><p className="mt-2 leading-relaxed text-slate-300">Hold’em assigns two hole cards per player at up to eight seats. Omaha assigns four hole cards per player at up to six seats. The five community cards and the burn positions follow the same locked deck. At an Omaha showdown, the evaluator uses exactly two hole cards and three community cards.</p></li>
          <li className="pl-2"><h3 className="font-bold">Record the hand as it happens</h3><p className="mt-2 leading-relaxed text-slate-300">Player actions, street changes, time extensions, timeouts and settlement append to a numbered hash chain. Each step refers to the previous one. Replacing, reordering or omitting a step makes complete replay verification fail.</p></li>
          <li className="pl-2"><h3 className="font-bold">Verify without exposing folded cards</h3><p className="mt-2 leading-relaxed text-slate-300">When you view the table, your browser checks proofs for the cards you are allowed to see. After a hand finishes, open <strong className="text-white">Hand history &amp; replay</strong> in the table controls. Select a hand to verify its card commitments and complete action sequence. Your browser also compares the records with commitments it previously observed on that device, when browser storage is available.</p><p className="mt-2 leading-relaxed text-slate-300">Poker does not publish the full shuffle seed after the hand: doing so would expose folded opponents’ cards. Instead, the verification records include the position, card hash and reveal secret for each visible card. Your own cards remain available to you, and hidden opponents’ secrets stay on the server.</p></li>
        </ol>
      </section>

      <section id="other-game-verification" className="space-y-4 rounded-2xl border border-emerald-400/20 bg-emerald-950/20 p-6 sm:p-8">
        <h2 className="text-2xl font-black">Check the other practice games too</h2>
        <p className="leading-relaxed text-slate-300">Blackjack, Baccarat, Craps and Roulette publish a game-and-round-specific seed commitment before new cards or results are generated. The seed stays hidden during play. Once a recorded round finishes, open <strong className="text-white">Verify the fairness</strong> at the table, select a completed round and choose <strong className="text-white">Verify selected round</strong>. Your device reconstructs the six-deck Blackjack shuffle, eight-deck Baccarat draw, two Craps dice or single-zero Roulette result. Blackjack checks also reproduce the recorded main-hand and Perfect Pairs returns.</p>
        <p className="leading-relaxed text-slate-300">The browser saves commitments and visible cards on your device. It rejects a changed commitment or a result that contradicts those observations. HiLo, Mines and Towers also preserve the cards and moves already shown, and compare responses with the choices you submitted. Dice binds its verification to your chosen client seed.</p>
        <p className="leading-relaxed text-slate-300">Crash, Rocket and Trenball share a locked round. Their verifier compares the revealed outcome with the preflight hash saved on your device. It checks that the committed result stayed unchanged; it does not derive a random crash point from the revealed seed.</p>
        <p className="leading-relaxed text-slate-300">A new device, cleared browser storage or a visit after play began may leave you without the original commitment. The screen says when it can only check the revealed calculation. Earlier rounds are not retroactively certified. The table proof selector shows the most recent twelve recorded rounds; poker has its separate participant-only hand history and replay.</p>
      </section>

      <section className="space-y-4 rounded-2xl border border-sky-400/20 bg-sky-950/20 p-6 sm:p-8">
        <h2 className="text-2xl font-black">What verification proves</h2>
        <p className="leading-relaxed text-slate-300">A verified hand means the disclosed cards, their destinations and the complete recorded action sequence agree with the hand’s commitment. A previously observed commitment gives you an additional comparison against the record you saw earlier. Your history remains tied to your participation in that hand, including after a tournament table move or elimination.</p>
        <p className="leading-relaxed text-slate-300">These records do not independently prove that an operator never selected a shuffle before publishing it or rewrote records before anyone observed them. They are not an independent randomness audit, a guarantee against collusion or every form of cheating, or a guarantee of a winning result. We want you to understand the protection as well as its limits.</p>
        <p className="text-sm leading-6 text-slate-400">Verified poker history begins with hands started after the committed-ledger release. Earlier hands are not retroactively certified. The current release uses nonredeemable practice chips.</p>
      </section>

      <details className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <summary className="cursor-pointer font-bold">For players who want the technical details</summary>
        <div className="mt-5 space-y-4 text-sm leading-6 text-slate-300">
          <p>The poker shuffle is deterministic from the private server seed and the table/hand context. HMAC-SHA-256 supplies the shuffle samples; rejection sampling and Fisher–Yates determine the deck order. Poker does not use the separate Dice/Coin/Number client-seed formula.</p>
          <p>The seed commitment uses the exact text:</p>
          <pre className="overflow-x-auto rounded-lg bg-black/30 p-3">{'SHA256(serverSeed + ":" + tableId + ":" + handNumber)'}</pre>
          <p>A visible card’s hash uses the exact text below. Position is zero-based, rank is 2–14 and suit is c, d, h or s. The reveal secret is a 64-character hexadecimal value.</p>
          <pre className="overflow-x-auto rounded-lg bg-black/30 p-3">{'SHA256("poker-card-v1|" + tableId + "|" + handNumber + "|" + position + "|" + rank + "|" + suit + "|" + revealSecret)'}</pre>
          <p>A SHA-256 calculator can check a disclosed card hash using that exact input. A hash match alone does not verify the whole shuffle or hand. The in-app replay verifier additionally checks the ordered deck commitments, seat and board assignments, disclosed cards, and the complete event hash chain.</p>
          <p>In <strong>Verification records</strong> inside replay, you can inspect the locked deck hash and the visible card proofs. A full poker server seed or a poker client seed is not supplied.</p>
        </div>
      </details>

      <section className="rounded-2xl border border-emerald-400/20 bg-emerald-950/20 p-6 sm:p-8">
        <h2 className="text-2xl font-black">Check the records. Ask questions. Hold us to it.</h2>
        <p className="mt-4 leading-relaxed text-slate-300">We’ll earn that trust with clear explanations and records you can check. If a verification fails or something does not look right, keep the table ID, hand number and verification details and contact support. Those records help us investigate the exact hand.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/PlayPoker" className="rounded-xl bg-emerald-400 px-5 py-3 font-bold text-slate-950">Open Hold’em</Link>
          <Link to="/PlayOmaha" className="rounded-xl border border-emerald-300/40 px-5 py-3 font-bold text-emerald-200">Open Omaha</Link>
          <Link to="/ProvablyFair" className="rounded-xl border border-white/20 px-5 py-3 font-bold">Verify other practice rounds</Link>
        </div>
      </section>
    </div>
  </main>;
}
