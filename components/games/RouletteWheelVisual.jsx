import React from 'react';
import { motion } from 'framer-motion';
import { rouletteNumbers } from './rouletteData';

const segmentAngle = 360 / rouletteNumbers.length;

function getBallPosition(index, radiusPercent = 39) {
  const angle = (index * segmentAngle) - 90;
  const radians = (angle * Math.PI) / 180;
  return {
    left: `${50 + Math.cos(radians) * radiusPercent}%`,
    top: `${50 + Math.sin(radians) * radiusPercent}%`,
  };
}

export default function RouletteWheelVisual({ wheelRotation, ballRotation, winningIndex, spinning }) {
  const ballPosition = getBallPosition(winningIndex);

  return (
    <div className="absolute left-1/2 top-[12%] z-20 w-[30%] min-w-[180px] max-w-[320px] -translate-x-1/2">
      <div className="relative aspect-square rounded-full">
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,_rgba(255,221,138,0.25),_rgba(0,0,0,0)_60%)] blur-xl" />

        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#2d241d] via-[#120f0d] to-[#050505] shadow-[0_24px_60px_rgba(0,0,0,0.55)]" />
        <div className="absolute inset-[2%] rounded-full border-[10px] border-[#121212] shadow-[inset_0_2px_6px_rgba(255,255,255,0.08)]" />
        <div className="absolute inset-[6%] rounded-full border-[3px] border-[#6f5328]" />
        <div className="absolute inset-[9%] rounded-full border-[12px] border-[#0b0b0b]" />
        <div className="absolute inset-[13%] rounded-full border-[3px] border-[#b88a38]" />
        <div className="absolute inset-[15%] rounded-full bg-[radial-gradient(circle_at_50%_45%,_#1e1a17,_#090909_75%)]" />

        <div className="absolute inset-[17%] rounded-full border-[2px] border-[#d3aa55]/70" />

        <motion.div
          animate={{ rotate: wheelRotation }}
          transition={{ duration: 4.8, ease: [0.12, 0.75, 0.22, 1] }}
          className="absolute inset-[18%] rounded-full"
          style={{ transformOrigin: '50% 50%' }}
        >
          {rouletteNumbers.map((item, index) => {
            const color = item.color === 'red' ? '#c63d3d' : item.color === 'black' ? '#1a1a1a' : '#1f8a4d';
            return (
              <div
                key={item.num}
                className="absolute left-1/2 top-1/2 h-[44%] w-[12%] origin-bottom -translate-x-1/2 rounded-t-full border-x border-[#d3aa55]/50"
                style={{
                  transform: `translate(-50%, -100%) rotate(${index * segmentAngle}deg)`,
                  background: `linear-gradient(180deg, ${color} 0%, ${color} 74%, #b99243 74%, #cda85a 100%)`
                }}
              />
            );
          })}

          {rouletteNumbers.map((item, index) => (
            <div
              key={`label-${item.num}`}
              className="absolute left-1/2 top-1/2 text-[8px] font-black text-[#f6d98b] sm:text-[10px]"
              style={{
                transform: `rotate(${index * segmentAngle}deg) translateY(-116px) rotate(${90}deg)`,
                transformOrigin: '0 0',
              }}
            >
              {item.num}
            </div>
          ))}

          <div className="absolute inset-[23%] rounded-full border-[3px] border-[#d3aa55] bg-[radial-gradient(circle_at_35%_35%,_#7a4a26,_#29160f_60%,_#100708)]" />
          <div className="absolute inset-[35%] rounded-full border-[4px] border-[#d9b260] bg-[radial-gradient(circle_at_35%_35%,_#a36732,_#4b2815_55%,_#21110d)]" />
          <div className="absolute inset-[43%] rounded-full bg-[radial-gradient(circle_at_30%_30%,_#f7da8a,_#a96f2f_35%,_#5a3416_60%,_#1f120d)] shadow-[0_0_25px_rgba(251,191,36,0.3)]" />
        </motion.div>

        <motion.div
          animate={{ rotate: ballRotation }}
          transition={{ duration: 4.8, ease: [0.08, 0.7, 0.16, 1] }}
          className="absolute inset-0"
          style={{ transformOrigin: '50% 50%' }}
        >
          <motion.div
            animate={{ scale: spinning ? [1, 0.9, 1] : 1 }}
            transition={{ duration: 0.4, repeat: spinning ? Infinity : 0 }}
            className="absolute h-[6%] w-[6%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70 bg-[radial-gradient(circle_at_35%_35%,_#ffffff,_#ececec_40%,_#b5b5b5_100%)] shadow-[0_0_12px_rgba(255,255,255,0.6)]"
            style={ballPosition}
          />
        </motion.div>
      </div>
    </div>
  );
}