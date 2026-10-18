import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion } from 'framer-motion';
import {
  ShieldCheck, X, CheckCircle, AlertTriangle, Zap, Lock, Eye, Server,
  ChevronRight, ExternalLink
} from 'lucide-react';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.5 },
});

function Section({ children, className = '' }) {
  return (
    <motion.div {...fadeUp(0.05)} className={`mb-10 ${className}`}>
      {children}
    </motion.div>
  );
}

function CompareRow({ label, them, us }) {
  return (
    <div className="grid grid-cols-3 gap-4 py-4 border-b border-white/5 items-center">
      <div className="text-gray-400 text-sm font-medium">{label}</div>
      <div className="flex items-start gap-2 text-sm text-red-400">
        <X className="w-4 h-4 shrink-0 mt-0.5" />
        <span>{them}</span>
      </div>
      <div className="flex items-start gap-2 text-sm text-green-400">
        <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
        <span>{us}</span>
      </div>
    </div>
  );
}

export default function FairnessManifesto() {
  return (
    <div className="min-h-screen bg-[#0A0612] text-white pb-24">

      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-b from-[#12082a] to-[#0A0612] border-b border-white/5">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.12),transparent_65%)]" />
        <div className="relative max-w-4xl mx-auto px-6 py-16 text-center">
          <motion.div {...fadeUp(0)}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-green-500/10 border border-green-500/20 rounded-full text-green-400 text-xs font-bold uppercase tracking-widest mb-6">
              <ShieldCheck className="w-3.5 h-3.5" /> Our Commitment to Fairness
            </div>
            <h1 className="text-4xl md:text-5xl font-black mb-4 leading-tight">
              The Imperial Gaming{' '}
              <span className="bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent">
                Fairness Manifesto
              </span>
            </h1>
            <p className="text-gray-300 text-lg leading-relaxed max-w-2xl mx-auto">
              We didn't build this platform to be another faceless casino with fine print and rigged math. We built it to be different — transparently, verifiably, provably different. This is our commitment to you, in writing, with receipts.
            </p>
            <p className="text-pink-400 font-bold text-lg mt-4">
              Made for real gamblers, by real gamblers.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12 space-y-12">

        {/* The Problem with the Industry */}
        <Section>
          <div className="flex items-center gap-3 mb-5">
            <AlertTriangle className="w-6 h-6 text-yellow-400 shrink-0" />
            <h2 className="text-2xl font-black text-white">The Problem With Every Other Online Casino</h2>
          </div>
          <div className="bg-gradient-to-br from-red-900/20 to-red-800/10 border border-red-500/20 rounded-2xl p-7 space-y-4 text-gray-300 text-sm leading-relaxed">
            <p>
              Walk into any online casino — crypto, sweepstakes, social, or otherwise — and under the hood, most of them are running the same thing: <span className="text-red-400 font-semibold">Math.random()</span>. It's a browser-level pseudorandom number generator. It's fast, it's cheap, and it is completely, utterly unauditable.
            </p>
            <p>
              What does that mean for you? It means the "random" number that decided whether you won or lost was generated <em>client-side</em> — in your own browser — by an algorithm seeded from a timestamp and a handful of system values. Any developer with access to the codebase can influence it. Any platform can quietly adjust it. And you have no way to know.
            </p>
            <p>
              The phrase <span className="text-red-400 font-semibold">"Provably Fair"</span> was supposed to fix this. In theory, it's a clever idea: the casino commits to a server seed before a round, hashes it, and reveals the seed afterward so you can check the outcome wasn't changed mid-round. In practice? Most casinos slap the "Provably Fair" badge on their site and keep running Math.random() anyway. The verification tools are buried. The process is confusing. And the randomness source itself — the part that actually matters — is still a software algorithm that no one audits.
            </p>
            <p className="text-yellow-300 font-semibold border-l-4 border-yellow-400/50 pl-4">
              "Provably Fair" became a marketing term. We refused to let that be our standard.
            </p>
          </div>
        </Section>

        {/* What We Did Instead */}
        <Section>
          <div className="flex items-center gap-3 mb-5">
            <Zap className="w-6 h-6 text-green-400 shrink-0" />
            <h2 className="text-2xl font-black text-white">What We Did Instead: SSRCR™</h2>
          </div>
          <div className="bg-gradient-to-br from-green-900/20 to-emerald-900/10 border border-green-500/20 rounded-2xl p-7 space-y-4 text-gray-300 text-sm leading-relaxed">
            <p>
              We rebuilt our entire outcome engine from scratch around a single principle: <span className="text-green-400 font-bold">the randomness source must be cryptographically strong, server-side, and independently verifiable.</span> We call it <span className="text-green-400 font-black">SSRCR™ — Server Side Real Crypto Randomness</span>.
            </p>
            <p>
              Every single outcome on Imperial Gaming — every dice roll, every slot spin, every card deal, every crash point, every plinko path — is generated on our servers using the <span className="text-green-300 font-semibold">Web Crypto API's <code className="bg-black/30 px-1 rounded">crypto.getRandomValues()</code></span>. This is not a software algorithm. It pulls entropy directly from your operating system's hardware entropy pool — the same source used by military-grade encryption, SSL certificates, and hardware security keys.
            </p>
            <p>
              The result is then sealed with a <strong className="text-white">SHA-256 cryptographic hash</strong> before you ever see the outcome. The hash is committed. Immutable. If we tampered with the result after the fact, the hash would fail to match — and you can check that yourself, right now, with any SHA-256 tool on the internet. No account. No trust. Just math.
            </p>
          </div>
        </Section>

        {/* SSRCR vs Provably Fair Breakdown */}
        <Section>
          <div className="flex items-center gap-3 mb-5">
            <Eye className="w-6 h-6 text-pink-400 shrink-0" />
            <h2 className="text-2xl font-black text-white">SSRCR™ vs "Provably Fair" — Side by Side</h2>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <div className="grid grid-cols-3 gap-4 px-6 py-3 bg-white/5 text-xs font-bold uppercase tracking-widest text-gray-400">
              <div></div>
              <div className="text-red-400">Industry "Provably Fair"</div>
              <div className="text-green-400">Imperial SSRCR™</div>
            </div>
            <div className="px-6">
              <CompareRow
                label="Randomness Source"
                them="Math.random() or software PRNG — algorithmic, predictable in theory"
                us="crypto.getRandomValues() — hardware entropy, cryptographically secure"
              />
              <CompareRow
                label="Where It Runs"
                them="Often client-side (your browser) — can be inspected or influenced"
                us="Server-side only — your browser never touches the RNG"
              />
              <CompareRow
                label="Auditability"
                them="Theoretical — most platforms make verification deliberately obscure"
                us="First-class — every round has a seed + hash you can verify in 30 seconds"
              />
              <CompareRow
                label="Tamper Evidence"
                them="Hash commitment exists but seed quality and process is unverified"
                us="SHA-256 hash locked before delivery; mismatch is mathematically impossible to hide"
              />
              <CompareRow
                label="Transparency"
                them="Badge on the website; documentation rarely accessible"
                us="Full integrity page, public verification tools, every round in your history"
              />
              <CompareRow
                label="Who Can Check"
                them="Technically possible but practically designed to be difficult"
                us="Anyone, anywhere, with zero account, using any SHA-256 tool online"
              />
              <CompareRow
                label="Platform Influence"
                them="Possible — client-side RNG can be adjusted based on session data"
                us="Impossible — outcome sealed server-side before it ever reaches you"
              />
            </div>
          </div>
        </Section>

        {/* Our Commitments */}
        <Section>
          <div className="flex items-center gap-3 mb-5">
            <Lock className="w-6 h-6 text-purple-400 shrink-0" />
            <h2 className="text-2xl font-black text-white">Our Commitments to Every Player</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              {
                icon: Server,
                color: 'text-green-400',
                bg: 'from-green-900/20 to-green-800/10 border-green-500/20',
                title: 'Every Outcome is Server-Side',
                body: 'No game on Imperial Gaming calculates results in your browser. Every outcome — every single one — is generated, sealed, and committed on our servers before it is delivered to you.',
              },
              {
                icon: ShieldCheck,
                color: 'text-blue-400',
                bg: 'from-blue-900/20 to-blue-800/10 border-blue-500/20',
                title: 'Every Round is Verifiable',
                body: 'After every round you play, you receive the original seed. Hash it yourself. Compare it to the stored record. If they match — and they always will — your round is clean.',
              },
              {
                icon: Eye,
                color: 'text-pink-400',
                bg: 'from-pink-900/20 to-pink-800/10 border-pink-500/20',
                title: 'House Edge is Published, Not Hidden',
                body: 'Our house edge is displayed on every game. It is fixed. It does not change based on your balance, your streak, or your VIP level. What you see is what runs.',
              },
              {
                icon: Zap,
                color: 'text-yellow-400',
                bg: 'from-yellow-900/20 to-yellow-800/10 border-yellow-500/20',
                title: 'No Adaptive Difficulty',
                body: 'We do not run "loss streaks" or "win streaks" on purpose. There is no algorithm watching your session and adjusting outcomes. The math is fixed. The crypto randomness doesn\'t know who you are.',
              },
              {
                icon: Lock,
                color: 'text-purple-400',
                bg: 'from-purple-900/20 to-purple-800/10 border-purple-500/20',
                title: 'Responsible Play is Built In',
                body: 'We provide deposit limits, session controls, and self-exclusion tools — not because regulators require it, but because we believe access to those tools is a basic right for every player.',
              },
              {
                icon: CheckCircle,
                color: 'text-emerald-400',
                bg: 'from-emerald-900/20 to-emerald-800/10 border-emerald-500/20',
                title: 'We Will Never Change This™',
                body: 'SSRCR™ is not a feature we can quietly deprecate. It is the foundation of how our platform works. Any change to the randomness model would require rebuilding every game from scratch — and we have zero intention of doing that.',
              },
            ].map((item) => (
              <div key={item.title} className={`bg-gradient-to-br ${item.bg} border rounded-xl p-5`}>
                <div className="flex items-center gap-2 mb-3">
                  <item.icon className={`w-5 h-5 ${item.color}`} />
                  <h3 className={`font-bold text-sm ${item.color}`}>{item.title}</h3>
                </div>
                <p className="text-gray-300 text-sm leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* The Real Gambler Section */}
        <Section>
          <div className="bg-gradient-to-br from-[#1a0a2e] to-[#0f0820] border border-purple-500/20 rounded-2xl p-8">
            <h2 className="text-2xl font-black text-white mb-4">A Word to the Real Gambler</h2>
            <div className="space-y-4 text-gray-300 text-sm leading-relaxed">
              <p>
                If you've spent real time and real money on gambling platforms, you know the feeling. The gut instinct that something isn't right. A run of losses that feels a little too deliberate. An RTP that doesn't match what you're actually experiencing over hundreds of sessions. You're not paranoid. You're pattern-recognizing — and the industry has given you every reason to.
              </p>
              <p>
                We're not here to tell you we can change the laws of probability. The house edge exists. It's math. But what we <em>can</em> do is guarantee that every single outcome you receive is generated fairly — with real cryptographic randomness, sealed before you see it, and verifiable after the fact without needing to take our word for anything.
              </p>
              <p className="text-white font-semibold">
                That's not a pitch. That's a technical commitment embedded in how the platform is built. SSRCR™ isn't a badge we put on to look trustworthy. It's the architecture. It's the foundation. And it's available for you to verify, round by round, any time you want.
              </p>
              <p>
                We believe the future of online gaming belongs to platforms that treat players like adults — with full transparency, fair math, and the tools to verify everything themselves. We're building that platform. And we're just getting started.
              </p>
              <p className="text-green-400 font-bold text-base mt-2">
                — The Imperial Gaming Team
              </p>
            </div>
          </div>
        </Section>

        {/* Verify CTA */}
        <Section>
          <div className="bg-gradient-to-r from-green-600/20 to-emerald-600/10 border border-green-500/30 rounded-2xl p-8 text-center">
            <ShieldCheck className="w-12 h-12 text-green-400 mx-auto mb-4" />
            <h2 className="text-2xl font-black text-white mb-2">See It For Yourself</h2>
            <p className="text-gray-400 text-sm mb-6 max-w-xl mx-auto">
              Don't take our word for it. Pull up your round history, grab any seed, and verify the SHA-256 hash against our stored records — right in your browser, right now.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                to={createPageUrl('ProvablyFair')}
                className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-black font-bold px-6 py-3 rounded-xl transition-colors"
              >
                <ShieldCheck className="w-4 h-4" />
                Verify a Round
                <ChevronRight className="w-4 h-4" />
              </Link>
              <a
                href="https://emn178.github.io/online-tools/sha256.html"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-bold px-6 py-3 rounded-xl transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Independent SHA-256 Tool
              </a>
            </div>
          </div>
        </Section>

      </div>
    </div>
  );
}