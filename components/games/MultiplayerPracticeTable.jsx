import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Crown, Dices, RotateCw, Users, ShieldCheck } from 'lucide-react';
import { useMultiplayerPractice } from '@/hooks/useMultiplayerPractice';

const CHIP_VALUES = [1, 5, 10, 25, 100];
const REDS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const CRAPS_POINTS = [4,5,6,8,9,10];
const CRAPS_BETS = [
  { target: 'pass', label: 'PASS LINE', detail: 'Come-out 7 / 11; point before seven', payout: '1:1' },
  { target: 'dont_pass', label: "DON'T PASS BAR", detail: '2 / 3 wins; 12 pushes; seven out', payout: '1:1' },
  { target: 'field', label: 'FIELD', detail: '2 · 3 · 4 · 9 · 10 · 11 · 12', payout: '1:1 · 2 & 12 pay 2:1' },
  { target: 'any_seven', label: 'ANY SEVEN', detail: 'One-roll proposition', payout: '4:1' },
];
const chip = (v) => Number(v ?? 0).toLocaleString();

function PracticeNotice() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-sky-400/25 bg-sky-950/50 px-4 py-3 text-sm text-sky-100">
      <ShieldCheck className="h-5 w-5 shrink-0 text-sky-300" />
      <p><strong>Shared practice table only.</strong> All chips are imaginary, nontransferable and nonredeemable. No deposits, withdrawals, cash prizes or real wagers are connected to this room. Outcomes and chip accounting are server-controlled.</p>
    </div>
  );
}

function BetZone({ title, subtitle, target, payout, total, count, disabled, onBet, highlighted = false, className = '' }) {
  return (
    <button type="button" aria-label={'Place practice chips on ' + title}
      disabled={disabled} onClick={() => onBet(target)}
      className={'relative min-w-0 rounded-xl border-2 p-3 text-center transition focus-visible:outline focus-visible:outline-4 focus-visible:outline-amber-300 ' +
        (highlighted ? 'border-amber-300 bg-amber-300/20' : 'border-white/65 bg-black/10 hover:bg-white/15') +
        (disabled ? ' cursor-not-allowed opacity-65' : ' cursor-pointer') + ' ' + className}>
      <div className="text-base font-black tracking-wide sm:text-lg">{title}</div>
      {subtitle && <div className="mt-1 text-[11px] text-white/80">{subtitle}</div>}
      {payout && <div className="mt-1 text-[10px] font-bold text-yellow-200">{payout}</div>}
      {total > 0 && <div className="absolute -right-2 -top-2 flex min-w-9 items-center justify-center rounded-full border-2 border-amber-200 bg-purple-900 px-1.5 py-1 text-xs font-black shadow-lg" title={count + ' players/bets'}>
        {chip(total)}
      </div>}
    </button>
  );
}

