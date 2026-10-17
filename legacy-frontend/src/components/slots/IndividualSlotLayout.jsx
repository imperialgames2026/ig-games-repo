import React from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw, Zap, Minus, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function IndividualSlotLayout({
  title,
  titleEmoji,
  accentClass,
  panelClass,
  frameClass,
  reelClass,
  topOrnament,
  sideOrnament,
  winBannerClass,
  spinButtonClass,
  symbols,
  spinning,
  totalWin,
  showWinAnimation,
  lastWins,
  bet,
  lines,
  currency,
  reelSymbols,
  reelsSpinning,
  wallet,
  adjustBet,
  setLines,
  spinReels,
}) {
  const balance = currency === 'IC' ? (wallet?.tokens || 0) : (wallet?.cat_dollars || 0);

  return (
    <div className={`relative overflow-hidden ${panelClass}`}>
      {topOrnament}
      {sideOrnament}

      <div className="relative z-10">
        <div className="mb-4 text-center">
          <div className={`inline-flex items-center gap-3 rounded-full border px-5 py-2 text-sm font-black tracking-[0.3em] uppercase ${accentClass}`}>
            <span className="text-2xl normal-case tracking-normal">{titleEmoji}</span>
            <span>{title}</span>
          </div>
        </div>

        <div className={`relative p-3 md:p-4 ${frameClass}`}>
          <div className="grid grid-cols-5 gap-2">
            {reelSymbols.map((column, reelIndex) => (
              <div key={reelIndex} className={`relative h-[192px] overflow-hidden ${reelClass}`}>
                <div className="absolute inset-x-0 top-1/3 h-[64px] border-y border-white/20 bg-white/5" />
                {reelsSpinning[reelIndex] ? (
                  <div className="h-full flex flex-col animate-pulse">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="h-[64px] flex items-center justify-center text-3xl blur-sm border-b border-white/10">
                        {Object.values(symbols)[(reelIndex + i) % Object.values(symbols).length]?.emoji}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex flex-col">
                    {column.map((symbol, rowIdx) => {
                      const matched = Object.values(symbols).find((item) => item.id === symbol);
                      return (
                        <motion.div
                          key={rowIdx}
                          initial={{ opacity: 0.7, scale: 0.96 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="h-[64px] flex flex-col items-center justify-center border-b border-white/10"
                        >
                          <span className="text-3xl leading-none">{matched?.emoji || '❔'}</span>
                          <span className="text-[10px] text-white/60 uppercase tracking-[0.2em] mt-1">{matched?.label || symbol}</span>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <AnimatePresence>
          {showWinAnimation && totalWin > 0 && (
            <motion.div initial={{ opacity: 0, y: 8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} className={`mt-4 rounded-2xl border px-4 py-3 text-center ${winBannerClass}`}>
              <div className="text-3xl font-black text-white">+{totalWin.toFixed(2)} {currency}</div>
              <div className="text-sm text-white/75 font-bold tracking-[0.25em] uppercase">{lastWins.length} line win{lastWins.length !== 1 ? 's' : ''}</div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
            <div className="mb-2 flex items-center justify-between text-xs text-white/60 uppercase tracking-[0.2em]">
              <span>Bet / line</span>
              <span className="text-white font-bold">{bet.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => adjustBet(-0.1)} disabled={spinning} variant="outline" size="icon" className="h-9 w-9 min-h-0 min-w-0 p-0">
                <Minus className="w-3 h-3" />
              </Button>
              <div className="flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-center text-white font-mono">{bet.toFixed(2)}</div>
              <Button onClick={() => adjustBet(0.1)} disabled={spinning} variant="outline" size="icon" className="h-9 w-9 min-h-0 min-w-0 p-0">
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
            <div className="mb-2 flex items-center justify-between text-xs text-white/60 uppercase tracking-[0.2em]">
              <span>Lines</span>
              <span className="text-white font-bold">{lines}</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[1, 5, 10, 20].map((lineCount) => (
                <button
                  key={lineCount}
                  onClick={() => setLines(lineCount)}
                  disabled={spinning}
                  className={`rounded-xl px-2 py-2 text-xs font-black transition-all ${lines === lineCount ? 'bg-white text-black' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
                >
                  {lineCount}
                </button>
              ))}
            </div>
          </div>
        </div>

        <Button
          onClick={() => spinReels(false)}
          disabled={spinning || bet * lines > balance}
          className={`mt-4 w-full h-14 rounded-2xl text-base font-black ${spinButtonClass}`}
        >
          {spinning ? <><RotateCcw className="w-5 h-5 animate-spin mr-2" />SPINNING...</> : <><Zap className="w-5 h-5 mr-2" />SPIN — {(bet * lines).toFixed(2)} {currency}</>}
        </Button>
      </div>
    </div>
  );
}