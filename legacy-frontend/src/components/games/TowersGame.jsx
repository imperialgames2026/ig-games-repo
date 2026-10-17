import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, Zap } from 'lucide-react';

import { base44 } from '@/api/base44Client';
import ProvablyFairBadge from '@/components/casino/ProvablyFairBadge';
import useCasinoEffects from '@/hooks/useCasinoEffects';

const DIFFICULTY_CONFIG = {
  easy: { mines: 1, label: 'Easy', emoji: '🍎', multipliers: [1.30, 1.74, 2.32, 3.10, 4.13, 5.51, 7.34, 9.79, 13.05] },
  medium: { mines: 2, label: 'Medium', emoji: '🔺', multipliers: [1.65, 2.47, 3.71, 5.56, 8.35, 12.52, 18.79, 28.18, 42.27] },
  hard: { mines: 2, label: 'Hard', emoji: '🧡', multipliers: [2.20, 3.67, 6.11, 10.19, 16.98, 28.30, 47.17, 78.61, 131.02] },
  extreme: { mines: 2, label: 'Extreme', emoji: '🧈', multipliers: [2.94, 5.82, 12.96, 29.38, 73.45, 183.63, 459.07, 1147.68, 2869.19] },
  nightmare: { mines: 3, label: 'Nightmare', emoji: '🟢', multipliers: [4.40, 11.00, 30.25, 90.75, 272.25, 816.75, 2450.25, 7350.75, 22052.25] }
};

const LEVELS = 9;
const TILES_PER_LEVEL = 3;