function CrapsFelt({ table, choose, disabled, canBet, isShooter, onShoot }) {
  const start = useRef(null);
  const publicTotals = new Map((table.publicBets ?? []).map(b => [b.target, b]));
  const stats = target => publicTotals.get(target) || { units: 0, count: 0 };
  const roll = table.lastResult?.game === 'craps' ? table.lastResult : null;
  return (
    <div className="rounded-[2.5rem] border-[9px] border-[#654023] bg-[#073f34] p-2 shadow-[0_16px_55px_rgba(0,0,0,0.6)] sm:border-[15px]">
      <div className="relative overflow-hidden rounded-[2rem] border-2 border-[#e7dca6]/70 bg-[radial-gradient(circle_at_top,_#146d51,_#07553f_50%,_#043c31)] p-3 text-white sm:p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-white/30 pb-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.23em] text-yellow-200">Imperial Casino · Table C1</p>
            <h2 className="text-2xl font-black italic sm:text-3xl">CRAPS</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-yellow-300 bg-[#141b13] px-3 py-2 text-xs font-black text-yellow-200">
              {table.point ? 'POINT ' + table.point + ' · ON' : 'COME-OUT · OFF'}
            </span>
          </div>
        </div>

        <div className="mb-3 grid grid-cols-3 gap-2">
          <div className={"col-span-2 rounded-xl border border-white/30 bg-black/20 p-3 " + (isShooter ? "cursor-grab active:cursor-grabbing" : "")}
            style={{ touchAction: isShooter ? "none" : "auto" }}
            onPointerDown={e => { if (isShooter && !disabled) start.current = { x: e.clientX, y: e.clientY }; }}
            onPointerUp={e => {
              if (!isShooter || disabled || !start.current) return;
              const distance = Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y);
              start.current = null;
              if (distance >= 45) onShoot(); // Gesture requests a server roll; never determines dice values.
            }}
            onPointerCancel={() => { start.current = null; }}>
            <p className="text-xs font-semibold text-yellow-200">SHOOTER BOX</p>
            <div className="mt-2 flex min-h-20 items-center justify-center gap-3">
              {[0,1].map(index => <div key={index}
                className={"flex h-16 w-16 items-center justify-center rounded-lg border-4 border-slate-200 bg-white text-4xl font-black text-gray-950 shadow-xl sm:h-20 sm:w-20 " + (disabled && isShooter ? "animate-bounce" : "")}>
                {roll?.dice?.[index] ?? '⚀'}
              </div>)}
            </div>
            <p className="mt-2 text-center text-sm font-semibold">Last total: {roll?.total ?? 'Waiting for first throw'}</p>
            {isShooter && <p className="mt-1 text-center text-xs font-bold text-amber-200">Swipe across the felt to throw, or press Shoot below</p>}
          </div>
          <div className="rounded-xl border border-white/30 bg-black/20 p-3 text-center">
            <p className="text-xs font-black text-yellow-200">POINT MARKER</p>
            <p className="mt-4 text-4xl font-black">{table.point || 'OFF'}</p>
            <p className="mt-3 text-xs text-white/70">Round {table.round}</p>
          </div>
        </div>

        <div className="mb-3 grid grid-cols-6 gap-1.5">
          {CRAPS_POINTS.map(num => {
            const target = 'place_' + num;
            const b = stats(target);
            const odds = num === 4 || num === 10 ? '9:5' : num === 5 || num === 9 ? '7:5' : '7:6';
            return <BetZone key={target} target={target} title={String(num)} subtitle="PLACE"
              payout={odds} total={b.units} count={b.count} onBet={choose}
              disabled={!canBet || disabled} highlighted={table.point === num}
              className="min-h-24 !rounded-md !px-1" />;
          })}
        </div>
        <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {CRAPS_BETS.slice(2).map(b => <BetZone key={b.target} target={b.target}
            title={b.label} subtitle={b.detail} payout={b.payout}
            total={stats(b.target).units} count={stats(b.target).count} disabled={!canBet || disabled}
            onBet={choose} className="min-h-24" />)}
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {CRAPS_BETS.slice(0,2).map(b => <BetZone key={b.target} target={b.target}
            title={b.label} subtitle={b.detail} payout={b.payout}
            total={stats(b.target).units} count={stats(b.target).count}
            disabled={!canBet || disabled || !!table.point} onBet={choose} className="min-h-24" />)}
        </div>
        <p className="mt-4 text-center text-xs text-white/65">Select a practice chip, then tap a betting zone. Pass / Don't Pass can be placed on the come-out only; place bets wait until a point is ON.</p>
      </div>
    </div>
  );
}

function rouletteColor(n) {
  return n === 0 ? 'green' : REDS.has(n) ? 'red' : 'black';
}

