import React from 'react';
import { motion } from 'framer-motion';

export default function DealerAvatar({ isActing, isDealing }) {
  return (
    <div className="relative flex flex-col items-center select-none">
      <motion.div
        animate={{ y: isActing ? [0, -3, 0] : 0 }}
        transition={{ duration: 1.4, repeat: isActing ? Infinity : 0 }}
        className="relative z-20"
      >
        <div className="relative w-24 h-28 md:w-28 md:h-32">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-14 md:w-24 md:h-16 rounded-t-[999px] bg-[#1b0f18]" />
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-20 md:w-20 md:h-24 rounded-[999px]" style={{ background: 'radial-gradient(circle at 50% 32%, #f6d6c3 0%, #dfb39a 58%, #b67f69 100%)', boxShadow: '0 10px 24px rgba(0,0,0,0.3)' }} />
          <div className="absolute top-1 left-1/2 -translate-x-1/2 w-18 h-10 md:w-24 md:h-12 rounded-t-[999px] bg-[#22111d]" />
          <div className="absolute top-6 left-[29%] w-2.5 h-2.5 rounded-full bg-[#2f1f1a]" />
          <div className="absolute top-6 right-[29%] w-2.5 h-2.5 rounded-full bg-[#2f1f1a]" />
          <div className="absolute top-10 left-1/2 -translate-x-1/2 w-2 h-3 rounded-full bg-[#bf8c73]/60" />
          <div className="absolute top-13 left-1/2 -translate-x-1/2 w-8 h-1.5 rounded-full bg-[#8a5d4e]" />
          <div className="absolute top-15 left-1/2 -translate-x-1/2 w-10 h-4 rounded-b-[999px] border-b border-[#6b4337]/50" />
        </div>
      </motion.div>

      <div className="relative -mt-6 z-10">
        <div
          className="w-40 h-24 md:w-48 md:h-28 rounded-t-[3rem]"
          style={{
            background: 'linear-gradient(180deg, #181018 0%, #0f0913 100%)',
            border: '1px solid rgba(236,72,153,0.16)',
            boxShadow: '0 18px 30px rgba(0,0,0,0.28)'
          }}
        />
        <div className="absolute inset-x-0 top-4 flex justify-center">
          <div className="w-14 h-16 md:w-16 md:h-18 bg-white rounded-b-[1rem]" />
        </div>
        <div className="absolute left-1/2 top-6 -translate-x-1/2 w-0 h-0 border-l-[12px] border-r-[12px] border-t-[22px] border-l-transparent border-r-transparent border-t-[#111827] md:border-l-[14px] md:border-r-[14px] md:border-t-[26px]" />
        <div className="absolute left-1/2 top-4 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-[#EC4899] shadow-[0_0_10px_rgba(236,72,153,0.65)]" />
      </div>

      <motion.div
        animate={isDealing ? { x: [0, 28, 0], y: [0, 3, 0], rotate: [0, -8, 0] } : { x: 0, y: 0, rotate: 0 }}
        transition={{ duration: 0.55, repeat: isDealing ? Infinity : 0, repeatDelay: 0.35 }}
        className="absolute top-[4.6rem] md:top-[5.3rem] right-[-1.2rem] md:right-[-2rem] z-30 hidden md:block"
      >
        <div className="relative">
          <div
            className="w-20 h-5 rounded-full"
            style={{
              background: 'linear-gradient(90deg, #2a1727 0%, #1a101a 35%, #e0b297 36%, #d09a80 100%)',
              transform: 'rotate(-12deg)',
              boxShadow: '0 10px 16px rgba(0,0,0,0.24)'
            }}
          />
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full" style={{ background: 'radial-gradient(circle at 35% 35%, #f1c6ae 0%, #d19b82 100%)' }} />
        </div>
      </motion.div>
    </div>
  );
}