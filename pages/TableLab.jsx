import TableScene from '../components/practice/TableScene';
import React, {useEffect, useRef, useState} from 'react';
import {createOutcome, reds, passLine} from '../components/practice/outcomes.mjs';
import '../components/practice/table-lab.css';
export default function TableLab() {
  const [game,setGame]=useState('roulette'), [outcome,setOutcome]=useState(null), [busy,setBusy]=useState(false);
  const [selected,setSelected]=useState('red'), [chips,setChips]=useState(1000), [stake,setStake]=useState(10), [point,setPoint]=useState(0), [message,setMessage]=useState('Choose a practice bet, then spin.');
  const [reduced,setReduced]=useState(false);
  const lock=useRef(false), timer=useRef(null);
  useEffect(()=>{const q=matchMedia('(prefers-reduced-motion: reduce)'); const update=()=>setReduced(q.matches);update();q.addEventListener('change',update);return()=>{q.removeEventListener('change',update);clearTimeout(timer.current);};},[]);
  function play(){
    if(lock.current || (!point&&chips<stake))return;
    lock.current=true;setBusy(true);
    const next=createOutcome(game);setOutcome(next);if(game==='roulette'||!point)setChips(c=>c-stake);
    timer.current=setTimeout(()=>{
      let win=false, payout=2, text='';
      if(game==='roulette'){
        const n=next.values[0];win=typeof selected==='number'?n===selected:selected==='red'?reds.has(n):selected==='black'?n!==0&&!reds.has(n):selected==='even'?n!==0&&n%2===0:n%2===1;
        payout=typeof selected==='number'?36:2;text=`${n} ${n===0?'green':reds.has(n)?'red':'black'} · ${win?'Win':'No win'}`;
      }else{
        const total=next.values[0]+next.values[1], state=passLine(point,total);setPoint(state.point);
        win=state.result==='win';text=`Rolled ${total} · ${state.result==='point'?`Point is ${state.point}`:state.result==='roll'?`Point ${state.point} stays`:win?'Pass line wins':'Pass line loses'}`;
        // An unresolved pass-line stake remains on the table; return it to the practice balance.
        // An unresolved pass-line stake stays reserved until win or seven-out.
      }
      if(win)setChips(c=>c+stake*payout);setMessage(text);lock.current=false;setBusy(false);
    },reduced?30:2600);
  }
  return <main className="table-lab">
    <header><div><small>IMPERIAL GAMES · TABLE LAB</small><h1>Practice casino</h1><p>Local demo chips · no cash value · no wallet connection</p></div><strong>{chips.toLocaleString()} chips</strong></header>
    <nav aria-label="Practice game">{['roulette','craps'].map(g=><button key={g} disabled={busy||!!point} aria-pressed={game===g} onClick={()=>{setGame(g);setOutcome(null);setPoint(0);setMessage(g==='craps'?'Pass line practice · roll to establish a point.':'Choose a practice bet, then spin.');}}>{g}</button>)}</nav>
    <TableScene game={game} outcome={outcome} busy={busy}/><section className="felt" aria-label={`${game} practice table`}>
      {game==='roulette'? <><div className="number-grid"><button disabled={busy} onClick={()=>setSelected(0)} aria-pressed={selected===0}>0</button>{Array.from({length:36},(_,i)=>i+1).map(n=><button key={n} className={reds.has(n)?'red':'black'} disabled={busy} aria-pressed={selected===n} onClick={()=>setSelected(n)}>{n}</button>)}</div><div className="outside">{['red','black','even','odd'].map(b=><button key={b} disabled={busy} aria-pressed={selected===b} onClick={()=>setSelected(b)}>{b}</button>)}</div></>:
      <><div className="craps-mark"><span>COME</span><b>FIELD · 2 3 4 9 10 11 12</b><div className="craps-numbers">{[4,5,6,8,9,10].map(n=><span key={n}>{n===6?'SIX':n===9?'NINE':n}</span>)}</div></div><div className="pass">PASS LINE <strong>{point?`POINT ${point}`:'COME OUT'}</strong></div><p>Prototype supports pass line only. Other markings are decorative.</p></>}
    </section>
    <footer><label>Practice stake <select disabled={busy||!!point} value={stake} onChange={e=>setStake(Number(e.target.value))}>{[10,25,50].map(n=><option key={n}>{n}</option>)}</select></label><button className="action" disabled={busy||(!point&&chips<stake)} onClick={play}>{busy?'In motion…':game==='roulette'?`Spin · ${selected}`:'Roll dice · pass line'}</button><button disabled={busy||!!point} onClick={()=>setChips(1000)}>Reset chips</button><p role="status" aria-live="polite">{message}</p></footer>
  </main>;
}
