import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Minus, Plus, RotateCcw, Zap } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import SlotCelebrationFX from './SlotCelebrationFX';

const COLS = 5;
const ROWS = 3;
const FARMAGEDDON_COLS = 4;
const FARMAGEDDON_ROWS = 4;

function getSlotAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  return AudioContextClass ? new AudioContextClass() : null;
}

function playTone(ctx, frequency, duration, type = 'sine', volume = 0.08, delay = 0) {
  const startAt = ctx.currentTime + delay;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startAt);
  gain.gain.setValueAtTime(0.001, startAt);
  gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration);

  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.02);
}

function playReelSpinSound() {
  const ctx = getSlotAudioContext();
  if (!ctx) return () => {};

  const tick = () => playTone(ctx, 160 + Math.random() * 90, 0.045, 'square', 0.035);
  tick();
  const timer = setInterval(tick, 70);

  return () => {
    clearInterval(timer);
    playTone(ctx, 95, 0.08, 'triangle', 0.055);
    setTimeout(() => ctx.close(), 180);
  };
}

function playWinSound() {
  const ctx = getSlotAudioContext();
  if (!ctx) return;
  [523, 659, 784, 1046].forEach((note, index) => playTone(ctx, note, 0.14, 'triangle', 0.09, index * 0.08));
  setTimeout(() => ctx.close(), 650);
}

function playScatterSound() {
  const ctx = getSlotAudioContext();
  if (!ctx) return;
  [392, 523, 659].forEach((note, index) => playTone(ctx, note, 0.11, 'sine', 0.075, index * 0.06));
  setTimeout(() => ctx.close(), 420);
}

