import React, { useState } from 'react';

export const PLAYER_EMOTES = [
  { id: 'poop', label: '💩 Throw Poop' },
  { id: 'dynamite', label: '🧨 Cartoon Dynamite' },
  { id: 'cheers', label: '🍻 Cheers' },
  { id: 'pie', label: '🥧 Pie Face' },
  { id: 'money', label: '💸 Make It Rain' },
  { id: 'chicken', label: '🐔 Rubber Chicken' },
  { id: 'water', label: '💦 Water Gun' },
];

const MAIN_METRICS = [
  ['vpip','VPIP'],['pfr','PFR'],['threeBet','3-Bet'],['foldToThreeBet','Fold to 3-Bet'],
  ['flopCBet','C-Bet'],['foldToFlopCBet','Fold to C-Bet'],['steal','Steal'],['blindDefense','Blind Defense'],
  ['handsWon','Hands Won'],['aggressionFactor','Aggression']
];
const percent = value => value == null || !Number.isFinite(Number(value)) ? 'N/A' : Number(value).toFixed(1)+'%';
const number = value => value == null || !Number.isFinite(Number(value)) ? 'N/A' : Number(value).toLocaleString();
function showdownTemperature(wsd){
  if(wsd==null||!Number.isFinite(Number(wsd)))return {label:'No read',icon:'—',className:'text-slate-400'};
  const n=Number(wsd);
  if(n>=60)return {label:'Hot',icon:'🔥',className:'text-orange-300'};
  if(n>=52)return {label:'Warm',icon:'🌡️',className:'text-amber-300'};
  if(n>=48)return {label:'Half & Half',icon:'⚖️',className:'text-yellow-200'};
  if(n>=40)return {label:'Cold',icon:'❄️',className:'text-sky-300'};
  return {label:'Freezing',icon:'🥶',className:'text-cyan-300'};
}
function MetricGrid({stats}){
 return <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 my-4">
  {MAIN_METRICS.map(([key,label])=><div key={key} className="rounded-xl border border-white/10 bg-slate-900 p-3">
    <strong className="block text-lg text-amber-200">{key==='aggressionFactor'?(stats?.[key]??'N/A'):percent(stats?.[key])}</strong>
    <span className="text-[11px] text-slate-400">{label}</span>
  </div>)}
 </div>;
}