function RouletteFelt({ table, choose, disabled, canBet }) {
  const publicTotals = new Map((table.publicBets ?? []).map(b => [b.target, b]));
  const stats = target => publicTotals.get(target) || { units: 0, count: 0 };
  const last = table.lastResult?.game === 'roulette' ? table.lastResult : null;
  const tile = (target, title, extraClass = '', label = '') => {
    const data = stats(target);
    return <BetZone key={target} target={target} title={title} subtitle={label}
      onBet={choose} disabled={!canBet || disabled} total={data.units} count={data.count}
      className={extraClass} />;
  };
  return (
    <div className="rounded-[2.5rem] border-[10px] border-[#654023] bg-[#073f34] p-2 shadow-[0_16px_55px_rgba(0,0,0,0.6)] sm:border-[15px]">
      <div className="overflow-hidden rounded-[2rem] border-2 border-yellow-200/60 bg-[radial-gradient(ellipse_at_top,_#146d51,_#07533f_60%,_#043c31)] p-3 text-white sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.23em] text-yellow-200">Imperial Casino · Table R1</p>
            <h2 className="text-2xl font-black italic sm:text-3xl">EUROPEAN ROULETTE</h2>
            <p className="text-xs text-white/70">Single zero · 37 pockets · no double zero</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative flex h-24 w-24 items-center justify-center rounded-full border-[8px] border-[#674224] bg-[conic-gradient(#b91c1c_0deg_20deg,#141414_20deg_40deg,#b91c1c_40deg_60deg,#141414_60deg_80deg,#b91c1c_80deg_100deg,#141414_100deg_120deg,#b91c1c_120deg_140deg,#141414_140deg_160deg,#b91c1c_160deg_180deg,#141414_180deg_200deg,#b91c1c_200deg_220deg,#141414_220deg_240deg,#b91c1c_240deg_260deg,#141414_260deg_280deg,#b91c1c_280deg_300deg,#141414_300deg_320deg,#b91c1c_320deg_340deg,#15803d_340deg_360deg)] shadow-xl">
              <span className={'flex h-14 w-14 items-center justify-center rounded-full border-4 border-amber-300 text-2xl font-black ' +
                (last?.color === 'red' ? 'bg-red-800' : last?.color === 'black' ? 'bg-black' : 'bg-emerald-800')}>
                {last?.number ?? '—'}
              </span>
            </div>
            <div className="text-right"><p className="text-xs text-yellow-200">LAST SPIN</p><p className="text-xl font-black">{last ? last.number + ' ' + last.color.toUpperCase() : 'Waiting'}</p><p className="text-xs text-white/60">Round {table.round}</p></div>
          </div>
        </div>
        <div className="overflow-x-auto pb-2">
          <div className="min-w-[740px]">
            <div className="grid grid-cols-[60px_minmax(0,1fr)_80px] gap-2">
              <div className="flex flex-col">{tile('number_0', '0', '!h-full !bg-emerald-700')}</div>
              <div className="grid grid-cols-12 gap-1">
                {[2,1,0].flatMap(row => Array.from({length:12}, (_,column) => {
                  const num=3*column+row+1;
                  return tile('number_'+num, String(num),
                    rouletteColor(num)==='red' ? '!rounded-sm !bg-red-900/75 !px-0' : '!rounded-sm !bg-black/75 !px-0');
                }))}
              </div>
              <div className="grid grid-rows-3 gap-1">
                {tile('column_3','2:1','!rounded-sm')}
                {tile('column_2','2:1','!rounded-sm')}
                {tile('column_1','2:1','!rounded-sm')}
              </div>
            </div>
            <div className="ml-[68px] mr-[88px] mt-2 grid grid-cols-3 gap-1.5">
              {tile('dozen_1', '1ST 12', '!rounded-sm','2:1')}
              {tile('dozen_2', '2ND 12', '!rounded-sm','2:1')}
              {tile('dozen_3', '3RD 12', '!rounded-sm','2:1')}
            </div>
            <div className="ml-[68px] mr-[88px] mt-2 grid grid-cols-6 gap-1.5">
              {tile('low', '1–18', '!rounded-sm')}
              {tile('even', 'EVEN', '!rounded-sm')}
              {tile('red', 'RED', '!rounded-sm !bg-red-900/70')}
              {tile('black', 'BLACK', '!rounded-sm !bg-black/80')}
              {tile('odd', 'ODD', '!rounded-sm')}
              {tile('high', '19–36', '!rounded-sm')}
            </div>
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-white/70">Inside bets (numbers) pay 35:1. Dozens / columns pay 2:1. Outside bets pay 1:1. Zero loses all outside bets.</p>
      </div>
    </div>
  );
}

function PlayersPanel({ table }) {
  const players=table.players ?? [];
  const shooter=players.find(p => p.shooter);
  return (
    <section className="rounded-2xl border border-white/10 bg-[#1b1728] p-5">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-black"><Users className="h-5 w-5 text-amber-300" /> Players at table ({players.length}/24)</h2>
      <p className="mb-3 text-sm text-white/70">{shooter ? (table.game==='craps' ? 'Current shooter: ' : 'Current spinner: ') + shooter.seat : 'Waiting for a player to join'}</p>
      <div className="max-h-48 space-y-2 overflow-y-auto">
        {players.map(p => <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm">
          <span className="flex items-center gap-2">{p.shooter && <Crown className="h-4 w-4 text-amber-300" />}{p.seat}</span>
          <span className={p.active ? 'text-emerald-300' : 'text-gray-500'}>{p.active ? 'Watching' : 'Away'}</span>
        </div>)}
        {!players.length && <p className="text-sm text-white/60">Join the table to become the first shooter/dealer.</p>}
      </div>
    </section>
  );
}

function MyBetsPanel({ table }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#1b1728] p-5">
      <h2 className="text-lg font-black">Your practice bets</h2>
      <div className="mt-3 space-y-2 text-sm">
        {!(table.myBets?.length) && <p className="text-gray-400">No pending selections.</p>}
        {table.myBets?.map(b => <div key={b.id} className="flex justify-between gap-3 rounded-lg bg-white/5 px-3 py-2">
          <span>{b.target.replace(/_/g, ' ').toUpperCase()}</span><span className="font-black text-amber-300">{chip(b.units)} chips</span>
        </div>)}
      </div>
      <h3 className="mt-5 border-t border-white/10 pt-3 text-sm font-black">Recent resolved practice bets</h3>
      <div className="mt-2 max-h-36 space-y-1 overflow-y-auto text-xs">
        {!(table.myRecent?.length) && <p className="text-gray-400">No resolved bets.</p>}
        {table.myRecent?.map((b,i) => <div key={i} className="flex justify-between gap-2 text-gray-300">
          <span>{b.target.replace(/_/g,' ')} · {chip(b.units)} placed</span>
          <span className={b.outcome==='win' ? 'text-green-300' : 'text-gray-400'}>
            {b.outcome.toUpperCase()} · {chip(b.paid)} returned
          </span>
        </div>)}
      </div>
    </section>
  );
}

