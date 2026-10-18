import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { motion } from 'framer-motion';
import { Dice5, RotateCcw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import ProvablyFairBadge from '@/components/casino/ProvablyFairBadge';

const DiceDisplay = ({ value, rolling }) => {
  const dots = {
    1: [[1, 1]],
    2: [[0, 0], [2, 2]],
    3: [[0, 0], [1, 1], [2, 2]],
    4: [[0, 0], [0, 2], [2, 0], [2, 2]],
    5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
    6: [[0, 0], [0, 1], [0, 2], [2, 0], [2, 1], [2, 2]],
  };

  return (
    <motion.div
      animate={rolling ? { 
        rotateX: [0, 360, 720],
        rotateY: [0, 360, 720],
        rotateZ: [0, 180, 360],
      } : {}}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="w-24 h-24 bg-white rounded-lg shadow-2xl p-2 border-2 border-gray-300"
      style={{ transformStyle: 'preserve-3d' }}
    >
      <div className="w-full h-full relative grid grid-cols-3 grid-rows-3 gap-1 p-2">
        {dots[value]?.map(([row, col], i) => (
          <div
            key={i}
            className="absolute w-4 h-4 bg-gray-900 rounded-full"
            style={{
              left: `${col * 33.33 + 16.67}%`,
              top: `${row * 33.33 + 16.67}%`,
              transform: 'translate(-50%, -50%)',
            }}
          />
        ))}
      </div>
    </motion.div>
  );
};

export default function CrapsGame({ wallet, onBet, currency = 'IC' }) {
  const [dice, setDice] = useState([1, 1]);
  const [bet, setBet] = useState(0.01);
  const [betType, setBetType] = useState('pass'); // pass, don't_pass, field, any_seven
  const [rolling, setRolling] = useState(false);
  const [point, setPoint] = useState(null);
  const [gamePhase, setGamePhase] = useState('come_out'); // come_out, point
  const [result, setResult] = useState(null);
  const [lastSeed, setLastSeed] = useState(null);
  const [lastHash, setLastHash] = useState(null);

  const rollDice = async () => {
    if (rolling || bet > (wallet?.tokens || 0)) return;
    
    setRolling(true);
    setResult(null);

    // Roll animation
    await new Promise(r => setTimeout(r, 500));

    const response = await base44.functions.invoke('generateCrapsOutcomeSSRCR', {
      bet_amount: bet,
      bet_type: betType,
      currency,
    });
    const data = response.data;
    const d1 = data.dice[0];
    const d2 = data.dice[1];
    const total = data.total;
    setLastSeed(data.seed);
    setLastHash(data.hash);
    
    setDice([d1, d2]);
    setRolling(false);

    // Determine outcome based on bet type and game phase
    let winAmount = 0;
    let gameResult = null;

    const houseEdgeMultiplier = currency === 'ID' ? 0.9 : 1.0;
    
    if (betType === 'pass') {
      if (gamePhase === 'come_out') {
        if (total === 7 || total === 11) {
          winAmount = bet * 2 * houseEdgeMultiplier;
          gameResult = 'win';
        } else if (total === 2 || total === 3 || total === 12) {
          gameResult = 'lose';
        } else {
          setPoint(total);
          setGamePhase('point');
          return;
        }
      } else {
        if (total === point) {
          winAmount = bet * 2 * houseEdgeMultiplier;
          gameResult = 'win';
          setPoint(null);
          setGamePhase('come_out');
        } else if (total === 7) {
          gameResult = 'lose';
          setPoint(null);
          setGamePhase('come_out');
        } else {
          return; // Continue rolling
        }
      }
    } else if (betType === 'any_seven') {
      if (total === 7) {
        winAmount = bet * 5 * houseEdgeMultiplier;
        gameResult = 'win';
      } else {
        gameResult = 'lose';
      }
    } else if (betType === 'field') {
      if ([2, 3, 4, 9, 10, 11, 12].includes(total)) {
        winAmount = (total === 2 || total === 12 ? bet * 3 : bet * 2) * houseEdgeMultiplier;
        gameResult = 'win';
      } else {
        gameResult = 'lose';
      }
    }

    setResult(gameResult);
    await onBet(bet, winAmount, 'craps');
  };

  const betTypes = [
    { id: 'pass', name: 'Pass Line', desc: '7 or 11 wins, 2,3,12 loses', payout: '1:1' },
    { id: 'any_seven', name: 'Any Seven', desc: 'Roll a 7 to win', payout: '4:1' },
    { id: 'field', name: 'Field', desc: '2,3,4,9,10,11,12 wins', payout: '1:1 / 2:1' },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      <div className="relative bg-gradient-to-br from-green-800 via-green-700 to-green-900 rounded-3xl p-8 border-8 border-[#8B4513] shadow-2xl overflow-hidden">
        {/* Table Felt Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="w-full h-full" style={{
            backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(0,0,0,.1) 35px, rgba(0,0,0,.1) 70px)'
          }} />
        </div>

        {/* Craps Table Layout */}
        <div className="relative grid grid-cols-12 gap-2 mb-8">
          {/* Pass Line */}
          <div className="col-span-12 h-16 border-4 border-white rounded-lg flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
            <span className="text-2xl font-black text-white tracking-wider relative z-10">PASS LINE</span>
          </div>

          {/* Numbers Section */}
          <div className="col-span-12 grid grid-cols-6 gap-2">
            {[4, 5, 6, 8, 9, 10].map(num => (
              <div key={num} className="h-16 border-4 border-white/80 rounded-lg bg-green-700/50 flex items-center justify-center">
                <span className="text-3xl font-black text-white">{num}</span>
                {point === num && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-2 -right-2 w-8 h-8 bg-pink-500 rounded-full border-2 border-white flex items-center justify-center"
                  >
                    <span className="text-xs font-bold text-white">ON</span>
                  </motion.div>
                )}
              </div>
            ))}
          </div>

          {/* Field Bet Area */}
          <div className="col-span-12 h-16 border-4 border-yellow-400 rounded-lg bg-yellow-400/20 flex items-center justify-center">
            <span className="text-xl font-black text-white">FIELD • 2 3 4 9 10 11 12</span>
          </div>
        </div>

        {/* Dice Rolling Area */}
        <div className="relative bg-green-900/50 rounded-2xl p-8 mb-8 border-4 border-white/20">
          <div className="absolute top-2 left-4 text-white/40 text-xs font-bold">DICE AREA</div>
          
          {/* Dice Display */}
          <div className="flex justify-center gap-8 mb-4">
            <DiceDisplay value={dice[0]} rolling={rolling} />
            <DiceDisplay value={dice[1]} rolling={rolling} />
          </div>

          {/* Total */}
          <div className="text-center">
            <span className="text-6xl font-black text-white drop-shadow-lg">{dice[0] + dice[1]}</span>
          </div>

          {/* Result */}
          {result && (
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-6xl font-black ${
                result === 'win' ? 'text-green-400' : 'text-red-400'
              } drop-shadow-2xl`}
            >
              {result === 'win' ? 'WIN!' : 'LOSE!'}
            </motion.div>
          )}
        </div>

        {lastHash && <div className="mb-6"><ProvablyFairBadge seed={lastSeed} hash={lastHash} /></div>}

        {/* Betting Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Bet Type Selection */}
          <div>
            <h3 className="text-white font-bold mb-3">Select Your Bet</h3>
            <div className="space-y-2">
              {betTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setBetType(type.id)}
                  disabled={gamePhase === 'point'}
                  className={`w-full p-4 rounded-xl border-2 transition-all ${
                    betType === type.id
                      ? 'border-pink-500 bg-pink-500/30 shadow-lg shadow-pink-500/30'
                      : 'border-white/30 hover:border-white/50 bg-white/5'
                  } ${gamePhase === 'point' ? 'opacity-50' : ''}`}
                >
                  <div className="flex justify-between items-center">
                    <div className="text-left">
                      <div className="text-white font-bold">{type.name}</div>
                      <div className="text-xs text-gray-300">{type.desc}</div>
                    </div>
                    <div className="text-pink-400 font-black">{type.payout}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Bet Amount & Roll */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-white mb-2">
                <span className="font-bold">Bet Amount</span>
                <span className="text-3xl font-black text-pink-400">{bet.toFixed(2)} CC</span>
              </div>
              <Slider
                value={[bet]}
                onValueChange={(v) => setBet(v[0])}
                min={0.01}
                max={Math.min(2000, wallet?.tokens || 1)}
                step={0.01}
                disabled={gamePhase === 'point'}
              />
            </div>

            <Button
              onClick={rollDice}
              disabled={rolling || bet > (wallet?.tokens || 0)}
              className="w-full h-20 text-2xl font-black bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 shadow-lg shadow-pink-500/50"
            >
              <Dice5 className="w-8 h-8 mr-3" />
              {rolling ? 'ROLLING...' : 'ROLL DICE'}
            </Button>

            {point && (
              <div className="text-center p-4 bg-pink-500/20 border-2 border-pink-500 rounded-xl">
                <span className="text-2xl font-black text-white">POINT: {point}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}