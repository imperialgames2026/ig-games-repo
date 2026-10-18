import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { base44 } from '@/api/base44Client';
import ProvablyFairBadge from '@/components/casino/ProvablyFairBadge';
import { toast } from 'sonner';
import useCasinoEffects from '@/hooks/useCasinoEffects';

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = ['♥', '♦', '♣', '♠'];
const RANK_VALUE = {};
RANKS.forEach((r, i) => RANK_VALUE[r] = i + 1);

const SAME_STEP_MULT = 15;
const INITIAL_MULT = 0.98; // 2% house edge baked in

function randomCard() {
  return {
    rank: RANKS[Math.floor(Math.random() * 13)],
    suit: SUITS[Math.floor(Math.random() * 4)],
    id: Date.now() + Math.random(),
  };
}

function getChoices(rank) {
  const rv = RANK_VALUE[rank];
  const total = 52;
  const sameProb = 4 / total;
  const higherProb = (13 - rv) * 4 / total;
  const lowerProb = (rv - 1) * 4 / total;

  if (rank === 'A') {
    return [
      { key: 'higherOrSame', label: 'Higher Or Same', prob: higherProb + sameProb, dir: 'up' },
      { key: 'same', label: 'Same', prob: sameProb, dir: 'eq' },
    ];
  } else if (rank === 'K') {
    return [
      { key: 'same', label: 'Same', prob: sameProb, dir: 'eq' },
      { key: 'lowerOrSame', label: 'Lower', prob: lowerProb, dir: 'down' },
    ];
  } else {
    return [
      { key: 'higherOrSame', label: 'Higher Or Same', prob: higherProb + sameProb, dir: 'up' },
      { key: 'lowerOrSame', label: 'Lower Or Same', prob: lowerProb + sameProb, dir: 'down' },
    ];
  }
}

function checkWin(guessKey, prevRank, nextRank) {
  const pv = RANK_VALUE[prevRank];
  const nv = RANK_VALUE[nextRank];
  if (guessKey === 'higherOrSame') return nv >= pv;
  if (guessKey === 'lowerOrSame') return nv <= pv;
  if (guessKey === 'same') return nv === pv;
  return false;
}

function getStepMult(choiceKey, prob) {
  if (choiceKey === 'same') return SAME_STEP_MULT;
  return 1 / prob;
}

