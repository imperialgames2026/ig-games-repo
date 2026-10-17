import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Minus, Plus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import CrashPlayersList from './CrashPlayersList';

export default function RocketGame({ wallet, onBet, currency = 'IC', user }) {
  const [gameMode, setGameMode] = useState('classic');
  const [mainBet, setMainBet] = useState(0.01);
  const [selectedColor, setSelectedColor] = useState(null);
  const [nextRoundBet, setNextRoundBet] = useState(null);
  const [currentBetId, setCurrentBetId] = useState(null);
  const nextRoundBetRef = useRef(null);
  const currentBetIdRef = useRef(null);
  const [trenballBets, setTrenballBets] = useState({ red: null, green: null, yellow: null });
  const [currentRoundId, setCurrentRoundId] = useState(null);
  const [multiplier, setMultiplier] = useState(1.00);
  const [gameState, setGameState] = useState('betting');
  const [history, setHistory] = useState([]);
  const [crashHistory, setCrashHistory] = useState([]);
  const [graphPoints, setGraphPoints] = useState([]);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const intervalRef = useRef(null);
  const canvasRef = useRef(null);
  
  const [betMode, setBetMode] = useState('manual');
  const [autoConfig, setAutoConfig] = useState({
    numGames: 0,
    stopOnWin: 0,
    stopOnLoss: 0,
    onWin: 'reset',
    onLoss: 'reset',
  });
  const [autoStats, setAutoStats] = useState({
    gamesPlayed: 0,
    totalWon: 0,
    totalLost: 0,
  });
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  const [showHistoryGrid, setShowHistoryGrid] = useState(false);
  const [winNotification, setWinNotification] = useState(null);

  const startRound = async () => {
    // Get next pre-generated round from backend
    try {
      const { data: roundData } = await base44.functions.invoke('getCrashRound', {});
      const newRoundId = roundData.id;
      const crashPoint = roundData.crash_point;
      
      setCurrentRoundId(newRoundId);
      
      // Betting countdown period (6-8 seconds)
      setGameState('countdown');
      const countdownTime = 6 + Math.random() * 2; // 6-8 seconds
      let countdown = countdownTime;
      
      const countdownInterval = setInterval(() => {
        countdown -= 0.1;
        setMultiplier(countdown);
        
        if (countdown <= 0) {
          clearInterval(countdownInterval);
          launchRocket(newRoundId, crashPoint);
        }
      }, 100);
    } catch (err) {
      console.error('Failed to get crash round:', err);
      // No fallback - provably fair requires server-side outcomes
      setGameState('crashed');
      setMultiplier(0);
      alert('Unable to start round. Please refresh the page or contact support.');
    }
  };

  const launchRocket = (roundId, predeterminedCrash) => {
    // ALWAYS use pre-generated crash point from server (provably fair)
    if (!predeterminedCrash) {
      console.error('No predetermined crash point - canceling round');
      setTimeout(() => startRound(), 3000);
      return;
    }
    const crashMultiplier = predeterminedCrash;
    
    setGameState('flying');
    setMultiplier(1.00);
    setGraphPoints([]);
    setTimeElapsed(0);

    let current = 1.00;
    let time = 0;
    const points = [];

    intervalRef.current = setInterval(() => {
      time += 0.1;
      // Growth for ~30 second rounds
      current += 0.008 + (current - 1) * 0.025;
      
      points.push({ x: time, y: current });
      setMultiplier(current);
      setGraphPoints([...points]);
      setTimeElapsed(time);

      if (current >= crashMultiplier) {
        clearInterval(intervalRef.current);
        setGameState('crashed');

        const resultColor = current >= 10 ? 'yellow' : current >= 2 ? 'green' : 'red';
        setHistory(prev => [resultColor, ...prev.slice(0, 19)]);
        setCrashHistory(prev => [{ value: current, color: resultColor }, ...prev.slice(0, 19)]);

        // If user placed a bet and didn't cash out, use refs to avoid stale closure
        if (nextRoundBetRef.current && currentBetIdRef.current) {
          base44.entities.CrashBet.update(currentBetIdRef.current, {
            status: 'crashed',
            cash_out_multiplier: 0,
            win_amount: 0,
          }).catch(err => console.error('Failed to update bet:', err));
          
          nextRoundBetRef.current = null;
          currentBetIdRef.current = null;
          setNextRoundBet(null);
          setCurrentBetId(null);
        }

        // Handle Trenball bets
        if (gameMode === 'trenball') {
          Object.entries(trenballBets).forEach(([color, bet]) => {
            if (bet) {
              base44.entities.CrashBet.update(bet.betId, {
                status: 'crashed',
                cash_out_multiplier: 0,
                win_amount: 0,
              }).catch(err => console.error('Failed to update bet:', err));
            }
          });
          setTrenballBets({ red: null, green: null, yellow: null });
          // Trenball bets already deducted on placement, no further onBet needed
        }

        setTimeout(() => {
          // Mark round as completed and start next
          if (currentRoundId) {
            base44.functions.invoke('completeCrashRound', { roundId: currentRoundId }).catch(err => console.error('Failed to complete round:', err));
          }
          startRound();
        }, 3000);
      }
    }, 100);
  };

  useEffect(() => {
    const timer = setTimeout(() => startRound(), 1000);
    return () => {
      clearTimeout(timer);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const placeBetForNextRound = async () => {
    const balance = currency === 'IC' ? (wallet?.tokens || 0) : (wallet?.cat_dollars || 0);
    if (gameState !== 'countdown') return;
    if (mainBet <= 0 || mainBet > balance || !user || !currentRoundId) return;
    
    try {
      // Deduct bet from wallet (non-blocking for instant response)
      onBet(mainBet, 0, 'crash', 0);

      // Create bet record in database
      const newBet = await base44.entities.CrashBet.create({
        user_email: user.email,
        round_id: currentRoundId,
        bet_amount: mainBet,
        currency: currency,
        cash_out_multiplier: 0,
        win_amount: 0,
        status: 'active',
      });

      // Check if round already ended while we were waiting for DB — if so, refund immediately
      if (gameState !== 'countdown') {
        onBet(0, mainBet, 'crash', 0);
        base44.entities.CrashBet.delete(newBet.id).catch(() => {});
        return;
      }
      
      setCurrentBetId(newBet.id);
      currentBetIdRef.current = newBet.id;
      setNextRoundBet(mainBet);
      nextRoundBetRef.current = mainBet;
    } catch (err) {
      console.error('Failed to place bet:', err);
    }
  };

  const placeTrenballBet = async (color) => {
    const balance = currency === 'IC' ? (wallet?.tokens || 0) : (wallet?.cat_dollars || 0);
    if (gameState !== 'countdown') return;
    if (mainBet <= 0 || mainBet > balance || !user || !currentRoundId) return;
    if (trenballBets[color]) return; // Already bet on this color
    
    try {
      // Deduct from wallet immediately
      await onBet(mainBet, 0, 'crash', 0);

      const newBet = await base44.entities.CrashBet.create({
        user_email: user.email,
        round_id: currentRoundId,
        bet_amount: mainBet,
        currency: currency,
        cash_out_multiplier: 0,
        win_amount: 0,
        status: 'active',
      });
      
      setTrenballBets(prev => ({ ...prev, [color]: { betId: newBet.id, amount: mainBet } }));
    } catch (err) {
      console.error('Failed to place bet:', err);
    }
  };

  const cashOut = async () => {
    if (!nextRoundBet || gameState !== 'flying' || !currentBetId) return;
    
    // Capture current values immediately to avoid stale closure
    const betSnapshot = nextRoundBet;
    const multiplierSnapshot = multiplier;
    const betIdSnapshot = currentBetId;
    
    // Clear bet state IMMEDIATELY so UI updates instantly
    setNextRoundBet(null);
    setCurrentBetId(null);
    nextRoundBetRef.current = null;
    currentBetIdRef.current = null;

    const winAmount = betSnapshot * multiplierSnapshot;
    const xpGained = Math.floor(betSnapshot);
    
    // Fire wallet credit non-blocking for instant UI response
    onBet(0, winAmount, 'crash', xpGained);

    // Show win notification
    setWinNotification({ amount: winAmount, multiplier: multiplierSnapshot });
    setTimeout(() => setWinNotification(null), 3000);
    
    // Update bet record in background (non-blocking)
    base44.entities.CrashBet.update(betIdSnapshot, {
      status: 'cashed_out',
      cash_out_multiplier: multiplierSnapshot,
      win_amount: winAmount,
    }).catch(err => console.error('Failed to update cash out:', err));
    
    if (betMode === 'auto') {
      const profit = winAmount - nextRoundBet;
      setAutoStats(prev => ({
        gamesPlayed: prev.gamesPlayed + 1,
        totalWon: prev.totalWon + (profit > 0 ? profit : 0),
        totalLost: prev.totalLost + (profit < 0 ? Math.abs(profit) : 0),
      }));

      // Check auto stop conditions
      if (autoConfig.numGames > 0 && autoStats.gamesPlayed >= autoConfig.numGames) {
        setIsAutoRunning(false);
        return;
      }
      if (autoConfig.stopOnWin > 0 && autoStats.totalWon >= autoConfig.stopOnWin) {
        setIsAutoRunning(false);
        return;
      }
      if (autoConfig.stopOnLoss > 0 && autoStats.totalLost >= autoConfig.stopOnLoss) {
        setIsAutoRunning(false);
        return;
      }

      // Adjust bet based on win/loss
      if (profit > 0 && autoConfig.onWin === 'increase') {
        setMainBet(prev => prev * 2);
      } else if (profit < 0 && autoConfig.onLoss === 'increase') {
        setMainBet(prev => prev * 2);
      }
    }
  };

  const adjustBet = (amount) => {
    const balance = currency === 'IC' ? (wallet?.tokens || 1000) : (wallet?.cat_dollars || 1000);
    setMainBet(prev => Math.max(0.01, Math.min(balance, prev + amount)));
  };

  const halfBet = () => setMainBet(prev => Math.max(0.01, prev / 2));
  const doubleBet = () => {
    const balance = currency === 'IC' ? (wallet?.tokens || 1000) : (wallet?.cat_dollars || 1000);
    setMainBet(prev => Math.min(balance, prev * 2));
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-[#1c1c2e] rounded-2xl p-6">
        
        {/* Game Mode Tabs */}
        <div className="flex gap-2 mb-6 border-b border-white/10">
          <button
            onClick={() => setGameMode('classic')}
            className={`px-6 py-3 font-semibold transition-all ${
              gameMode === 'classic'
                ? 'text-white border-b-2 border-pink-500'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Classic
          </button>
          <button
            onClick={() => setGameMode('trenball')}
            className={`px-6 py-3 font-semibold transition-all ${
              gameMode === 'trenball'
                ? 'text-white border-b-2 border-pink-500'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Trenball
          </button>
        </div>

        {/* Crash History with Values */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          {crashHistory.map((crash, i) => {
            const getColor = (val) => {
              if (val >= 10) return 'text-yellow-400';
              if (val >= 2) return 'text-green-400';
              return 'text-red-400';
            };
            
            return (
              <div
                key={i}
                className={`font-bold text-sm ${getColor(crash.value)}`}
                style={{
                  textShadow: `0 0 10px currentColor`,
                }}
              >
                {crash.value.toFixed(2)}x
              </div>
            );
          })}
        </div>

        {/* History Dots & Grid Toggle */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-2 flex-wrap">
            {history.slice(0, 20).map((color, i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full ${
                  color === 'yellow' ? 'bg-yellow-400' :
                  color === 'green' ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
            ))}
          </div>
          <button
            onClick={() => setShowHistoryGrid(!showHistoryGrid)}
            className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-xs text-white"
          >
            {showHistoryGrid ? 'Hide' : 'Show'} Grid
          </button>
        </div>
        
        {/* History Grid — bead road L-shape style */}
        {showHistoryGrid && (() => {
          const ROWS = 6;

          // Bead road: same color stacks downward (top→bottom), overflow tracks right at bottom row (L-shape)
          // New color always starts a new column at the top
          const ordered = [...crashHistory].reverse();
          const cells = [];
          let col = 0;
          let row = 0;
          let overflowing = false; // true once a streak has filled the column and is tracking right at the bottom
          let prevColor = null;

          ordered.forEach(({ color }, idx) => {
            if (idx === 0) {
              row = 0;
              overflowing = false;
            } else if (color === prevColor) {
              if (overflowing) {
                // Already at bottom, just keep going right
                col++;
              } else if (row < ROWS - 1) {
                // Still space in column, go down
                row++;
              } else {
                // Hit the bottom — start overflowing right
                col++;
                overflowing = true;
                // row stays at ROWS - 1
              }
            } else {
              // New color: new column from top
              col++;
              row = 0;
              overflowing = false;
            }
            cells.push({ col, row, color });
            prevColor = color;
          });

          // Build grid map
          const maxCol = cells.length > 0 ? Math.max(...cells.map(c => c.col)) : 0;
          const grid = {};
          cells.forEach(({ col, row, color }) => { grid[`${col},${row}`] = color; });

          return (
            <div className="bg-[#252538] rounded-xl p-4 mb-4 overflow-x-auto">
              <div className="flex gap-1 items-start select-none min-w-max">
                {Array.from({ length: maxCol + 1 }).map((_, ci) => {
                  const colIndex = ci; // Oldest left, newest right
                  return (
                    <div key={ci} className="flex flex-col gap-1">
                      {Array.from({ length: ROWS }).map((_, ri) => {
                        const color = grid[`${colIndex},${ri}`];
                        return (
                          <div
                            key={ri}
                            className={`w-3 h-3 rounded-full ${
                              color === 'yellow' ? 'bg-yellow-400' :
                              color === 'green' ? 'bg-green-500' :
                              color === 'red' ? 'bg-red-500' : 'opacity-0'
                            }`}
                          />
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Graph Display */}
        <div className="relative h-80 bg-[#1A1A2E] rounded-xl mb-6 overflow-hidden">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={gameState === 'crashed' ? '#ec4899' : '#10b981'} stopOpacity="0.8" />
                <stop offset="100%" stopColor={gameState === 'crashed' ? '#ef4444' : '#34d399'} stopOpacity="1" />
              </linearGradient>
              <linearGradient id="fillGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={gameState === 'crashed' ? '#ec4899' : '#10b981'} stopOpacity="0.3" />
                <stop offset="100%" stopColor={gameState === 'crashed' ? '#ec4899' : '#10b981'} stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Grid lines */}
            {[...Array(5)].map((_, i) => (
              <line
                key={`grid-${i}`}
                x1="5"
                y1={20 + i * 16}
                x2="95"
                y2={20 + i * 16}
                stroke="rgba(255,255,255,0.03)"
                strokeWidth="0.2"
                vectorEffect="non-scaling-stroke"
              />
            ))}

            {/* Curve with gradient fill */}
            {graphPoints.length > 1 && (
              <>
                {/* Fill area under curve */}
                <path
                  d={`
                    M 5,95
                    ${graphPoints
                      .map((p, i) => {
                        const x = 5 + (i / Math.max(graphPoints.length - 1, 1)) * 90;
                        const maxY = Math.max(...graphPoints.map(pt => pt.y));
                        const normalizedY = 95 - ((Math.min(p.y, maxY * 1.2) - 1) / (maxY * 1.2 - 1)) * 75;
                        return `L ${x},${normalizedY}`;
                      })
                      .join(' ')}
                    L ${5 + 90},95
                    Z
                  `}
                  fill="url(#fillGradient)"
                />
                
                {/* Main line */}
                <path
                  d={`
                    ${graphPoints
                      .map((p, i) => {
                        const x = 5 + (i / Math.max(graphPoints.length - 1, 1)) * 90;
                        const maxY = Math.max(...graphPoints.map(pt => pt.y));
                        const normalizedY = 95 - ((Math.min(p.y, maxY * 1.2) - 1) / (maxY * 1.2 - 1)) * 75;
                        return `${i === 0 ? 'M' : 'L'} ${x},${normalizedY}`;
                      })
                      .join(' ')}
                  `}
                  stroke="url(#lineGradient)"
                  strokeWidth="0.8"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  style={{
                    filter: `drop-shadow(0 0 4px ${gameState === 'crashed' ? 'rgba(236, 72, 153, 0.6)' : 'rgba(16, 185, 129, 0.6)'})`,
                  }}
                />

                {/* Endpoint dot */}
                {gameState === 'flying' && graphPoints.length > 0 && (
                  <circle
                    cx={5 + ((graphPoints.length - 1) / Math.max(graphPoints.length - 1, 1)) * 90}
                    cy={95 - ((Math.min(graphPoints[graphPoints.length - 1].y, Math.max(...graphPoints.map(p => p.y)) * 1.2) - 1) / (Math.max(...graphPoints.map(p => p.y)) * 1.2 - 1)) * 75}
                    r="1.5"
                    fill="#10b981"
                    style={{
                      filter: 'drop-shadow(0 0 6px rgba(16, 185, 129, 0.8))',
                    }}
                    vectorEffect="non-scaling-stroke"
                  />
                )}
              </>
            )}
          </svg>

          {/* Y-axis labels */}
          <div className="absolute left-2 top-4 bottom-4 flex flex-col justify-between text-xs text-gray-500">
            {graphPoints.length > 0 && [...Array(6)].map((_, i) => {
              const maxY = Math.max(...graphPoints.map(p => p.y), 2);
              const value = 1 + ((maxY - 1) / 5) * (5 - i);
              return <span key={`y-${i}`}>{value.toFixed(1)}x</span>;
            })}
          </div>

          {/* Multiplier Display */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
            {gameState === 'countdown' ? (
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 0.8 }}
                className="text-6xl font-black text-yellow-400"
                style={{ textShadow: '0 0 20px rgba(251, 191, 36, 0.5)' }}
              >
                {Math.ceil(multiplier)}
              </motion.div>
            ) : (
              <motion.div
                animate={gameState === 'flying' ? { scale: [1, 1.05, 1] } : {}}
                transition={{ repeat: Infinity, duration: 0.5 }}
                className={`text-6xl font-black ${gameState === 'crashed' ? 'text-pink-400' : 'text-green-400'}`}
                style={{
                  textShadow: gameState === 'crashed' 
                    ? '0 0 20px rgba(236, 72, 153, 0.5)' 
                    : '0 0 20px rgba(16, 185, 129, 0.5)',
                }}
              >
                {multiplier.toFixed(2)}x
              </motion.div>
            )}
            {gameState === 'crashed' && (
              <div className="text-lg font-semibold text-gray-400 mt-1">Crashed</div>
            )}
            {gameState === 'countdown' && (
              <div className="text-lg font-semibold text-gray-400 mt-1">Starting...</div>
            )}
          </div>

          {/* Win Notification */}
          {winNotification && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.5, y: -20 }}
              className="absolute top-4 right-4 bg-green-500 text-white rounded-xl px-5 py-3 text-center shadow-2xl"
              style={{ boxShadow: '0 0 30px rgba(16, 185, 129, 0.7)' }}
            >
              <div className="text-xs font-semibold uppercase tracking-widest opacity-80">You Won</div>
              <div className="text-2xl font-black">+{winNotification.amount.toFixed(2)}</div>
              <div className="text-xs opacity-80">at {winNotification.multiplier.toFixed(2)}x</div>
            </motion.div>
          )}

          {/* Time labels - actual elapsed time */}
          <div className="absolute bottom-2 left-0 right-0 flex justify-center text-sm text-gray-400 font-mono">
            {gameState === 'flying' && (
              <span>{timeElapsed.toFixed(1)}s</span>
            )}
          </div>
        </div>

        {/* Betting Section */}
        <div className="space-y-4">
          {gameMode === 'trenball' && (
            <div className="bg-[#252538] rounded-xl p-4">
              <div className="text-gray-400 text-sm mb-3">Click to Bet on Colors</div>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => placeTrenballBet('red')}
                  disabled={trenballBets.red || gameState !== 'countdown'}
                  className={`py-4 rounded-lg font-bold text-white transition-all ${
                    trenballBets.red
                      ? 'bg-red-500 ring-2 ring-green-400'
                      : 'bg-red-500/50 hover:bg-red-500/70 disabled:opacity-30'
                  }`}
                >
                  🔴 Red
                  {trenballBets.red && <div className="text-xs mt-1">{trenballBets.red.amount.toFixed(2)} {currency}</div>}
                </button>
                <button
                  onClick={() => placeTrenballBet('green')}
                  disabled={trenballBets.green || gameState !== 'countdown'}
                  className={`py-4 rounded-lg font-bold text-white transition-all ${
                    trenballBets.green
                      ? 'bg-green-500 ring-2 ring-green-400'
                      : 'bg-green-500/50 hover:bg-green-500/70 disabled:opacity-30'
                  }`}
                >
                  🟢 Green
                  {trenballBets.green && <div className="text-xs mt-1">{trenballBets.green.amount.toFixed(2)} {currency}</div>}
                </button>
                <button
                  onClick={() => placeTrenballBet('yellow')}
                  disabled={trenballBets.yellow || gameState !== 'countdown'}
                  className={`py-4 rounded-lg font-bold text-white transition-all ${
                    trenballBets.yellow
                      ? 'bg-yellow-500 ring-2 ring-green-400'
                      : 'bg-yellow-500/50 hover:bg-yellow-500/70 disabled:opacity-30'
                  }`}
                >
                  🟡 Yellow
                  {trenballBets.yellow && <div className="text-xs mt-1">{trenballBets.yellow.amount.toFixed(2)} {currency}</div>}
                </button>
              </div>
            </div>
          )}

          {/* Manual/Auto Toggle */}
          <div className="flex gap-2 bg-[#252538] rounded-xl p-1">
            <button
              onClick={() => setBetMode('manual')}
              className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-all ${
                betMode === 'manual' ? 'bg-green-500 text-white' : 'text-gray-400'
              }`}
            >
              Manual
            </button>
            <button
              onClick={() => setBetMode('auto')}
              className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-all ${
                betMode === 'auto' ? 'bg-blue-500 text-white' : 'text-gray-400'
              }`}
            >
              Auto
            </button>
          </div>

          {betMode === 'auto' && (
            <div className="bg-[#252538] rounded-xl p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Number of Games</label>
                  <input
                    type="number"
                    value={autoConfig.numGames}
                    onChange={(e) => setAutoConfig({...autoConfig, numGames: parseInt(e.target.value) || 0})}
                    className="w-full bg-[#1c1c2e] rounded-lg px-3 py-2 text-white text-sm"
                    placeholder="0 = ∞"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Stop on Win</label>
                  <input
                    type="number"
                    value={autoConfig.stopOnWin}
                    onChange={(e) => setAutoConfig({...autoConfig, stopOnWin: parseFloat(e.target.value) || 0})}
                    className="w-full bg-[#1c1c2e] rounded-lg px-3 py-2 text-white text-sm"
                    placeholder="0 = Never"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Stop on Loss</label>
                  <input
                    type="number"
                    value={autoConfig.stopOnLoss}
                    onChange={(e) => setAutoConfig({...autoConfig, stopOnLoss: parseFloat(e.target.value) || 0})}
                    className="w-full bg-[#1c1c2e] rounded-lg px-3 py-2 text-white text-sm"
                    placeholder="0 = Never"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">On Win</label>
                  <select
                    value={autoConfig.onWin}
                    onChange={(e) => setAutoConfig({...autoConfig, onWin: e.target.value})}
                    className="w-full bg-[#1c1c2e] rounded-lg px-3 py-2 text-white text-sm"
                  >
                    <option value="reset">Reset</option>
                    <option value="increase">Increase</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Games: {autoStats.gamesPlayed}</span>
                <span className="text-green-400">Won: {autoStats.totalWon.toFixed(2)}</span>
                <span className="text-red-400">Lost: {autoStats.totalLost.toFixed(2)}</span>
              </div>
            </div>
          )}

          <div className="bg-[#252538] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-400 text-sm">Amount</span>
            </div>
            
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 bg-[#1c1c2e] rounded-lg px-4 py-3 flex items-center justify-between">
                <input
                   type="text"
                   inputMode="decimal"
                   value={mainBet === 0 ? '' : String(mainBet)}
                   onChange={(e) => {
                     const val = e.target.value === '' ? 0 : parseFloat(e.target.value) || 0;
                     setMainBet(val);
                   }}
                   onBlur={(e) => {
                     const balance = currency === 'IC' ? (wallet?.tokens || 0) : (wallet?.cat_dollars || 0);
                     const val = parseFloat(e.target.value) || 0.01;
                     setMainBet(Math.max(0.01, Math.min(balance, val)));
                   }}
                   placeholder="0.01"
                   className="bg-transparent text-white font-mono w-full outline-none"
                 />
                <div className="flex gap-1">
                  <button
                    onClick={halfBet}
                    className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-xs text-white min-h-[44px] min-w-[44px] flex items-center justify-center select-none"
                    style={{ WebkitTouchCallout: 'none' }}
                  >
                    1/2
                  </button>
                  <button
                    onClick={doubleBet}
                    className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-xs text-white min-h-[44px] min-w-[44px] flex items-center justify-center select-none"
                    style={{ WebkitTouchCallout: 'none' }}
                  >
                    2x
                  </button>
                </div>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => adjustBet(-1)}
                  className="min-h-[44px] min-w-[44px] bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center select-none"
                  style={{ WebkitTouchCallout: 'none' }}
                >
                  <Minus className="w-4 h-4 text-white" />
                </button>
                <button
                  onClick={() => adjustBet(1)}
                  className="min-h-[44px] min-w-[44px] bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center select-none"
                  style={{ WebkitTouchCallout: 'none' }}
                >
                  <Plus className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>

            {betMode === 'auto' ? (
              <Button
                onClick={() => {
                  if (isAutoRunning) {
                    setIsAutoRunning(false);
                  } else {
                    setIsAutoRunning(true);
                    setAutoStats({ gamesPlayed: 0, totalWon: 0, totalLost: 0 });
                    placeBetForNextRound();
                  }
                }}
                className={`w-full h-12 font-bold rounded-lg ${
                  isAutoRunning 
                    ? 'bg-red-500 hover:bg-red-600 text-white' 
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                {isAutoRunning ? 'Stop Auto' : 'Start Auto'}
              </Button>
            ) : gameMode === 'trenball' ? null : (
              <>
                {gameState === 'countdown' && nextRoundBet ? (
                  <Button
                    onClick={async () => {
                      // Only refund if bet is still active (use ref to prevent exploit)
                      if (!nextRoundBetRef.current || !currentBetIdRef.current) return;
                      const betToRefund = nextRoundBetRef.current;
                      const betIdToDelete = currentBetIdRef.current;
                      // Clear FIRST before any async to prevent double-refund
                      nextRoundBetRef.current = null;
                      currentBetIdRef.current = null;
                      setNextRoundBet(null);
                      setCurrentBetId(null);
                      await onBet(0, betToRefund, 'crash', 0);
                      base44.entities.CrashBet.delete(betIdToDelete).catch(err => console.error('Failed to cancel bet:', err));
                    }}
                    className="w-full h-12 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg"
                  >
                    Cancel Bet
                  </Button>
                ) : gameState === 'countdown' || gameState === 'betting' || !nextRoundBet ? (
                  <Button
                    onClick={placeBetForNextRound}
                    disabled={
                      nextRoundBet !== null || 
                      mainBet > (currency === 'IC' ? wallet?.tokens || 0 : wallet?.cat_dollars || 0) || 
                      gameState !== 'countdown'
                    }
                    className="w-full h-12 bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg"
                  >
                    {nextRoundBet ? '✓ Bet Placed' : gameState !== 'countdown' ? 'Wait for Countdown' : 'Place Bet'}
                  </Button>
                ) : (
                  <Button
                    onClick={cashOut}
                    disabled={gameState !== 'flying'}
                    className="w-full h-12 bg-yellow-500 hover:bg-yellow-600 text-black font-bold rounded-lg"
                  >
                    💰 Cash Out {(nextRoundBet * multiplier).toFixed(2)} {currency}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Players List */}
      <CrashPlayersList currentRoundId={currentRoundId} currentUser={user} gameState={gameState} />
    </div>
  );
}