import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { touchTargetClasses } from '@/components/mobile/TouchOptimized';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, Hand, Plus, Check } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// Map server suit codes to display symbols
const SUIT_DISPLAY = { S: '♠', H: '♥', D: '♦', C: '♣' };

const getCardValue = (cards) => {
  let value = 0;
  let aces = 0;
  for (let card of cards) {
    if (card.value === 'A') {
      aces++;
      value += 11;
    } else if (['K', 'Q', 'J'].includes(card.value)) {
      value += 10;
    } else {
      value += parseInt(card.value);
    }
  }
  while (value > 21 && aces > 0) {
    value -= 10;
    aces--;
  }
  return value;
};

const Card = ({ card, hidden = false, index }) => {
  const suitSymbol = SUIT_DISPLAY[card.suit] || card.suit;
  const isRed = !hidden && (card.suit === 'H' || card.suit === 'D' || card.suit === '♥' || card.suit === '♦');
  return (
    <motion.div
      initial={{ y: -40, opacity: 0, rotateY: 90 }}
      animate={{ y: 0, opacity: 1, rotateY: 0 }}
      transition={{ delay: index * 0.12, type: 'spring', stiffness: 200, damping: 18 }}
      className="relative flex-shrink-0"
      style={{ width: 56, height: 80 }}
    >
      {hidden ? (
        <div
          className="w-full h-full rounded-lg shadow-xl"
          style={{
            background: 'repeating-linear-gradient(45deg,#1e3a8a,#1e3a8a 4px,#1d4ed8 4px,#1d4ed8 8px)',
            border: '2px solid #3b82f6',
          }}
        />
      ) : (
        <div
          className="w-full h-full rounded-lg bg-white shadow-xl flex flex-col justify-between p-1"
          style={{ border: '1px solid #ddd' }}
        >
          <div className={`text-xs font-black leading-none ${isRed ? 'text-red-600' : 'text-gray-900'}`}>
            <div>{card.value}</div>
            <div>{suitSymbol}</div>
          </div>
          <div className={`text-center text-xl font-black ${isRed ? 'text-red-600' : 'text-gray-900'}`}>
            {suitSymbol}
          </div>
          <div className={`text-xs font-black leading-none text-right rotate-180 ${isRed ? 'text-red-600' : 'text-gray-900'}`}>
            <div>{card.value}</div>
            <div>{suitSymbol}</div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default function BlackjackGame({ wallet, onBet, currency = 'IC' }) {
  const balance = currency === 'ID' ? (wallet?.cat_dollars || 0) : (wallet?.tokens || 0);
  const [deck, setDeck] = useState([]);
  const [playerHand, setPlayerHand] = useState([]);
  const [dealerHand, setDealerHand] = useState([]);
  const [bet, setBet] = useState(0.01);
  const [gameState, setGameState] = useState('betting'); // betting, playing, dealer, ended
  const [result, setResult] = useState(null);
  
  const [betMode, setBetMode] = useState('manual');
  const [autoConfig, setAutoConfig] = useState({
    numGames: 0,
    stopOnWin: 0,
    stopOnLoss: 0,
  });
  const [autoStats, setAutoStats] = useState({
    gamesPlayed: 0,
    totalWon: 0,
    totalLost: 0,
  });
  const [isAutoRunning, setIsAutoRunning] = useState(false);

  const startGame = async () => {
    setGameState('dealing');
    setResult(null);
    const res = await base44.functions.invoke('dealBlackjack', {});
    const { playerHand: player, dealerHand: dealer, deck: remaining } = res.data;

    setDeck(remaining);
    setPlayerHand(player);
    setDealerHand(dealer);
    setGameState('playing');

    if (getCardValue(player) === 21) {
      endGame(remaining, player, dealer);
    }
  };

  const hit = () => {
    const newDeck = [...deck];
    const newHand = [...playerHand, newDeck.pop()];
    setDeck(newDeck);
    setPlayerHand(newHand);

    if (getCardValue(newHand) >= 21) {
      endGame(newDeck, newHand, dealerHand);
    }
  };

  const stand = () => {
    endGame(deck, playerHand, dealerHand);
  };

  const endGame = async (currentDeck, player, dealer) => {
    setGameState('dealer');
    
    // Dealer draws
    let newDealerHand = [...dealer];
    let newDeck = [...currentDeck];
    
    while (getCardValue(newDealerHand) < 17) {
      await new Promise(r => setTimeout(r, 500));
      newDealerHand = [...newDealerHand, newDeck.pop()];
      setDealerHand(newDealerHand);
      setDeck(newDeck);
    }

    // Determine winner
    const playerValue = getCardValue(player);
    const dealerValue = getCardValue(newDealerHand);
    
    let gameResult;
    let winAmount = 0;

    if (playerValue > 21) {
      gameResult = 'bust';
    } else if (dealerValue > 21) {
      gameResult = 'dealer_bust';
      winAmount = bet * 2;
    } else if (playerValue === 21 && player.length === 2) {
      gameResult = 'blackjack';
      winAmount = bet * 2.5;
    } else if (playerValue > dealerValue) {
      gameResult = 'win';
      winAmount = bet * 2;
    } else if (playerValue < dealerValue) {
      gameResult = 'lose';
    } else {
      gameResult = 'push';
      winAmount = bet;
    }

    setResult(gameResult);
    setGameState('ended');
    await onBet(bet, winAmount, 'blackjack');
    
    if (betMode === 'auto' && isAutoRunning) {
      const profit = winAmount - bet;
      const newStats = {
        gamesPlayed: autoStats.gamesPlayed + 1,
        totalWon: autoStats.totalWon + (profit > 0 ? profit : 0),
        totalLost: autoStats.totalLost + (profit < 0 ? Math.abs(profit) : 0),
      };
      setAutoStats(newStats);

      if (autoConfig.numGames > 0 && newStats.gamesPlayed >= autoConfig.numGames) {
        setIsAutoRunning(false);
        return;
      }
      if (autoConfig.stopOnWin > 0 && newStats.totalWon >= autoConfig.stopOnWin) {
        setIsAutoRunning(false);
        return;
      }
      if (autoConfig.stopOnLoss > 0 && newStats.totalLost >= autoConfig.stopOnLoss) {
        setIsAutoRunning(false);
        return;
      }

      setTimeout(() => {
        setGameState('betting');
        setPlayerHand([]);
        setDealerHand([]);
        setResult(null);
        setTimeout(() => startGame(), 500);
      }, 2000);
    }
  };

  const newGame = () => {
    setGameState('betting');
    setPlayerHand([]);
    setDealerHand([]);
    setResult(null);
  };

  const resultMessages = {
    bust: { text: 'BUST!', color: 'text-red-500' },
    dealer_bust: { text: 'DEALER BUST!', color: 'text-green-500' },
    blackjack: { text: 'BLACKJACK!', color: 'text-amber-400' },
    win: { text: 'YOU WIN!', color: 'text-green-500' },
    lose: { text: 'DEALER WINS', color: 'text-red-500' },
    push: { text: 'PUSH', color: 'text-gray-400' },
  };

  return (
    <div className="w-full flex flex-col items-center select-none touch-manipulation" style={{ fontFamily: 'Georgia, serif' }}>

      {/* ── CASINO TABLE ── */}
      <div className="relative w-full max-w-2xl" style={{ perspective: '900px' }}>
        {/* Felt surface with crescent shape via clip-path + transform */}
        <div
          className="relative w-full overflow-hidden touch-manipulation"
          style={{
            background: 'radial-gradient(ellipse at 50% 120%, #0d4a1a 0%, #0a3a14 40%, #072d0f 100%)',
            borderRadius: '50% 50% 10% 10% / 30% 30% 10% 10%',
            border: '6px solid #8B6914',
            boxShadow: '0 8px 40px rgba(0,0,0,0.8), inset 0 2px 8px rgba(255,255,255,0.05)',
            minHeight: '420px',
            paddingBottom: '32px',
            touchAction: 'manipulation',
          }}
        >
          {/* Gold inner border accent */}
          <div
            className="absolute inset-2 pointer-events-none"
            style={{
              borderRadius: '50% 50% 8% 8% / 28% 28% 8% 8%',
              border: '2px solid rgba(212,175,55,0.25)',
            }}
          />

          {/* Dealer area — top arc */}
          <div className="flex flex-col items-center pt-8 pb-2 px-6">
            <div className="text-amber-300/70 text-xs tracking-widest uppercase mb-2 font-sans">
              Dealer {gameState !== 'betting' && (
                <span className="text-white font-bold ml-1">
                  ({gameState === 'playing' ? '?' : getCardValue(dealerHand)})
                </span>
              )}
            </div>
            <div className="flex gap-2 justify-center min-h-[88px] items-center">
              {dealerHand.length === 0 && (
                <div className="w-14 h-20 rounded-lg border-2 border-dashed border-green-700/40 opacity-40" />
              )}
              {dealerHand.map((card, i) => (
                <Card key={i} card={card} hidden={i === 1 && gameState === 'playing'} index={i} />
              ))}
            </div>
          </div>

          {/* Center felt markings */}
          <div className="flex flex-col items-center py-2">
            {/* Result banner */}
            <AnimatePresence>
              {result ? (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  className={`px-8 py-2 rounded-full border-2 text-2xl font-black tracking-widest ${
                    result === 'blackjack' ? 'border-amber-400 text-amber-300 bg-amber-900/40' :
                    result === 'win' || result === 'dealer_bust' ? 'border-green-400 text-green-300 bg-green-900/40' :
                    result === 'push' ? 'border-gray-400 text-gray-300 bg-gray-900/40' :
                    'border-red-500 text-red-400 bg-red-900/30'
                  }`}
                >
                  {resultMessages[result].text}
                </motion.div>
              ) : (
                <div className="flex flex-col items-center gap-1 opacity-20">
                  <div className="w-32 h-px bg-amber-400/60" />
                  <div className="text-amber-400/60 text-xs tracking-[0.4em] uppercase">Blackjack</div>
                  <div className="w-32 h-px bg-amber-400/60" />
                </div>
              )}
            </AnimatePresence>
          </div>

          {/* Bet chip display */}
          {gameState !== 'betting' && (
            <div className="flex justify-center mb-1">
              <div className="w-12 h-12 rounded-full border-4 border-amber-400 bg-amber-900/60 flex items-center justify-center text-amber-300 font-bold text-xs shadow-lg">
                {bet.toFixed(0)}
              </div>
            </div>
          )}

          {/* Player area — bottom arc */}
          <div className="flex flex-col items-center px-6 pb-2">
            <div className="flex gap-2 justify-center min-h-[88px] items-center">
              {playerHand.length === 0 && (
                <div className="w-14 h-20 rounded-lg border-2 border-dashed border-green-700/40 opacity-40" />
              )}
              {playerHand.map((card, i) => (
                <Card key={i} card={card} index={i} />
              ))}
            </div>
            <div className="text-amber-300/70 text-xs tracking-widest uppercase mt-2 font-sans">
              Your Hand {playerHand.length > 0 && (
                <span className="text-white font-bold ml-1">({getCardValue(playerHand)})</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── CONTROLS PANEL ── */}
      <div className="w-full max-w-2xl mt-4 space-y-3 px-2">

        {/* Manual / Auto toggle */}
        <div className="flex gap-2 bg-[#1a1030] rounded-xl p-1 border border-white/10">
          {['manual', 'auto'].map(mode => (
            <button
              key={mode}
              onClick={() => setBetMode(mode)}
              className={`${touchTargetClasses} flex-1 py-2.5 rounded-lg font-bold text-sm capitalize transition-all ${
                betMode === mode
                  ? mode === 'auto' ? 'bg-blue-600 text-white' : 'bg-[#2a1a50] text-white border border-white/20'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* Auto config */}
        {betMode === 'auto' && (
          <div className="bg-[#1a1030] border border-white/10 rounded-xl p-4 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Games (0=∞)', key: 'numGames', parse: parseInt },
                { label: 'Stop Win', key: 'stopOnWin', parse: parseFloat },
                { label: 'Stop Loss', key: 'stopOnLoss', parse: parseFloat },
              ].map(({ label, key, parse }) => (
                <div key={key}>
                  <label className="text-xs text-gray-400 mb-1 block">{label}</label>
                  <input
                    type="number"
                    value={autoConfig[key]}
                    onChange={e => setAutoConfig({ ...autoConfig, [key]: parse(e.target.value) || 0 })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-sm"
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between text-xs text-gray-400">
              <span>Games: <span className="text-white">{autoStats.gamesPlayed}</span></span>
              <span className="text-green-400">+{autoStats.totalWon.toFixed(2)}</span>
              <span className="text-red-400">-{autoStats.totalLost.toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Bet amount */}
        {gameState === 'betting' && (
          <div className="bg-[#1a1030] border border-white/10 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-[12px]">Bet Amount</span>
              <span className="text-2xl font-bold text-amber-400">{bet.toFixed(2)} {currency}</span>
            </div>
            <Slider
              value={[bet]}
              onValueChange={v => setBet(v[0])}
              min={0.01}
              max={Math.min(1000, balance || 1)}
              step={0.01}
            />
            <div className="flex gap-2">
              {[0.25, 0.5, 0.75, 1].map(p => (
                <button
                  key={p}
                  onClick={() => setBet(Math.max(0.01, Math.floor(balance * p * 100) / 100))}
                  className={`${touchTargetClasses} flex-1 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-gray-300 border border-white/10 transition-colors`}
                >
                  {p === 1 ? 'Max' : `${p * 100}%`}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="space-y-3">
          {gameState === 'dealing' && (
            <div className="w-full h-14 flex items-center justify-center text-gray-400 font-bold text-lg">Dealing...</div>
          )}

          {gameState === 'betting' && (
            betMode === 'auto' ? (
              <Button
                onClick={() => {
                  if (isAutoRunning) {
                    setIsAutoRunning(false);
                  } else {
                    setIsAutoRunning(true);
                    setAutoStats({ gamesPlayed: 0, totalWon: 0, totalLost: 0 });
                    startGame();
                  }
                }}
                disabled={bet > balance}
                className={`w-full h-14 text-xl font-bold rounded-xl ${
                  isAutoRunning
                    ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700'
                    : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700'
                }`}
              >
                {isAutoRunning ? 'STOP AUTO' : 'START AUTO'}
              </Button>
            ) : (
              <Button
                onClick={startGame}
                disabled={bet > balance}
                className="w-full h-14 text-xl font-bold rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-black"
              >
                DEAL
              </Button>
            )
          )}

          {gameState === 'playing' && (
            <div className="flex gap-3">
              <Button
                onClick={hit}
                className="flex-1 h-14 text-lg font-bold rounded-xl bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
              >
                <Plus className="w-5 h-5 mr-2" /> HIT
              </Button>
              <Button
                onClick={stand}
                className="flex-1 h-14 text-lg font-bold rounded-xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700"
              >
                <Hand className="w-5 h-5 mr-2" /> STAND
              </Button>
            </div>
          )}

          {gameState === 'ended' && (
            <Button
              onClick={newGame}
              className="w-full h-14 text-xl font-bold rounded-xl bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700"
            >
              <RotateCcw className="w-5 h-5 mr-2" /> NEW GAME
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}