// ─── Playing Card ───────────────────────────────────────────────────
function PlayingCard({ card, size = 'lg', badge, arrowDir, lost }) {
  const isRed = card.suit === '♥' || card.suit === '♦';
  const lg = size === 'lg';

  const arrowColor =
    arrowDir === 'up' ? 'bg-green-500' :
    arrowDir === 'down' ? 'bg-blue-500' :
    arrowDir === 'eq' ? 'bg-yellow-500' : '';

  const arrowSymbol =
    arrowDir === 'up' ? '↑' :
    arrowDir === 'down' ? '↓' :
    arrowDir === 'eq' ? '=' : '';

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className={`relative bg-white rounded-xl shadow-2xl flex flex-col justify-between border-2
        ${lost ? 'border-red-500' : 'border-gray-100'}
        ${lg ? 'w-36 h-52 p-3' : 'w-14 h-[4.5rem] p-1.5'}`}>
        {arrowDir && (
          <div className={`absolute -top-2 -right-2 z-10 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold shadow ${arrowColor}`}>
            {arrowSymbol}
          </div>
        )}
        <div>
          <div className={`font-black leading-tight ${isRed ? 'text-red-500' : 'text-gray-900'} ${lg ? 'text-4xl' : 'text-sm'}`}>
            {card.rank}
          </div>
          <div className={`leading-none ${isRed ? 'text-red-500' : 'text-gray-900'} ${lg ? 'text-2xl' : 'text-xs'}`}>
            {card.suit}
          </div>
        </div>
        <div className="flex items-center justify-center flex-1">
          <span className={`${isRed ? 'text-red-500' : 'text-gray-900'} ${lg ? 'text-6xl' : 'text-2xl'}`}>
            {card.suit}
          </span>
        </div>
      </div>
      {badge && (
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full
          ${badge === 'Start Card' ? 'bg-green-600 text-white' :
            badge === '0x' ? 'bg-red-600 text-white' :
            'bg-[#2a2040] text-gray-200'}`}>
          {badge}
        </span>
      )}
    </div>
  );
}

// ─── Probability Triangle ────────────────────────────────────────────
function ProbTriangle({ dir, label, prob }) {
  const isUp = dir === 'up';
  const isEq = dir === 'eq';
  const pct = (prob * 100).toFixed(2);

  const fill = isUp ? '#6b5c00' : isEq ? '#7a3a00' : '#003f5e';
  const stroke = isUp ? '#d4b200' : isEq ? '#d47700' : '#00a8d4';

  return (
    <div className="relative w-36 h-28 flex items-center justify-center select-none">
      <svg viewBox="0 0 120 100" className="w-full h-full" fill="none">
        {isUp || isEq
          ? <polygon points="60,8 112,92 8,92" fill={fill} stroke={stroke} strokeWidth="2.5" />
          : <polygon points="60,92 112,8 8,8" fill={fill} stroke={stroke} strokeWidth="2.5" />
        }
      </svg>
      <div className={`absolute inset-0 flex flex-col items-center justify-center ${isUp || isEq ? 'pt-5' : 'pb-5'}`}>
        <span className="text-white font-black text-base leading-tight">{pct}%</span>
        <span className={`text-xs font-medium ${isUp ? 'text-yellow-300' : isEq ? 'text-orange-300' : 'text-cyan-300'}`}>{label}</span>
      </div>
    </div>
  );
}

// ─── Choice Button ───────────────────────────────────────────────────
function ChoiceButton({ choice, onClick, disabled }) {
  const colors =
    choice.dir === 'up' ? 'bg-yellow-900/40 border-yellow-600 text-yellow-300 hover:bg-yellow-800/50' :
    choice.dir === 'eq' ? 'bg-orange-900/40 border-orange-600 text-orange-300 hover:bg-orange-800/50' :
    'bg-cyan-900/40 border-cyan-600 text-cyan-300 hover:bg-cyan-800/50';

  const symbol = choice.dir === 'up' ? '↑' : choice.dir === 'down' ? '↓' : '=';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border font-bold transition-all hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed ${colors}`}
    >
      <span className="text-2xl">{symbol}</span>
      <div className="text-left">
        <div className="text-sm font-bold">{choice.label}</div>
        <div className="text-xs opacity-70">{(choice.prob * 100).toFixed(2)}%</div>
      </div>
    </button>
  );
}

