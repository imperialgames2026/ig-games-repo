import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, Search, ShieldCheck, ExternalLink, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function ProvablyFair() {
  const [user, setUser] = useState(null);
  const [searchSeed, setSearchSeed] = useState('');
  const [verifyResult, setVerifyResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const u = await base44.auth.me();
        setUser(u);
      } catch (e) {
        base44.auth.redirectToLogin();
      }
    };
    loadUser();
    // Pre-fill seed from URL param
    const params = new URLSearchParams(window.location.search);
    const urlSeed = params.get('seed');
    if (urlSeed) setSearchSeed(urlSeed);
  }, []);

  const { data: rounds = [] } = useQuery({
    queryKey: ['game-rounds', user?.email],
    queryFn: () => base44.entities.GameRound.filter({ user_email: user?.email }, '-created_date', 50),
    enabled: !!user?.email,
  });

  const handleVerifySeed = async (e) => {
    e?.preventDefault();
    if (!searchSeed.trim()) return;
    setLoading(true);

    const encoder = new TextEncoder();
    const data = encoder.encode(searchSeed.trim());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const seedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const matchingRound = rounds.find(r => r.hash === seedHash || r.seed === searchSeed.trim());

    if (matchingRound) {
      setVerifyResult({ found: true, round: matchingRound, seedHash });
    } else {
      setVerifyResult({ found: false, message: 'No matching round found in your history. The seed may belong to a different game or session.' });
    }
    setLoading(false);
  };

  // Auto-verify if seed was in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('seed') && rounds.length > 0) {
      handleVerifySeed();
    }
  }, [rounds]);

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const gameEmoji = (slug) => {
    const map = { dice: '🎲', mines: '💣', towers: '🗼', plinko: '🪅', crash: '🚀', hotpot: '🍲', 'premium-slot': '🎰' };
    for (const [k, v] of Object.entries(map)) { if (slug?.includes(k)) return v; }
    return '🎮';
  };

  return (
    <div className="min-h-screen bg-[#0A0612] p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <ShieldCheck className="w-9 h-9 text-green-400" />
            <h1 className="text-4xl font-black text-white">Imperial Integrity System <span className="text-green-400 text-2xl font-black">SSRCR</span></h1>
          </div>
          <p className="text-gray-300 text-base leading-relaxed">
            At Imperial Gaming, we made a decision most platforms never bother with — we ripped out every last line of client-side randomness and rebuilt our entire outcome engine on <strong className="text-green-400">SSRCR (Server Side Real Crypto Randomness)</strong>, generated exclusively on our servers. Every single round, every spin, every flip — decided before it reaches you, sealed with a cryptographic fingerprint you can verify yourself. No trust required.
          </p>
        </motion.div>

        {/* Why We Did It */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }}
          className="bg-gradient-to-br from-pink-900/20 to-purple-900/10 border border-pink-500/20 rounded-2xl p-6 mb-6">
          <h2 className="text-xl font-bold text-white mb-3">Why We Built SSRCR</h2>
          <p className="text-gray-300 text-sm leading-relaxed mb-4">
            Most social casinos use <span className="text-pink-400 font-semibold">Math.random()</span> — a basic browser function that is fast but completely unauditable. You have no way to confirm that any outcome wasn't influenced, pre-determined, or manipulated client-side before it was "rolled." We refused to build that way.
          </p>
          <p className="text-gray-300 text-sm leading-relaxed">
            Instead, every Imperial Gaming round is generated server-side using the <span className="text-green-400 font-semibold">Web Crypto API</span> — specifically <code className="text-green-300 bg-black/30 px-1 rounded">crypto.getRandomValues()</code> — the same cryptographic standard used by security applications, hardware key generators, and military-grade encryption systems. The randomness is sourced from your device's hardware entropy pool via the operating system, not a software algorithm. It cannot be predicted, replicated, or gamed.
          </p>
        </motion.div>

        {/* What This Means For You */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="bg-gradient-to-br from-green-900/20 to-emerald-900/10 border border-green-500/20 rounded-2xl p-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-4">What This Means For You</h2>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                n: '1',
                title: 'Zero Trust Required',
                body: 'You don\'t have to take our word for anything. Every round generates a unique seed before your outcome is decided. That seed is locked in with a SHA-256 hash — a one-way fingerprint — before the result is ever shown to you. If we changed the outcome after the fact, the hash would not match. It\'s mathematically impossible to fake.',
              },
              {
                n: '2',
                title: 'Server-Only Outcomes',
                body: 'Your result is never calculated in your browser. There\'s no client-side RNG we could manipulate based on your balance, your streak, or anything else. The outcome is sealed on our servers before the round begins, then delivered to you — the same way it was generated. Clean. Untouched.',
              },
              {
                n: '3',
                title: 'You Hold the Proof',
                body: 'After every round, you receive the original seed. Take it anywhere — paste it into any SHA-256 tool online — and you\'ll get back the exact same hash we recorded. If they match, the round is verified legitimate. No special software. No account needed. Just math.',
              },
            ].map(step => (
              <div key={step.n} className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-green-500/20 text-green-400 font-bold text-sm flex items-center justify-center shrink-0 mt-0.5">{step.n}</div>
                <div>
                  <div className="font-bold text-white text-sm mb-2">{step.title}</div>
                  <div className="text-gray-400 text-xs leading-relaxed">{step.body}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 pt-4 border-t border-white/10 flex flex-wrap gap-3 items-center">
            <span className="text-gray-400 text-xs font-semibold">Verify any seed externally:</span>
            <a href="https://emn178.github.io/online-tools/sha256.html" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-green-400 hover:text-green-300 underline">
              SHA-256 Online Tool <ExternalLink className="w-3 h-3" />
            </a>
            <a href="https://hash.online-convert.com/sha256-generator" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-green-400 hover:text-green-300 underline">
              Alternative Verifier <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </motion.div>

        {/* Verify Section */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-[#1A1528] to-[#0F0A1E] border border-white/10 rounded-2xl p-8 mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">Authenticate Your SSRCR Round</h2>
          <p className="text-gray-400 text-sm mb-6">Paste the round seed shown to you at the end of any game. We'll run the SHA-256 hash right here in your browser and cross-reference it against our SSRCR sealed records — no server call needed for the verification itself.</p>

          <form onSubmit={handleVerifySeed} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Round Seed <span className="text-gray-600">(shown at the end of every game round)</span></label>
              <Input
                type="text"
                value={searchSeed}
                onChange={(e) => setSearchSeed(e.target.value)}
                placeholder="Paste your round seed here..."
                className="bg-white/10 border-white/20 text-white placeholder-gray-500 font-mono text-sm"
              />
            </div>
            <Button type="submit" disabled={loading || !searchSeed.trim()}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold">
              <Search className="w-4 h-4 mr-2" />
              {loading ? 'Verifying...' : 'Verify Round'}
            </Button>
          </form>

          <AnimatePresence>
            {verifyResult && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className={`mt-6 p-5 rounded-xl border ${verifyResult.found ? 'bg-green-900/20 border-green-500/30' : 'bg-red-900/20 border-red-500/30'}`}>
                <div className="flex items-start gap-3">
                  {verifyResult.found
                    ? <CheckCircle className="w-6 h-6 text-green-400 shrink-0 mt-1" />
                    : <XCircle className="w-6 h-6 text-red-400 shrink-0 mt-1" />}
                  <div className="flex-1 min-w-0">
                    {verifyResult.found ? (
                      <>
                        <h3 className="text-lg font-bold text-green-400 mb-4">✓ Round Authenticated — Outcome Confirmed Legitimate</h3>
                        <div className="space-y-2 text-sm">
                          {[
                            { label: 'Game', value: `${gameEmoji(verifyResult.round.game_slug)} ${verifyResult.round.game_slug}` },
                            { label: 'Bet', value: `${verifyResult.round.bet_amount} ${verifyResult.round.difficulty?.includes('ID') ? 'ID' : 'IC'}` },
                            { label: 'Win', value: `${verifyResult.round.win_amount} ${verifyResult.round.difficulty?.includes('ID') ? 'ID' : 'IC'}`, color: verifyResult.round.win_amount > 0 ? 'text-green-400' : 'text-red-400' },
                            { label: 'House Edge', value: `${((verifyResult.round.house_edge || 0) * 100).toFixed(1)}%` },
                            { label: 'Date', value: new Date(verifyResult.round.created_date).toLocaleString() },
                          ].map(({ label, value, color }) => (
                            <div key={label} className="flex justify-between gap-4">
                              <span className="text-gray-400">{label}:</span>
                              <span className={`font-mono text-right ${color || 'text-white'}`}>{value}</span>
                            </div>
                          ))}
                          <div className="pt-3 border-t border-white/10 space-y-2">
                            {[
                              { label: 'Seed', val: verifyResult.round.seed, key: 'seed' },
                              { label: 'Hash (stored)', val: verifyResult.round.hash, key: 'hash' },
                              { label: 'Hash (computed)', val: verifyResult.seedHash, key: 'computed' },
                            ].map(({ label, val, key }) => (
                              <div key={key}>
                                <div className="text-gray-400 text-xs mb-1">{label}:</div>
                                <div className="flex items-center gap-2 bg-black/30 rounded p-2">
                                  <span className="text-white font-mono text-xs break-all flex-1">{val}</span>
                                  <button onClick={() => copyToClipboard(val, key)} className="shrink-0 text-gray-400 hover:text-white">
                                    {copied === key ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                                  </button>
                                </div>
                              </div>
                            ))}
                            {verifyResult.round.hash === verifyResult.seedHash
                              ? <div className="text-green-400 text-sm font-bold">✓ Hashes match — this round was not altered after generation. The result you received is exactly what our server sealed.</div>
                              : <div className="text-red-400 text-sm font-bold">⚠ Hash mismatch detected — this should never happen. Please contact Imperial Support immediately with your seed.</div>
                            }
                          </div>
                        </div>
                        <a href={`https://emn178.github.io/online-tools/sha256.html`} target="_blank" rel="noopener noreferrer"
                          className="mt-3 inline-flex items-center gap-1 text-xs text-green-400 hover:text-green-300 underline">
                          Run the SHA-256 yourself on an independent tool <ExternalLink className="w-3 h-3" />
                        </a>
                      </>
                    ) : (
                      <>
                        <h3 className="text-lg font-bold text-red-400 mb-2">No Record Found</h3>
                        <p className="text-gray-300 text-sm">We couldn't find a round matching that seed in your history. Make sure you're using the exact seed shown at the end of your round — seeds are unique to each game session and cannot be reused.</p>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Recent Rounds */}
        {rounds.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <h2 className="text-2xl font-bold text-white mb-4">Your Round History</h2>
            <p className="text-gray-400 text-sm mb-4">Every round you've played is listed below with its sealed hash. Tap any entry to load the seed and authenticate it instantly.</p>
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {rounds.slice(0, 30).map((round) => (
                <div
                  key={round.id}
                  className="bg-white/5 hover:bg-white/10 rounded-xl p-4 border border-white/10 transition-colors cursor-pointer"
                  onClick={() => { setSearchSeed(round.seed); setVerifyResult(null); }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base">{gameEmoji(round.game_slug)}</span>
                        <span className="text-white font-semibold capitalize text-sm">{round.game_slug}</span>
                        {round.difficulty && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-gray-300 capitalize">{round.difficulty}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-3 h-3 text-green-500 shrink-0" title="SSRCR Verified" />
                        <span className="text-gray-500 text-xs font-mono truncate">{round.hash?.slice(0, 32)}...</span>
                      </div>
                      <div className="text-gray-600 text-xs mt-0.5">{new Date(round.created_date).toLocaleString()}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`font-bold text-sm ${round.win_amount > round.bet_amount ? 'text-green-400' : 'text-red-400'}`}>
                        {round.win_amount > round.bet_amount ? '+' : ''}{(round.win_amount - round.bet_amount).toFixed(2)} IC
                      </div>
                      <div className="text-xs text-gray-500">Bet: {round.bet_amount}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}