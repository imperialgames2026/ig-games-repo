import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { motion, AnimatePresence } from 'framer-motion';
import { Bomb, Gem, RotateCcw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import ProvablyFairBadge from '@/components/casino/ProvablyFairBadge';
import useCasinoEffects from '@/hooks/useCasinoEffects';

export default function MinesGame({ wallet, onBet, currency = 'IC' }) {
  const [gridSize] = useState(25);
  const [minesCount, setMinesCount] = useState(3);
  const [bet, setBet] = useState(0.01);
  const [gameState, setGameState] = useState('betting');
  const [revealedTiles, setRevealedTiles] = useState([]);
  const [minePositions, setMinePositions] = useState([]);
  const [currentMultiplier, setCurrentMultiplier] = useState(1.00);
  const [result, setResult] = useState(null);
  const [roundSeed, setRoundSeed] = useState(null);
  const [roundHash, setRoundHash] = useState(null);
  const [roundId, setRoundId] = useState(null);
  const [loading, setLoading] = useState(false);
  const { triggerEffect, effectClassName } = useCasinoEffects();

  const startGame = async () => {
    setLoading(true);
    triggerEffect('bet');
    const { data } = await base44.functions.invoke('generateMinesOutcome', {
      bet,
      mines_count: minesCount,
      currency,
    });
    setLoading(false);

    if (!data?.success) return;

    setMinePositions(data.mine_positions);
    setRoundSeed(data.seed);
    setRoundHash(data.hash);
    setRoundId(data.round_id);
    setRevealedTiles([]);
    setCurrentMultiplier(1.00);
    setGameState('playing');
    setResult(null);
  };

  const revealTile = async (index) => {
    if (gameState !== 'playing' || revealedTiles.includes(index)) return;

    const newRevealed = [...revealedTiles, index];
    setRevealedTiles(newRevealed);
    triggerEffect('tick');

    // Hit a mine - lose
    if (minePositions.includes(index)) {
      triggerEffect('lose');
      setGameState('ended');
      setResult('lose');
      await onBet(bet, 0, 'mines');
      return;
    }

    // Calculate new multiplier based on revealed gems
    const gemsRevealed = newRevealed.length;
    const safeSpots = gridSize - minesCount;
    const multiplier = calculateMultiplier(gemsRevealed, safeSpots, minesCount);
    setCurrentMultiplier(multiplier);
  };

  const calculateMultiplier = (revealed, safe, mines) => {
    // Realistic BC.game-style multiplier calculation
    // Formula: multiplier = product of (remaining_tiles / remaining_safe_tiles) for each reveal
    let multiplier = 1.0;
    const totalTiles = gridSize;
    
    for (let i = 0; i < revealed; i++) {
      const tilesLeft = totalTiles - i;
      const safeLeft = safe - i;
      multiplier *= tilesLeft / safeLeft;
    }
    
    // Apply house edge (2% for IC, 4% for ID)
    const houseEdge = currency === 'ID' ? 0.96 : 0.98;
    return multiplier * houseEdge;
  };

  const cashOut = async () => {
    if (gameState !== 'playing' || revealedTiles.length === 0) return;
    
    const winAmount = bet * currentMultiplier;
    triggerEffect('cashout');
    setGameState('ended');
    setResult('win');
    await onBet(bet, winAmount, 'mines');
  };

  const newGame = () => {
    setGameState('betting');
    setRevealedTiles([]);
    setMinePositions([]);
    setCurrentMultiplier(1.00);
    setResult(null);
    setRoundSeed(null);
    setRoundHash(null);
    setRoundId(null);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className={`bg-[#1A1528] rounded-2xl p-3 transition-all duration-300 ${effectClassName}`}>
        {/* Compact stats bar */}
        <div className="flex items-center gap-2 mb-2 text-xs">
          <span className="px-2 py-1 bg-[#252538] rounded-lg text-red-400 font-bold">💣 {minesCount}</span>
          <span className="px-2 py-1 bg-[#252538] rounded-lg text-green-400 font-bold">💎 {revealedTiles.length}</span>
          <span className="px-2 py-1 bg-[#252538] rounded-lg text-pink-400 font-bold">{currentMultiplier.toFixed(2)}x</span>
          <span className="px-2 py-1 bg-[#252538] rounded-lg text-yellow-400 font-bold ml-auto">{(bet * currentMultiplier).toFixed(2)} {currency}</span>
        </div>

        {/* Game Grid */}
        <div className="relative bg-[#0F0A1E] rounded-xl p-2 mb-3">
          <div className="grid grid-cols-5 gap-1.5 md:gap-2">
            {Array(gridSize).fill(0).map((_, index) => {
              const isRevealed = revealedTiles.includes(index);
              const isMine = minePositions.includes(index);
              const showMine = (gameState === 'ended' || isRevealed) && isMine;
              const showGem = isRevealed && !isMine;

              return (
                <motion.button
                  key={index}
                  onClick={() => revealTile(index)}
                  disabled={gameState !== 'playing' || isRevealed}
                  whileHover={gameState === 'playing' && !isRevealed ? { scale: 1.05 } : {}}
                  whileTap={gameState === 'playing' && !isRevealed ? { scale: 0.95 } : {}}
                  className={`aspect-square rounded-lg transition-all relative ${
                    showMine
                      ? 'bg-gradient-to-br from-red-600 to-red-700'
                      : showGem
                      ? 'bg-gradient-to-br from-green-600 to-green-700'
                      : 'bg-gradient-to-br from-[#2A1F3D] to-[#1A1528] hover:from-[#3A2F4D] hover:to-[#2A1F3D]'
                  } ${gameState !== 'playing' || isRevealed ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <AnimatePresence>
                    {showMine && (
                      <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        className="absolute inset-0 flex items-center justify-center"
                      >
                        <Bomb className="w-8 h-8 text-white" />
                      </motion.div>
                    )}
                    {showGem && (
                      <motion.div
                        initial={{ scale: 0, rotate: 180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        className="absolute inset-0 flex items-center justify-center"
                      >
                        <Gem className="w-8 h-8 text-white" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>
              );
            })}
          </div>

          {/* Result Overlay */}
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm rounded-xl flex items-center justify-center"
              >
                <div className="text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className={`text-4xl font-black mb-2 ${
                      result === 'win' ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {result === 'win' ? 'CASHED OUT!' : 'BOOM!'}
                  </motion.div>
                  {result === 'win' && (
                    <div className="text-xl text-white">
                      +{(bet * currentMultiplier).toFixed(2)} {currency}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Next Tile Preview (playing state) */}
        {gameState === 'playing' && revealedTiles.length < gridSize - minesCount && (
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg px-3 py-2 mb-2 flex items-center justify-between text-sm">
            <span className="text-purple-300">Next tile cashout</span>
            <span className="font-black text-purple-200">
              {(bet * calculateMultiplier(revealedTiles.length + 1, gridSize - minesCount, minesCount)).toFixed(2)} {currency}
            </span>
          </div>
        )}

        {/* Controls */}
        <div className="space-y-3">
          {gameState === 'betting' && (
            <>
              <div>
                <div className="flex items-center justify-between text-white mb-2">
                  <span>Bet Amount</span>
                </div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex-1 bg-[#252538] rounded-lg px-4 py-3 flex items-center justify-between">
                    <input
                      type="number"
                      value={bet}
                      onChange={(e) => setBet(Math.max(0.01, Math.min(wallet?.tokens || 1, parseFloat(e.target.value) || 0.01)))}
                      step="0.01"
                      min="0.01"
                      max={wallet?.tokens || 1}
                      className="bg-transparent text-white font-mono w-full outline-none"
                    />
                    <div className="flex gap-1">
                      <button
                        onClick={() => setBet(prev => Math.max(0.01, prev / 2))}
                        className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-xs text-white"
                      >
                        1/2
                      </button>
                      <button
                        onClick={() => setBet(prev => Math.min(wallet?.tokens || 1, prev * 2))}
                        className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-xs text-white"
                      >
                        2x
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-white mb-2">
                  <span>Number of Mines</span>
                  <span className="text-xl font-bold text-red-400">{minesCount}</span>
                </div>
                <Slider
                  value={[minesCount]}
                  onValueChange={(v) => setMinesCount(v[0])}
                  min={1}
                  max={24}
                  step={1}
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>Easy (1)</span>
                  <span>Medium (12)</span>
                  <span>Hard (24)</span>
                </div>
              </div>

              <Button
                onClick={startGame}
                disabled={bet > (wallet?.tokens || 0) || loading}
                className="w-full h-14 text-xl font-bold bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
              >
                <Gem className="w-5 h-5 mr-2" />
                {loading ? 'STARTING...' : 'START GAME'}
              </Button>
            </>
          )}

          {gameState === 'playing' && (
            <>
              <Button
                onClick={cashOut}
                disabled={revealedTiles.length === 0}
                className="w-full h-14 text-xl font-bold bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-black mb-3"
              >
                💰 Cash Out {(bet * currentMultiplier).toFixed(2)} {currency}
              </Button>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#252538] rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-400 mb-1">Remaining Gems</div>
                  <div className="text-lg font-bold text-green-400">
                    {gridSize - minesCount - revealedTiles.length}
                  </div>
                </div>
                <div className="bg-[#252538] rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-400 mb-1">Total Profit</div>
                  <div className="text-lg font-bold text-yellow-400">
                    {((bet * currentMultiplier) - bet).toFixed(2)}
                  </div>
                </div>
              </div>
              
              <Button
                onClick={newGame}
                variant="outline"
                className="w-full h-12 text-lg font-bold border-white/20 text-white hover:bg-white/10 mt-3"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset Game
              </Button>
            </>
          )}

          {gameState === 'ended' && (
            <Button
              onClick={startGame}
              disabled={bet > (wallet?.tokens || 0) || loading}
              className="w-full h-14 text-xl font-bold bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700"
            >
              <RotateCcw className="w-5 h-5 mr-2" />
              {loading ? 'STARTING...' : 'PLAY AGAIN'}
            </Button>
          )}
        </div>

        {/* SSRCR Verification */}
        {roundHash && (
          <div className="mt-4">
            <ProvablyFairBadge seed={roundSeed} hash={roundHash} />
          </div>
        )}
      </div>
    </div>
  );
}