export default function TowersGame({ wallet, onBet, currency = 'IC' }) {
  const [betAmount, setBetAmount] = useState(0.01);
  const [difficulty, setDifficulty] = useState('easy');
  const [gameActive, setGameActive] = useState(false);
  const [currentLevel, setCurrentLevel] = useState(0);
  const [tiles, setTiles] = useState([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [lostLevel, setLostLevel] = useState(null);
  const [roundWinnings, setRoundWinnings] = useState(0);
  const [gameHistory, setGameHistory] = useState([]);
  const [roundSeed, setRoundSeed] = useState(null);
  const [roundHash, setRoundHash] = useState(null);
  const [loading, setLoading] = useState(false);
  const { triggerEffect, effectClassName } = useCasinoEffects();

  const config = DIFFICULTY_CONFIG[difficulty];
  const multipliers = config.multipliers;
  const currentMultiplier = multipliers[currentLevel] || 1;

  const startGame = async () => {
    setLoading(true);
    triggerEffect('bet');
    const { data } = await base44.functions.invoke('generateTowersOutcome', { bet: betAmount, difficulty, currency: 'IC' });
    setLoading(false);

    if (!data?.success) return;

    setRoundSeed(data.seed);
    setRoundHash(data.hash);

    // Build tile layout from server response
    const newTiles = [];
    for (let level = 0; level < LEVELS; level++) {
      const mineIndices = data.tile_layout[level] || [];
      const levelTiles = [];
      for (let i = 0; i < TILES_PER_LEVEL; i++) {
        levelTiles.push({ id: `${level}-${i}`, isMine: mineIndices.includes(i), revealed: false, level });
      }
      newTiles.push(levelTiles);
    }

    setTiles(newTiles);
    setGameStarted(true);
    setGameActive(true);
    setCurrentLevel(0);
    setLostLevel(null);
    setRoundWinnings(0);
  };

  const handleTileClick = (tileIndex) => {
    if (!gameActive || !tiles[currentLevel]) return;

    const newTiles = tiles.map(level => [...level]);
    const tile = newTiles[currentLevel][tileIndex];
    tile.revealed = true;

    setTiles(newTiles);

    if (tile.isMine) {
      triggerEffect('lose');
      // Game over - hit a mine
      setGameActive(false);
      setLostLevel(currentLevel);
      if (onBet) {
        onBet(betAmount, 0);
      }
      setGameHistory(prev => [...prev, { level: currentLevel, result: 'lost', winnings: 0 }]);
    } else {
      triggerEffect('action');
      // Safe - advance to next level
      const nextLevel = currentLevel + 1;
      if (nextLevel < LEVELS) {
        setCurrentLevel(nextLevel);
        // Apply 4% house edge to winnings
        const rawWinnings = betAmount * multipliers[nextLevel];
        const winningsAfterEdge = rawWinnings * 0.96;
        setRoundWinnings(winningsAfterEdge);
      } else {
        // Won the game!
        setGameActive(false);
        // Apply 4% house edge to final payout
        const rawWinnings = betAmount * multipliers[LEVELS - 1];
        const finalWinnings = rawWinnings * 0.96;
        setRoundWinnings(finalWinnings);
        if (onBet) {
          onBet(betAmount, finalWinnings);
        }
        setGameHistory(prev => [...prev, { level: LEVELS, result: 'won', winnings: finalWinnings }]);
      }
    }
  };

  const cashOut = () => {
    if (roundWinnings > 0 && gameActive) {
      triggerEffect('cashout');
      setGameActive(false);
      // Round winnings already have 4% house edge applied
      if (onBet) {
        onBet(betAmount, roundWinnings);
      }
      setGameHistory(prev => [...prev, { level: currentLevel, result: 'cashed_out', winnings: roundWinnings }]);
    }
  };

  const resetGame = () => {
    setGameStarted(false);
    setGameActive(false);
    setTiles([]);
    setCurrentLevel(0);
    setLostLevel(null);
    setRoundWinnings(0);
    setRoundSeed(null);
    setRoundHash(null);
  };

  return (
    <div className={`space-y-6 transition-all duration-300 ${effectClassName}`}>
      {/* Winnings Display */}
      {gameStarted && (
        <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 rounded-xl p-6 border border-purple-500/30">
          <div className="text-center">
            <p className="text-sm text-gray-400 mb-2">Current Winnings</p>
            <p className="text-4xl font-bold text-green-400">
              {roundWinnings > 0 ? roundWinnings.toLocaleString() : betAmount.toLocaleString()} IC
            </p>
            <p className="text-sm text-gray-400 mt-2">Level {currentLevel + 1} / {LEVELS}</p>
          </div>
        </div>
      )}

      {/* Game Board */}
      <div className="space-y-3">
        {gameStarted ? (
          <>
            {tiles.map((levelTiles, levelIdx) => (
              <motion.div
                key={levelIdx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 rounded-lg ${levelIdx <= currentLevel ? 'bg-blue-900/30 border border-blue-500/50' : 'bg-gray-800/30 border border-gray-700/30 opacity-50'}`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-sm font-bold text-white">Level {levelIdx + 1}</span>
                  <span className="text-sm text-green-400 font-mono">{multipliers[levelIdx]}x</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {levelTiles.map((tile, tileIdx) => (
                    <motion.button
                      key={tile.id}
                      onClick={() => handleTileClick(tileIdx)}
                      disabled={!gameActive || currentLevel !== levelIdx}
                      whileTap={{ scale: 0.95 }}
                      className={`aspect-square rounded-lg font-bold text-lg transition-all ${
                        !tile.revealed
                          ? 'bg-gradient-to-br from-gray-600 to-gray-700 hover:from-gray-500 hover:to-gray-600 cursor-pointer'
                          : tile.isMine
                          ? 'bg-red-600 text-white cursor-default'
                          : 'bg-green-600 text-white cursor-default'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {tile.revealed && (tile.isMine ? '💣' : '✓')}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            ))}
          </>
        ) : (
          <div className="bg-gray-800/50 rounded-lg p-12 text-center">
            <p className="text-gray-400">Click "Bet" to start the game</p>
          </div>
        )}
      </div>

      {/* Game Over / Result */}
      <AnimatePresence>
        {!gameActive && gameStarted && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-gradient-to-r from-yellow-900/50 to-orange-900/50 rounded-xl p-6 border border-yellow-500/30 text-center"
          >
            {lostLevel !== null ? (
              <>
                <p className="text-2xl font-bold text-red-400 mb-2">Game Over!</p>
                <p className="text-gray-300">Hit a mine on Level {lostLevel + 1}</p>
              </>
            ) : roundWinnings > 0 ? (
              <>
                <p className="text-2xl font-bold text-green-400 mb-2">You Won!</p>
                <p className="text-xl text-gray-300">
                  {roundWinnings.toLocaleString()} IC
                </p>
              </>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls */}
      <div className="space-y-4 bg-white/5 rounded-xl p-4">
        {!gameStarted ? (
          <>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Bet Amount</label>
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="number"
                  value={betAmount}
                  onChange={(e) => setBetAmount(Math.max(0.01, parseFloat(e.target.value) || 0.01))}
                  className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white outline-none"
                  step="0.01"
                  min="0.01"
                />
              </div>
              <div className="flex gap-2">
                {[0.01, 1, 10, 100, 1000].map(v => (
                  <Button
                    key={v}
                    variant="outline"
                    size="sm"
                    onClick={() => setBetAmount(v)}
                    className="flex-1 bg-white/10 text-white border-white/20"
                  >
                    {v}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Difficulty</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white outline-none"
              >
                {Object.entries(DIFFICULTY_CONFIG).map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.emoji} {cfg.label}</option>
                ))}
              </select>
            </div>

            <Button
              onClick={startGame}
              disabled={betAmount > (wallet?.tokens || 0) || loading}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold h-12"
            >
              <Zap className="w-4 h-4 mr-2" />
              {loading ? 'Loading...' : 'Bet'}
            </Button>

            {betAmount > (wallet?.tokens || 0) && (
              <p className="text-red-400 text-sm text-center">Insufficient balance</p>
            )}
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={startGame}
              disabled={betAmount > (wallet?.tokens || 0) || loading}
              variant="outline"
              className="bg-white/10 text-white border-white/20 hover:bg-white/20"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              {loading ? 'Loading...' : 'Bet Again'}
            </Button>
            {gameActive && (
              <Button
                onClick={cashOut}
                disabled={roundWinnings === 0}
                className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-black font-bold"
              >
                Cash Out
              </Button>
            )}
          </div>
        )}
      </div>

      {/* SSRCR Verification */}
      {roundHash && <ProvablyFairBadge seed={roundSeed} hash={roundHash} />}

      {/* Difficulty Info */}
      <div className="bg-white/5 rounded-xl p-4 text-sm text-gray-400 space-y-2">
        <div className="font-bold text-white mb-2">Difficulty Breakdown</div>
        {Object.entries(DIFFICULTY_CONFIG).map(([key, cfg]) => (
          <div key={key} className="flex items-center justify-between">
            <span>{cfg.emoji} {cfg.label}</span>
            <span className="text-red-400">{cfg.mines} mine{cfg.mines > 1 ? 's' : ''}</span>
          </div>
        ))}
        <div className="pt-3 border-t border-white/10 space-y-1">
          <div className="font-bold text-white">House Edge</div>
          <div className="text-xs">4% on all winnings</div>
          {betAmount >= 100 && (
            <div className="text-yellow-400 text-xs">⚠️ High bet: +{betAmount >= 500 ? '2' : '1'} mine{betAmount >= 500 ? 's' : ''}</div>
          )}
        </div>
      </div>
    </div>
  );
}