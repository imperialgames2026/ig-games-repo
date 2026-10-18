import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { base44 } from '@/api/base44Client';
import ProvablyFairBadge from '@/components/casino/ProvablyFairBadge';
import useCasinoEffects from '@/hooks/useCasinoEffects';

const HEADS_WIN_MULTIPLIER = 1.98;

export default function CoinFlipGame({ wallet, onBet, currency }) {
  const [betAmount, setBetAmount] = useState(10);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  // phase: 'idle' | 'pick' | 'flipping' | 'won'
  const [phase, setPhase] = useState('idle');
  const [lockedBet, setLockedBet] = useState(0);
  const [pendingWin, setPendingWin] = useState(0);
  const [lastSeed, setLastSeed] = useState(null);
  const [lastHash, setLastHash] = useState(null);

  const balance = currency === 'IC' ? (wallet?.tokens || 0) : (wallet?.cat_dollars || 0);
  const { triggerEffect, effectClassName } = useCasinoEffects();

  const adjustBet = (multiplier) => {
    if (multiplier === 'min') return setBetAmount(1);
    if (multiplier === 'max') return setBetAmount(Math.floor(balance));
    setBetAmount(prev => Math.max(1, Math.min(Math.floor(prev * multiplier), Math.floor(balance))));
  };

  // Step 1: Bet button — deducts funds, waits for side pick
  const handleBet = async () => {
    if (!wallet || betAmount <= 0 || betAmount > balance) return;
    triggerEffect('bet');
    await onBet(betAmount, 0, 'coinflip'); // deduct bet
    setLockedBet(betAmount);
    setPendingWin(0);
    setResult(null);
    setPhase('pick');
  };

  // Cash Out — collect pending winnings and go idle
  const handleCashOut = async () => {
    triggerEffect('cashout');
    await onBet(0, pendingWin, 'coinflip'); // credit winnings
    setPhase('idle');
    setResult(null);
    setPendingWin(0);
  };

  // Pick heads or tails → flip
  const handlePickSide = async (side) => {
    if (phase !== 'pick' && phase !== 'won') return;
    setPhase('flipping');

    await new Promise(r => setTimeout(r, 1500));

    const bet = phase === 'won' ? pendingWin : lockedBet;
    const response = await base44.functions.invoke('generateCoinFlipOutcomeSSRCR', {
      bet_amount: bet,
      chosen_side: side,
      currency,
    });
    const data = response.data;
    const outcome = data.outcome;
    const won = data.won;
    triggerEffect(won ? 'win' : 'lose');
    const winAmount = data.win_amount;

    setLastSeed(data.seed);
    setLastHash(data.hash);
    setResult({ outcome, won, winAmount });
    setHistory(prev => [{ outcome, won, bet }, ...prev].slice(0, 20));

    if (won) {
      setPendingWin(winAmount);
      setPhase('won');
    } else {
      // Already deducted, nothing to credit
      setPendingWin(0);
      setPhase('idle');
    }
  };

  return (
    <div className={`bg-[#1A1528] rounded-2xl p-6 space-y-6 transition-all duration-300 ${effectClassName}`}>
      {/* Coin Display */}
      <div className="flex justify-center">
        <div className="relative w-40 h-40">
          <AnimatePresence mode="wait">
            {phase === 'flipping' ? (
              <motion.div
                key="flipping"
                animate={{ rotateY: [0, 180, 360, 540, 720, 900, 1080] }}
                transition={{ duration: 1.4, ease: 'easeInOut' }}
                className="w-40 h-40 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shadow-[0_0_40px_rgba(234,179,8,0.5)] border-4 border-yellow-300"
              >
                <span className="text-5xl">🪙</span>
              </motion.div>
            ) : result ? (
              <motion.div
                key={result.outcome}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={`w-40 h-40 rounded-full flex items-center justify-center shadow-lg border-4 ${
                  result.won
                    ? 'bg-gradient-to-br from-green-400 to-green-600 border-green-300 shadow-green-500/50'
                    : 'bg-gradient-to-br from-red-500 to-red-700 border-red-400 shadow-red-500/50'
                }`}
              >
                <div className="text-center">
                  <div className="text-4xl">{result.outcome === 'heads' ? '👑' : '🔱'}</div>
                  <div className="text-white font-bold text-sm mt-1 capitalize">{result.outcome}</div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                className="w-40 h-40 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center border-4 border-yellow-300 shadow-[0_0_20px_rgba(234,179,8,0.3)]"
              >
                <div className="text-center">
                  <div className="text-5xl">🪙</div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Result Banner */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`text-center py-3 rounded-xl font-bold text-lg ${
              result.won ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            }`}
          >
            {result.won ? `🎉 You won ${result.winAmount.toFixed(2)} ${currency}!` : `💸 It landed on ${result.outcome}. Better luck next time!`}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bet Controls — only shown in idle */}
      {phase === 'idle' && (
        <div>
          <p className="text-gray-400 text-sm mb-2">Bet Amount</p>
          <div className="flex gap-2 mb-2">
            <Input
              type="number"
              value={betAmount}
              onChange={e => setBetAmount(Math.max(1, Number(e.target.value)))}
              className="bg-white/5 border-white/10 text-white flex-1"
            />
          </div>
          <div className="flex gap-2">
            {[['Min', 'min'], ['½', 0.5], ['2×', 2], ['Max', 'max']].map(([label, val]) => (
              <button
                key={label}
                onClick={() => adjustBet(val)}
                className="flex-1 py-1.5 text-xs bg-white/10 hover:bg-white/20 text-gray-300 rounded-lg transition-colors"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Payout Info */}
      <div className="flex justify-between text-sm text-gray-400 bg-white/5 rounded-xl px-4 py-3">
        <span>Multiplier: <span className="text-yellow-400 font-bold">{HEADS_WIN_MULTIPLIER}x</span></span>
        <span>
          {phase === 'won'
            ? <><span className="text-green-400 font-bold">Holding: {pendingWin.toFixed(2)} {currency}</span></>
            : <>Win: <span className="text-green-400 font-bold">{((phase === 'pick' ? lockedBet : betAmount) * HEADS_WIN_MULTIPLIER).toFixed(2)}</span></>
          }
        </span>
      </div>

      {/* BET button — idle = place bet, won = cash out */}
      {(phase === 'idle' || phase === 'won') && (
        <Button
          onClick={phase === 'won' ? handleCashOut : handleBet}
          disabled={phase === 'idle' && (betAmount > balance || betAmount <= 0)}
          className={`w-full h-14 text-lg font-bold rounded-xl disabled:opacity-50 ${
            phase === 'won'
              ? 'bg-gradient-to-r from-green-400 to-green-600 hover:from-green-500 hover:to-green-700 text-black'
              : 'bg-gradient-to-r from-yellow-400 to-yellow-600 hover:from-yellow-500 hover:to-yellow-700 text-black'
          }`}
        >
          {phase === 'won' ? `💰 Cash Out ${pendingWin.toFixed(2)} ${currency}` : '🪙 Bet'}
        </Button>
      )}

      {/* Pick side — shown after bet is placed OR to flip again after win */}
      {(phase === 'pick' || phase === 'won') && (
        <div>
          <p className="text-center text-white font-bold mb-3">
            {phase === 'won' ? '🔄 Flip Again?' : 'Pick a side!'}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {['heads', 'tails'].map(side => (
              <button
                key={side}
                onClick={() => handlePickSide(side)}
                className="py-4 rounded-xl font-bold capitalize transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-yellow-400 to-yellow-600 hover:from-yellow-500 hover:to-yellow-700 text-black shadow-[0_0_20px_rgba(234,179,8,0.4)] text-lg"
              >
                <span>{side === 'heads' ? '👑' : '🔱'}</span>
                {side}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Flipping state */}
      {phase === 'flipping' && (
        <div className="text-center text-yellow-400 font-bold text-lg animate-pulse">🪙 Flipping...</div>
      )}

      {/* History */}
      {lastHash && <ProvablyFairBadge seed={lastSeed} hash={lastHash} />}

      {history.length > 0 && (
        <div>
          <p className="text-gray-400 text-sm mb-2">Recent Results</p>
          <div className="flex flex-wrap gap-2">
            {history.map((h, i) => (
              <div
                key={i}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                  h.won ? 'bg-green-500/30 text-green-400' : 'bg-red-500/30 text-red-400'
                }`}
                title={`${h.outcome} — ${h.won ? 'Win' : 'Loss'}`}
              >
                {h.outcome === 'heads' ? '👑' : '🔱'}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}