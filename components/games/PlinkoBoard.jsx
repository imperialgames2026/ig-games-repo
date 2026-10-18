import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';

function bucketColor(mult) {
  if (mult >= 100) return '#e11d48';
  if (mult >= 10) return '#f97316';
  if (mult >= 2) return '#22c55e';
  if (mult >= 1) return '#3b82f6';
  return '#6b7280';
}

export default function PlinkoBoard({ rows, bucketCount, currentMultipliers, balls, result, currency }) {
  const W = 420;
  const H = 520;
  const sidePad = 28;
  const topPad = 28;
  const bottomPad = 84;
  const playableW = W - sidePad * 2;
  const playableH = H - topPad - bottomPad;
  const centerX = W / 2;
  const verticalStep = rows > 1 ? playableH / (rows - 1) : playableH;
  const bottomRowPegs = rows + 1;
  const baseStep = playableW / bottomRowPegs;
  const slotWidth = playableW / bucketCount;
  const slotY = H - bottomPad + 16;
  const slotHeight = 42;

  const pegs = useMemo(() => {
    const list = [];

    for (let row = 0; row < rows; row++) {
      const pegsInRow = row + 2;
      const rowWidth = row * baseStep;
      const rowStartX = centerX - rowWidth / 2;
      const y = topPad + row * verticalStep;

      for (let col = 0; col < pegsInRow; col++) {
        list.push({
          key: `${row}-${col}`,
          x: rowStartX + col * baseStep,
          y,
        });
      }
    }

    return list;
  }, [rows, baseStep, centerX, topPad, verticalStep]);

  const getBallCoords = (ball) => {
    const clampedRow = Math.max(0, Math.min(ball.row, rows));
    const x = sidePad + Math.max(0, Math.min(1, ball.xFrac)) * playableW;

    if (clampedRow >= rows) {
      return { x, y: slotY - 12 };
    }

    const y = topPad + clampedRow * verticalStep;
    return { x, y };
  };

  return (
    <div className="relative w-full rounded-2xl border border-white/10 bg-gradient-to-b from-[#12091d] to-black p-3 sm:p-4 overflow-hidden">
      <div className="relative mx-auto w-full max-w-[420px]">
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full h-auto">
          <defs>
            <filter id="plinko-ball-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <rect x="0" y="0" width={W} height={H} rx="24" fill="url(#boardFade)" opacity="0.08" />
          <defs>
            <linearGradient id="boardFade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ec4899" />
              <stop offset="100%" stopColor="#000000" />
            </linearGradient>
          </defs>

          {pegs.map((peg) => (
            <g key={peg.key}>
              <circle cx={peg.x} cy={peg.y} r="6" fill="#ffffff" opacity="0.12" />
              <circle cx={peg.x} cy={peg.y} r="3.6" fill="#f8fafc" />
            </g>
          ))}

          {currentMultipliers.map((mult, index) => {
            const x = sidePad + index * slotWidth;
            const active = result?.bucket === index;

            return (
              <g key={index}>
                <rect
                  x={x + 2}
                  y={slotY}
                  width={slotWidth - 4}
                  height={slotHeight}
                  rx="10"
                  fill={bucketColor(mult)}
                  opacity={active ? 1 : 0.92}
                  stroke={active ? '#ffffff' : 'rgba(255,255,255,0.12)'}
                  strokeWidth={active ? 2.5 : 1}
                />
                <text
                  x={x + slotWidth / 2}
                  y={slotY + slotHeight / 2 + 5}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize={slotWidth < 28 ? 7 : 9}
                  fontWeight="700"
                >
                  {mult >= 1 ? `${mult.toFixed(1)}x` : `${mult.toFixed(2)}x`}
                </text>
              </g>
            );
          })}

          {balls.map((ball) => {
            const { x, y } = getBallCoords(ball);
            return (
              <circle
                key={ball.id}
                cx={x}
                cy={y}
                r="8.5"
                fill="#ec4899"
                filter="url(#plinko-ball-glow)"
              />
            );
          })}
        </svg>

        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="absolute left-1/2 top-[42%] z-20 w-[140px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-black/85 p-3 text-center backdrop-blur-sm sm:w-[170px]"
            >
              <div className="mb-2 flex items-center justify-center gap-2">
                <ShieldCheck className="h-4 w-4 text-green-400" />
                <span className="text-[11px] font-medium text-green-400">Provably Fair</span>
              </div>
              <div className="mb-1 text-2xl font-black text-transparent bg-gradient-to-r from-pink-400 to-pink-500 bg-clip-text sm:text-3xl">
                {result.multiplier.toFixed(2)}x
              </div>
              <div className="text-sm font-bold text-white sm:text-base">
                +{result.winAmount.toFixed(2)} {currency}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}