export default function MultiplayerPracticeTable({ game }) {
  const [stake,setStake] = useState(5);
  const {table, loading, busy, error, user, isAuthenticated, refresh, join, claim, placeBet, runRound} = useMultiplayerPractice(game);
  const joined = !!table?.joined;
  const canBet = joined && user?.role !== 'tester' && !user?.is_excluded && table.chips >= stake;
  const amShooter = !!(table?.shooterId && user?.id === table.shooterId);
  const liveShooter=table?.players?.find(p=>p.shooter)?.active;
  const canClaim=joined && !amShooter && !liveShooter;
  const last=table?.lastResult;
  return (
    <main className="min-h-screen bg-[#0a0612] px-3 py-7 text-white sm:px-6">
      <div className="mx-auto max-w-[1440px] space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to="/Games" className="text-sm font-semibold text-amber-300 hover:underline">← All games</Link>
          <span className="rounded-full border border-amber-300/50 bg-amber-300/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-200">Multiplayer · Shared staging room</span>
        </div>
        <PracticeNotice />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-5">
            {loading && !table ? <div role="status" className="rounded-xl border border-white/10 bg-white/5 p-10 text-center">Connecting to the practice table…</div> : null}
            {table && (game==='craps'
              ? <CrapsFelt table={table} choose={target=>void placeBet(target,stake)} disabled={busy} canBet={canBet} isShooter={amShooter} onShoot={()=>void runRound()} />
              : <RouletteFelt table={table} choose={target=>void placeBet(target,stake)} disabled={busy} canBet={canBet} />)}
            {table && <section className="rounded-2xl border border-white/10 bg-[#1b1728] p-5">
              <div className="grid gap-5 md:grid-cols-[1fr_auto]">
                <div>
                  <h2 className="text-lg font-black">Select practice chips</h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {CHIP_VALUES.map(v => <button key={v} type="button" disabled={busy}
                      aria-pressed={stake===v} onClick={()=>setStake(v)}
                      className={'flex h-14 w-14 items-center justify-center rounded-full border-4 font-black shadow-inner '+
                        (stake===v ? 'scale-105 border-amber-300 bg-purple-700 text-white ring-2 ring-amber-300' : 'border-gray-200 bg-purple-950 text-amber-100')}>
                      {v}
                    </button>)}
                  </div>
                  <p className="mt-3 text-sm text-gray-400">Your remaining practice chips: <strong className="text-amber-300">{chip(table.chips)}</strong> · Each bet 1–100 chips. No refill or cashout.</p>
                  {table.chips < stake && <p className="mt-2 text-sm text-red-300">Choose a smaller chip, or wait for pending bets to settle.</p>}
                </div>
                <div className="flex flex-col justify-center gap-2">
                  {!joined && <button disabled={busy || user?.role==='tester' || user?.is_excluded}
                    onClick={()=>void join()} className="rounded-xl bg-amber-400 px-7 py-3 font-black text-gray-950 disabled:opacity-50">Join practice table</button>}
                  {joined && amShooter && <button disabled={busy} onClick={()=>void runRound()}
                    className="flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-7 py-4 text-lg font-black text-gray-950 disabled:opacity-50">
                    {game==='craps' ? <Dices className="h-5 w-5" /> : <RotateCw className="h-5 w-5" />}
                    {busy ? 'Processing…' : game==='craps' ? 'SHOOT THE DICE' : 'SPIN THE WHEEL'}
                  </button>}
                  {canClaim && <button onClick={()=>void claim()} disabled={busy}
                    className="rounded-xl bg-amber-400 px-6 py-3 font-black text-gray-950 disabled:opacity-50">Take idle {game==='craps' ? 'shooter' : 'spinner'} seat</button>}
                  {joined && !amShooter && !canClaim && <p className="rounded-xl border border-white/20 p-3 text-center text-sm text-gray-300">Place side bets and watch the action. The designated {game==='craps' ? 'shooter rolls' : 'spinner spins'} for the whole table.</p>}
                  <button type="button" onClick={()=>void refresh()} className="rounded-lg border border-white/25 px-5 py-2 text-sm text-gray-300 hover:bg-white/10">Refresh table</button>
                </div>
              </div>
              {last && <p className="mt-3 border-t border-white/10 pt-3 text-sm text-gray-300">
                Last action, round {last.round}: {last.game==='craps' ? 'dice '+last.dice.join(' + ')+' = '+last.total : 'ball on '+last.number+' ('+last.color+')'}.
                {last.game==='craps' && (last.pointAfter ? ' Point is '+last.pointAfter+'.' : ' Come-out round next.')}
              </p>}
              {!isAuthenticated && <Link to="/login" className="mt-4 block text-sm text-amber-300 underline">Sign in to join this table</Link>}
              {user?.role==='tester' && <p className="mt-3 text-sm text-amber-200">Tester access is read-only; you may watch but cannot place chips or shoot.</p>}
              {user?.is_excluded && <p className="mt-3 text-sm text-red-300">Account exclusion disables gameplay.</p>}
              {error && <p role="alert" className="mt-3 rounded-xl bg-red-950/70 p-3 text-sm text-red-200">{error}</p>}
            </section>}
          </div>
          <aside className="space-y-5">
            {table && <><PlayersPanel table={table}/><MyBetsPanel table={table}/></>}
            <section className="rounded-2xl border border-white/10 bg-[#1b1728] p-5">
              <h2 className="text-lg font-black">How this table works</h2>
              {game==='craps'
                ? <p className="mt-2 text-sm leading-6 text-gray-300">The shooter rolls for everyone. A 7 on the come-out does not pass the dice. When a point is established, repeat it to make the point, or roll a 7 to seven-out and rotate the shooter. Players may place Field and Any Seven side bets on the next roll, or Place Number bets while a point is active.</p>
                : <p className="mt-2 text-sm leading-6 text-gray-300">Everyone can place inside and outside practice bets on the same table. The designated spinner resolves all open selections in one European single-zero spin. After the result, a new round opens automatically.</p>}
              <p className="mt-2 text-xs text-yellow-200/80">Refreshes approximately every 3 seconds. Rules and bet calculations are for staging demonstration, not approved real-money settlement. No independent randomness certification has been completed.</p>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