// ─── Main Game Component ─────────────────────────────────────────────
export default function HiLoGame({ wallet, currency, onBet, onWin, onLoss }) {
  const [phase, setPhase] = useState('idle'); // idle | playing | result
  const [betAmount, setBetAmount] = useState(10);
  const initCard = useMemo(() => randomCard(), []);
  const [currentCard, setCurrentCard] = useState(initCard);
  const [cardHistory, setCardHistory] = useState([{ card: initCard, badge: 'Start Card', arrowDir: null, lost: false }]);
  const [totalMult, setTotalMult] = useState(INITIAL_MULT);
  const [betPlaced, setBetPlaced] = useState(0);
  const [isWin, setIsWin] = useState(false);
  const [resultText, setResultText] = useState('');
  const [lastSeed, setLastSeed] = useState(null);
  const [lastHash, setLastHash] = useState(null);
  const { triggerEffect, effectClassName } = useCasinoEffects();

  const balance = currency === 'IC' ? (wallet?.tokens || 0) : (wallet?.cat_dollars || 0);
  const payout = Math.floor(betPlaced * totalMult);
  const choices = currentCard ? getChoices(currentCard.rank) : [];

  const startGame = () => {
    const amt = parseFloat(betAmount);
    if (!amt || amt <= 0 || amt > balance) {
      toast.error('Invalid bet amount');
      return;
    }
    triggerEffect('bet');
    onBet(amt);
    const card = randomCard();
    setBetPlaced(amt);
    setLastSeed(null);
    setLastHash(null);
    setCurrentCard(card);
    setCardHistory([{ card, badge: 'Start Card', arrowDir: null, lost: false }]);
    setTotalMult(INITIAL_MULT);
    setPhase('playing');
  };

  const makeGuess = async (choice) => {
    const response = await base44.functions.invoke('generateHiLoOutcomeSSRCR', {
      bet_amount: betPlaced,
      current_rank: currentCard.rank,
      guess_type: choice.key === 'higherOrSame' ? 'higher' : choice.key === 'lowerOrSame' ? 'lower' : 'same',
      currency,
    });
    const data = response.data;
    const nextCard = {
      rank: data.next_rank,
      suit: SUITS[Math.floor(Math.random() * SUITS.length)],
      id: Date.now() + Math.random(),
    };
    const won = data.won;
    const stepMult = won ? Math.max(1, data.win_amount / Math.max(betPlaced, 0.01)) : getStepMult(choice.key, choice.prob);
    setLastSeed(data.seed);
    setLastHash(data.hash);

    // Mark current card with arrow
    setCardHistory(prev => {
      const updated = [...prev];
      updated[updated.length - 1] = { ...updated[updated.length - 1], arrowDir: choice.dir };
      return updated;
    });

    if (won) {
      triggerEffect('action');
      const newMult = totalMult * stepMult;
      setTotalMult(newMult);
      setCurrentCard(nextCard);
      setCardHistory(prev => [
        ...prev.slice(0, -1),
        { ...prev[prev.length - 1], arrowDir: choice.dir },
        { card: nextCard, badge: `${newMult.toFixed(2)}x`, arrowDir: null, lost: false },
      ]);
      toast.success(`✓ Correct! ${newMult.toFixed(4)}x`);
    } else {
      triggerEffect('lose');
      // Lost
      setCardHistory(prev => [
        ...prev.slice(0, -1),
        { ...prev[prev.length - 1], arrowDir: choice.dir },
        { card: nextCard, badge: '0x', arrowDir: null, lost: true },
      ]);
      onLoss(betPlaced);
      setResultText(`Wrong! The card was ${nextCard.rank}${nextCard.suit}. You lost ${betPlaced.toLocaleString()} ${currency}.`);
      setIsWin(false);
      setPhase('result');
    }
  };

  const skip = () => {
    const nextCard = randomCard();
    setCurrentCard(nextCard);
    setCardHistory(prev => [
      ...prev,
      { card: nextCard, badge: `${totalMult.toFixed(2)}x`, arrowDir: null, lost: false },
    ]);
  };

  const cashOut = () => {
    const amt = Math.floor(betPlaced * totalMult);
    triggerEffect('cashout');
    onWin(amt, betPlaced);
    setResultText(`Cashed out at ${totalMult.toFixed(4)}x! You won ${amt.toLocaleString()} ${currency}.`);
    setIsWin(true);
    setPhase('result');
  };

  const reset = () => {
    const card = randomCard();
    setPhase('idle');
    setCurrentCard(card);
    setCardHistory([{ card, badge: 'Start Card', arrowDir: null, lost: false }]);
    setTotalMult(INITIAL_MULT);
    setBetPlaced(0);
    setResultText('');
  };

  return (
    <div className={`min-h-screen bg-[#0f0b1e] text-white flex flex-col items-center px-4 pt-4 pb-8 transition-all duration-300 ${effectClassName}`}>
      {/* Status */}
      <p className="text-gray-400 text-sm mb-5">
        {phase === 'idle' && 'Place your bet to start'}
        {phase === 'playing' && 'Game result will be displayed'}
        {phase === 'result' && (isWin ? '🎉 You won!' : '💀 Better luck next time')}
      </p>

      {/* Game area — always visible */}
      {currentCard && (
        <div className="flex items-center gap-6 mb-6 w-full justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentCard.id}
              initial={{ scale: 0.85, opacity: 0, rotateY: -90 }}
              animate={{ scale: 1, opacity: 1, rotateY: 0 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <div className="flex flex-col items-center gap-2">
                <PlayingCard card={currentCard} size="lg" />
                {phase === 'playing' && (
                  <button
                    onClick={skip}
                    className="text-sm text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 px-4 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                  >
                    Skip ⏭
                  </button>
                )}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Probability triangles — shown in idle and playing */}
          {phase !== 'result' && (
            <div className="flex flex-col gap-3">
              {choices.map(choice => (
                <button
                  key={choice.key}
                  onClick={() => phase === 'playing' && makeGuess(choice)}
                  className={`hover:scale-105 transition-transform ${phase === 'idle' ? 'cursor-default opacity-70' : ''}`}
                >
                  <ProbTriangle dir={choice.dir} label={choice.label} prob={choice.prob} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Card history */}
      {cardHistory.length > 0 && (
        <div className="w-full max-w-lg mb-4">
          <div className="flex gap-2 overflow-x-auto pb-2 justify-start">
            {cardHistory.map((item, i) => (
              <div key={i} className="flex-shrink-0">
                <PlayingCard card={item.card} size="sm" badge={item.badge} arrowDir={item.arrowDir} lost={item.lost} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Total payout */}
      {phase === 'playing' && (
        <div className="text-gray-400 text-sm mb-4">
          Total Payout{' '}
          <span className="text-white font-semibold">({totalMult.toFixed(4)}x)</span>
          {' '} = <span className="text-yellow-400 font-bold">{payout.toLocaleString()} {currency}</span>
        </div>
      )}

      {/* Result banner */}
      {phase === 'result' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`w-full max-w-sm text-center p-4 rounded-xl mb-4 border ${
            isWin ? 'bg-green-900/30 border-green-500/40 text-green-300' : 'bg-red-900/30 border-red-500/40 text-red-300'
          }`}
        >
          <p className="font-bold">{resultText}</p>
        </motion.div>
      )}

      {lastHash && <div className="w-full max-w-sm mb-4"><ProvablyFairBadge seed={lastSeed} hash={lastHash} /></div>}

      {/* Controls */}
      <div className="w-full max-w-sm space-y-3">
        {phase === 'playing' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              {choices.map(choice => (
                <ChoiceButton key={choice.key} choice={choice} onClick={() => makeGuess(choice)} />
              ))}
            </div>
            <button
              onClick={cashOut}
              className="w-full bg-yellow-600 hover:bg-yellow-500 text-black font-bold text-base py-4 rounded-xl transition-all hover:scale-[1.02]"
            >
              Cash Out {payout.toLocaleString()} {currency}
            </button>
          </>
        )}

        {phase === 'idle' && (
          <>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-gray-400 text-xs">Amount</label>
                <span className="text-gray-500 text-xs">Balance: {balance.toLocaleString()} {currency}</span>
              </div>
              <div className="flex gap-2 items-center">
                <Input
                  type="number"
                  value={betAmount}
                  onChange={e => setBetAmount(parseFloat(e.target.value) || 0)}
                  className="bg-white/10 border-white/20 text-white flex-1"
                  min={1}
                />
                <button onClick={() => setBetAmount(v => Math.max(1, Math.floor(v / 2)))} className="px-3 py-2 rounded-lg bg-white/10 text-white text-sm font-bold hover:bg-white/20 transition-colors">½</button>
                <button onClick={() => setBetAmount(v => Math.min(balance, v * 2))} className="px-3 py-2 rounded-lg bg-white/10 text-white text-sm font-bold hover:bg-white/20 transition-colors">2×</button>
              </div>
            </div>
            <div className="flex gap-2">
              {[10, 50, 100, 500].map(v => (
                <button key={v} onClick={() => setBetAmount(Math.min(balance, v))} className="flex-1 py-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 text-xs transition-colors">
                  {v >= 1000 ? `${v/1000}K` : v}
                </button>
              ))}
            </div>
            <button onClick={startGame} className="w-full bg-yellow-600 hover:bg-yellow-500 text-black font-bold text-lg py-4 rounded-xl transition-all hover:scale-[1.02]">
              Bet
            </button>
          </>
        )}

        {phase === 'result' && (
          <button onClick={startGame} className="w-full bg-pink-600 hover:bg-pink-500 text-white font-bold text-lg py-4 rounded-xl transition-all hover:scale-[1.02]">
            Bet Again
          </button>
        )}
      </div>
    </div>
  );
}