export default function StandaloneSlotGame({
  gameSlug,
  slotType,
  title,
  titleEmoji,
  theme,
  symbols,
  wallet,
  onBet,
  currency = 'PRACTICE',
  artworkUrl,
  cabinetVariant,
}) {
  const isFarmageddon = cabinetVariant === 'farmageddon';
  const slotCols = isFarmageddon ? FARMAGEDDON_COLS : COLS;
  const slotRows = isFarmageddon ? FARMAGEDDON_ROWS : ROWS;
  const [bet, setBet] = useState(1);
  const [lines, setLines] = useState(isFarmageddon ? 6 : 20);
  const [spinning, setSpinning] = useState(false);
  const [grid, setGrid] = useState(() => Array(slotCols).fill(null).map(() => Array(slotRows).fill(Object.values(symbols)[0]?.id)));
  const [winAmount, setWinAmount] = useState(0);
  const [winningCells, setWinningCells] = useState([]);
  const [showWin, setShowWin] = useState(false);
  const [bonusResult, setBonusResult] = useState(null);
  const [practiceChips,setPracticeChips]=useState(null);
  const [serviceError,setServiceError]=useState('');
  const spinSoundStopRef = useRef(null);
  const requestRef=useRef(null);

  const balance = Number(practiceChips ?? 0);
  async function slotCall(body){
    const {data,error}=await supabase.functions.invoke('ig-slot-practice-v1',{body});
    if(error){
      let message=error.message||'Slot practice unavailable';
      try{const detail=await error.context?.json();message=detail?.error||message;}catch{}
      throw new Error(message);
    }
    if(!data||data.error||data.practiceOnly!==true||data.realMoneyEnabled!==false)throw new Error(data?.error||'Invalid slot-practice response');
    return data;
  }
  useEffect(()=>{let alive=true;void slotCall({action:'state'}).then(data=>{if(alive)setPracticeChips(Number(data.chips));}).catch(e=>{if(alive)setServiceError(e.message);});return()=>{alive=false;};},[]);
  const adjustBet = (delta) => {
    const maxBetPerLine = Math.max(1, Math.min(100,Math.floor(balance / Math.max(lines, 1))));
    setBet(prev => Math.max(1, Math.min(maxBetPerLine, Math.floor(Number(prev)+delta))));
  };

  const spin = async () => {
    if (spinning || !Number.isFinite(balance) || bet * lines > balance) return;
    setSpinning(true);setServiceError('');
    setShowWin(false);setWinAmount(0);setWinningCells([]);setBonusResult(null);
    spinSoundStopRef.current?.();spinSoundStopRef.current = playReelSpinSound();
    const spinTimer=setInterval(()=>setGrid(createPreviewGrid()),90);
    const requestId=requestRef.current||crypto.randomUUID();requestRef.current=requestId;
    try{
      const outcome=await slotCall({action:'spin',game:gameSlug,requestId,betUnits:bet,lines});
      const mapped=(outcome.grid||[]).map(reel=>reel.map(index=>symbolList[Number(index)]?.id||symbolList[0]?.id));
      clearInterval(spinTimer);
      await new Promise(resolve=>setTimeout(resolve,250));
      spinSoundStopRef.current?.();spinSoundStopRef.current=null;
      setGrid(mapped);setPracticeChips(Number(outcome.chips));
      setWinAmount(Number(outcome.paidUnits||0));setWinningCells(outcome.winningCells||[]);
      setShowWin(Number(outcome.paidUnits||0)>0);
      setBonusResult(outcome.scatterCount>=3?{triggered:true,scatterCount:outcome.scatterCount}:null);
      if(outcome.scatterCount>=3)playScatterSound();
      if(Number(outcome.paidUnits||0)>0)playWinSound();
      requestRef.current=null;
    }catch(error){
      clearInterval(spinTimer);spinSoundStopRef.current?.();spinSoundStopRef.current=null;
      setServiceError(error?.message||'Practice spin failed. Retry the same spin.');
    }finally{setSpinning(false);}
  };

  const refill = async () => {
    if(spinning)return;
    try{const data=await slotCall({action:'refill'});setPracticeChips(Number(data.chips));setServiceError('');}
    catch(error){setServiceError(error?.message||'Practice refill unavailable');}
  };

  const symbolList = Object.values(symbols);
  const winRatio = bet * lines > 0 ? winAmount / (bet * lines) : 0;
  const winFxVariant = winRatio >= 100 ? 'jackpot' : winRatio >= 50 ? 'megaWin' : winRatio >= 15 ? 'bigWin' : winRatio >= 2 ? 'coinBurst' : 'coinShower';
  const winFxLabel = winRatio >= 100 ? 'Jackpot' : winRatio >= 50 ? 'Mega Win' : winRatio >= 15 ? 'Big Win' : 'Win';

  const createPreviewGrid = () => Array(slotCols).fill(null).map(() =>
    Array(slotRows).fill(null).map(() => symbolList[Math.floor(Math.random() * symbolList.length)]?.id)
  );

  return (
    <div className={`ig-standalone-slot ${isFarmageddon?'ig-farmageddon-slot':''} relative overflow-hidden border shadow-2xl ${isFarmageddon ? 'mx-auto aspect-square max-w-[920px] rounded-[1.75rem]' : 'rounded-[2rem]'} ${theme.shell}`}>
      {artworkUrl && <img src={artworkUrl} alt={`${title} artwork`} className={`absolute inset-0 h-full w-full object-cover ${isFarmageddon ? 'opacity-100' : 'opacity-55'}`} />}
      {!isFarmageddon && <div className={`absolute inset-0 ${theme.bg} ${artworkUrl ? 'opacity-90 mix-blend-multiply' : ''}`} />}
      {artworkUrl && !isFarmageddon && <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/20 to-black/80" />}
      {showWin && <SlotCelebrationFX variant={winFxVariant} label={winFxLabel} />}
      {bonusResult?.triggered && <SlotCelebrationFX variant="scatter" label={`${bonusResult.scatterCount} Scatters`} />}
      <div className={isFarmageddon ? 'absolute inset-0 z-10' : 'relative z-10 p-4 md:p-5'}>
        <div className={isFarmageddon ? 'hidden' : 'ig-slot-title mb-4 flex items-center justify-between gap-3'}>
          <div className={`inline-flex items-center gap-3 rounded-xl border px-6 py-3 text-xl md:text-3xl font-black tracking-[0.12em] uppercase ${theme.badge}`}>
            <span className="text-3xl md:text-4xl normal-case tracking-normal">{titleEmoji}</span>
            <span className="drop-shadow-[0_3px_0_rgba(0,0,0,0.65)]">{title}</span>
          </div>
          <div className="rounded-xl border border-white/15 bg-black/45 px-3 py-2 text-right">
            <div className="text-[9px] font-black uppercase tracking-[.18em] text-white/55">Practice chips</div>
            <div className="font-mono text-lg font-black text-amber-200">{balance.toLocaleString()}</div>
          </div>
        </div>

        <div className={`ig-slot-reels ${isFarmageddon ? 'absolute left-[26.1%] right-[25.6%] top-[42.1%] h-[36.8%] border-0 bg-transparent p-0 shadow-none' : `relative rounded-[1.5rem] border p-3 ${theme.frame}`}`}>
          {isFarmageddon ? (
            <div className="grid h-full grid-cols-4 grid-rows-4 gap-x-[1.9%] gap-y-[3.8%] overflow-hidden">
              {Array(4).fill(null).map((_, row) =>
                Array(4).fill(null).map((_, col) => {
                  const symbolId = grid[col]?.[row] || symbolList[0]?.id;
                  const symbolIndex = Math.max(0, symbolList.findIndex((item) => item.id === symbolId));
                  const stripSymbols = [
                    symbolList[(symbolIndex + symbolList.length - 1) % symbolList.length],
                    symbolList[symbolIndex],
                    symbolList[(symbolIndex + 1) % symbolList.length],
                  ];
                  const isWin = winningCells.includes(`${col},${row}`);

                  return (
                    <div key={`reel-window-${col}-${row}`} className="relative overflow-hidden rounded-[2px] bg-transparent">
                      <motion.div
                        className={`absolute inset-x-0 top-0 flex h-[300%] flex-col ${spinning ? 'blur-[1.5px]' : ''}`}
                        animate={{ y: spinning ? ['-133.333%', '-33.333%', '0%', '-66.666%', '-33.333%'] : '-33.333%' }}
                        transition={{ duration: spinning ? 0.22 : 0.55, repeat: spinning ? Infinity : 0, ease: spinning ? 'linear' : [0.16, 1, 0.3, 1], delay: col * 0.08 }}
                      >
                        {stripSymbols.map((stripSymbol, stripIndex) => (
                          <div
                            key={`${col}-${row}-${stripIndex}`}
                            className={`flex h-1/3 items-center justify-center ${isWin && stripIndex === 1 ? theme.winCell : ''}`}
                          >
                            {stripSymbol?.image ? (
                              <div className="relative flex h-full w-full items-center justify-center">
                                <img src={stripSymbol.image} alt={stripSymbol.label} className={`object-contain drop-shadow-[0_4px_7px_rgba(0,0,0,0.95)] ${stripSymbol.id === 'SCATTER' ? 'h-24 w-24 md:h-36 md:w-36' : 'h-20 w-20 md:h-32 md:w-32'}`} />
                                {stripSymbol.id === 'SCATTER' && (
                                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full border border-yellow-200 bg-yellow-300 px-1.5 py-0.5 text-[7px] font-black tracking-[0.12em] text-yellow-950 shadow-lg md:text-[9px]">
                                    SCATTER
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-3xl leading-none drop-shadow-[0_3px_5px_rgba(0,0,0,0.9)] md:text-5xl">{stripSymbol?.emoji || '❔'}</span>
                            )}
                          </div>
                        ))}
                      </motion.div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <div className={`grid grid-cols-5 ${theme.reelGap}`}>
              {Array(ROWS).fill(null).map((_, row) =>
                Array(COLS).fill(null).map((_, col) => {
                  const symbolId = grid[col]?.[row];
                  const symbol = symbolList.find((item) => item.id === symbolId);
                  const isWin = winningCells.includes(`${col},${row}`);
                  return (
                    <motion.div
                      key={`${col}-${row}`}
                      initial={{ opacity: 0.8, scale: 0.96 }}
                      animate={{ opacity: spinning ? 0.85 : 1, scale: isWin ? 1.06 : 1, y: spinning ? [0, -10, 10, 0] : 0 }}
                      transition={{ duration: spinning ? 0.25 : 0.2, repeat: spinning ? Infinity : 0, delay: col * 0.03 }}
                      className={`h-[86px] rounded-2xl border flex flex-col items-center justify-center overflow-hidden ${theme.cell} ${isWin ? theme.winCell : ''}`}
                    >
                      {symbol?.image ? (
                        <img src={symbol.image} alt={symbol.label} className="h-12 w-12 object-contain" />
                      ) : (
                        <span className="text-3xl leading-none">{symbol?.emoji || '❔'}</span>
                      )}
                      <span className="mt-1 text-[10px] uppercase tracking-[0.24em] text-white/60">{symbol?.label || ''}</span>
                    </motion.div>
                  );
                })
              )}
            </div>
          )}
        </div>

        <AnimatePresence>
          {showWin && winAmount > 0 && (
            <motion.div initial={{ opacity: 0, y: 8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} className={`ig-slot-win ${isFarmageddon ? 'absolute bottom-[14.6%] right-[33%] z-30 rounded-md border border-[#d6b17a] bg-[#6b371b]/90 px-3 py-1 text-center shadow-xl shadow-black/60' : 'mt-4 rounded-2xl border px-4 py-3 text-center'} ${isFarmageddon ? '' : theme.winBanner}`}>
              <div className={isFarmageddon ? 'text-sm md:text-lg font-black text-white' : 'text-3xl font-black text-white'}>+{winAmount.toLocaleString()} PRACTICE</div>
              <div className={isFarmageddon ? 'text-[10px] text-white/80 font-bold uppercase' : 'text-sm text-white/70 font-bold tracking-[0.24em] uppercase'}>win</div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className={`ig-slot-controls ${isFarmageddon ? 'absolute bottom-[3.1%] left-[25.8%] right-[25.8%] grid grid-cols-[1fr_1fr] gap-[34%] bg-transparent p-0' : 'mt-4 grid grid-cols-2 gap-3'}`}>
          <div className={isFarmageddon ? 'rounded-md border border-[#5b341c] bg-[#6b371b]/80 p-1.5 shadow-inner shadow-black' : 'rounded-2xl border border-white/10 bg-black/30 p-3'}>
            <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-white/60">
              <span>Bet / line</span><span className="text-white font-bold">{bet}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => adjustBet(-1)} disabled={spinning} variant="outline" size="icon" className={isFarmageddon ? 'h-8 min-h-0 w-12 min-w-0 rounded-md border-[#d6b17a] bg-[#8a4b25] p-0 text-white hover:bg-[#a65f30]' : 'h-9 w-9 min-h-0 min-w-0 p-0'}><Minus className="w-3 h-3" /></Button>
              <div className={isFarmageddon ? 'hidden' : 'flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-center text-white font-mono'}>{bet}</div>
              <Button onClick={() => adjustBet(1)} disabled={spinning} variant="outline" size="icon" className={isFarmageddon ? 'h-8 min-h-0 w-12 min-w-0 rounded-md border-[#d6b17a] bg-[#8a4b25] p-0 text-white hover:bg-[#a65f30]' : 'h-9 w-9 min-h-0 min-w-0 p-0'}><Plus className="w-3 h-3" /></Button>
            </div>
          </div>
          <div className={isFarmageddon ? 'rounded-md border border-[#5b341c] bg-[#6b371b]/80 p-1.5 shadow-inner shadow-black' : 'rounded-2xl border border-white/10 bg-black/30 p-3'}>
            <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-white/60">
              <span>Lines</span><span className="text-white font-bold">{lines}</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {(isFarmageddon ? [1, 3, 5, 6] : [1, 5, 10, 20]).map((lineCount) => (
                <button key={lineCount} onClick={() => setLines(lineCount)} disabled={spinning} className={`rounded-xl px-2 py-2 text-xs font-black transition-all ${lines === lineCount ? 'bg-white text-black' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}>
                  {lineCount}
                </button>
              ))}
            </div>
          </div>
        </div>

        <Button onClick={spin} disabled={spinning || practiceChips===null || bet * lines > balance} className={`ig-slot-spin ${isFarmageddon ? 'absolute bottom-[2.7%] left-1/2 z-20 h-[10.3%] w-[10.3%] min-w-0 -translate-x-1/2 rounded-full border-[5px] border-[#d8f89a] bg-gradient-to-b from-lime-300 via-lime-500 to-green-600 text-[clamp(12px,1.5vw,24px)] font-black text-[#173500] shadow-[0_0_24px_rgba(132,255,30,0.75),inset_0_4px_10px_rgba(255,255,255,0.55)] hover:from-lime-200 hover:to-green-500' : 'mt-4 w-full h-14 rounded-2xl text-base font-black'} ${isFarmageddon ? '' : theme.spin}`}>
          {spinning ? <><RotateCcw className={isFarmageddon ? 'w-5 h-5 animate-spin' : 'w-5 h-5 animate-spin mr-2'} />{isFarmageddon ? '' : 'SPINNING...'}</> : <>{!isFarmageddon && <Zap className="w-5 h-5 mr-2" />}{isFarmageddon ? 'SPIN' : `SPIN — ${bet * lines} PRACTICE`}</>}
        </Button>
        {serviceError&&<p role="alert" className={isFarmageddon?'absolute bottom-[14%] left-1/2 z-30 -translate-x-1/2 rounded bg-red-950/90 px-3 py-1 text-xs text-red-100':'mt-3 rounded-lg bg-red-950/80 p-2 text-xs text-red-100'}>{serviceError}</p>}
        {balance<100&&practiceChips!==null&&<button type="button" disabled={spinning} onClick={()=>void refill()} className={isFarmageddon?'absolute left-[2%] top-[2%] z-30 rounded bg-amber-300 px-2 py-1 text-[10px] font-black text-black':'mt-2 text-xs font-bold text-amber-200 underline'}>Free practice refill</button>}
        {isFarmageddon&&<div className="absolute right-[2%] top-[2%] z-30 rounded bg-black/60 px-2 py-1 text-[10px] font-black text-amber-200">{balance.toLocaleString()} PRACTICE</div>}
      </div>
    </div>
  );
}