export default function PokerPlayerProfile({ player, analytics, loading = false, analyticsError = '', onClose, onSendAction, disabled = false }) {
  const [tab, setTab] = useState('session');
  const [selected, setSelected] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  if (!player?.id) return null;
  const session=analytics?.currentSession||{};
  const career=analytics?.career||{};
  const heat=showdownTemperature(career.wsd);
  async function send() {
    if (!selected || pending || disabled || !onSendAction) return;
    setPending(true); setError('');
    try {
      await onSendAction({ targetPlayerId: player.id, actionId: selected });
      onClose?.();
    } catch (e) {
      setError(e?.message || 'Action could not be sent.');
    } finally { setPending(false); }
  }
  return <section role="dialog" aria-modal="true" aria-label={`${player.displayName || 'Player'} stats card`} className="max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-amber-700 bg-slate-950 p-5 text-white shadow-2xl">
    <header className="flex items-center justify-between gap-3">
      <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-amber-400">Player Stats Card</p><h2 className="text-xl font-black">{player.displayName || 'Imperial Player'}</h2></div>
      <button type="button" onClick={onClose} aria-label="Close profile" className="rounded-lg border border-white/20 px-3 py-2">✕</button>
    </header>
    <div className="my-4 flex items-center gap-4">
      {player.avatarUrl ? <img src={player.avatarUrl} alt="" className="h-16 w-16 rounded-full border-2 border-amber-300/60 object-cover" /> : <div className="grid h-16 w-16 place-items-center rounded-full bg-amber-900 text-2xl">♛</div>}
      <div><p className="text-sm text-slate-400">Verified archived poker data</p><p className="mt-1 text-xs text-slate-500">Only completed server-recorded hands count.</p></div>
    </div>
    <nav aria-label="Player stat sections" className="grid grid-cols-3 gap-1 rounded-xl bg-slate-900 p-1">
      {[['session','Current Session'],['career','Career'],['showdown','Showdown']].map(([id,label]) =>
        <button type="button" key={id} onClick={()=>setTab(id)} aria-current={tab===id?'page':undefined}
          className={'rounded-lg px-2 py-2 text-xs font-black '+(tab===id?'bg-amber-400 text-slate-950':'text-slate-300')}>{label}</button>)}
    </nav>
    {loading&&<p role="status" className="my-5 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">Loading verified stats…</p>}
    {analyticsError&&<p role="alert" className="my-5 rounded-xl border border-red-500/30 bg-red-950/50 p-4 text-sm text-red-200">{analyticsError}</p>}
    {!loading&&!analyticsError&&tab==='session'&&<>
      <div className="mt-4 flex items-end justify-between"><div><p className="text-xs text-slate-400">Hands this table</p><p className="text-3xl font-black text-amber-200">{number(session.hands)}</p></div><p className="text-xs text-slate-500">Current table session</p></div>
      <MetricGrid stats={session}/>
    </>}
    {!loading&&!analyticsError&&tab==='career'&&<>
      <div className="mt-4 flex items-end justify-between"><div><p className="text-xs text-slate-400">Verified career hands</p><p className="text-3xl font-black text-amber-200">{number(career.hands)}</p></div>{analytics?.sampledCareer&&<p className="text-xs text-amber-300">Latest 1,000 sampled</p>}</div>
      <MetricGrid stats={career}/>
    </>}
    {!loading&&!analyticsError&&tab==='showdown'&&<div className="my-5">
      <div className="grid grid-cols-2 gap-3">
        <article className="rounded-2xl border border-white/10 bg-slate-900 p-4">
          <p className="text-xs font-black text-slate-400">WTSD</p>
          <p className="mt-1 text-3xl font-black text-amber-200">{percent(career.wtsd)}</p>
          <p className="mt-2 text-[11px] leading-4 text-slate-500">Went To Showdown after seeing a flop.</p>
          <p className="mt-2 text-xs text-slate-400">{number(career.showdowns)} / {number(career.flopsSeen)}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-slate-900 p-4">
          <p className="text-xs font-black text-slate-400">WSD</p>
          <p className="mt-1 text-3xl font-black text-amber-200">{percent(career.wsd)}</p>
          <p className="mt-2 text-[11px] leading-4 text-slate-500">Won At Showdown out of showdowns reached.</p>
          <p className="mt-2 text-xs text-slate-400">{number(career.showdownWins)} / {number(career.showdowns)}</p>
        </article>
      </div>
      <div className="mt-3 rounded-2xl border border-white/10 bg-slate-900 p-4 text-center">
        <p className="text-xs uppercase tracking-widest text-slate-500">Showdown temperature</p>
        <p className={'mt-2 text-2xl font-black '+heat.className}>{heat.icon} {heat.label}</p>
        <p className="mt-2 text-xs text-slate-500">Temperature is a quick WSD read, not a skill grade.</p>
      </div>
    </div>}
    <div className="mt-4 border-t border-slate-700 pt-4">
      <label htmlFor="poker-player-action" className="mb-2 block font-semibold">Player Actions</label>
      <div className="flex gap-2">
        <select id="poker-player-action" value={selected} onChange={e=>setSelected(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-600 bg-slate-800 p-2" disabled={disabled||pending}>
          <option value="">Select an action…</option>{PLAYER_EMOTES.map(action=><option key={action.id} value={action.id}>{action.label}</option>)}
        </select>
        <button type="button" onClick={send} disabled={!selected||pending||disabled||!onSendAction} className="rounded-lg bg-amber-600 px-4 py-2 font-bold disabled:opacity-50">{pending?'Sending…':'Send'}</button>
      </div>
      {error&&<p role="alert" className="mt-2 text-red-400">{error}</p>}
      <p className="mt-2 text-xs text-slate-500">{disabled?'Table actions are disabled until shared social-event transport is enabled.':'Cosmetic table actions only.'}</p>
    </div>
  </section>;
}
