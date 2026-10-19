import React, { useState } from 'react';

/**
 * Player profile sheet for an opponent at a poker table.
 * Parent owns authorization and real-time transport: onSendAction({targetPlayerId, actionId}).
 * Stats must be computed from completed, server-verified hands.
 */
export const PLAYER_EMOTES = [
  { id: 'poop', label: '💩 Throw Poop' },
  { id: 'dynamite', label: '🧨 Cartoon Dynamite' },
  { id: 'cheers', label: '🍻 Cheers' },
  { id: 'pie', label: '🥧 Pie Face' },
  { id: 'money', label: '💸 Make It Rain' },
  { id: 'chicken', label: '🐔 Rubber Chicken' },
  { id: 'water', label: '💦 Water Gun' },
];
const METRICS = ['VPIP', 'PFR', '3-Bet', 'Fold to 3-Bet', 'C-Bet', 'Fold to C-Bet', 'Steal', 'Check/Raise', 'WTSD', 'WSD'];
function pct(value) { return Number.isFinite(value) ? `${Math.round(value * 100)}%` : 'N/A'; }
export default function PokerPlayerProfile({ player, stats = {}, career = {}, onClose, onSendAction, disabled = false }) {
  const [tab, setTab] = useState('stats');
  const [selected, setSelected] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  if (!player?.id) return null;
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
  return <section role="dialog" aria-modal="true" aria-label={`${player.displayName || 'Player'} profile`} className="rounded-2xl border border-amber-700 bg-slate-950 text-white p-5 max-w-lg w-full shadow-2xl">
    <header className="flex justify-between items-center"><h2 className="text-xl font-bold">Player Profile</h2><button type="button" onClick={onClose} aria-label="Close profile">✕</button></header>
    <div className="flex items-center gap-4 my-5">
      {player.avatarUrl ? <img src={player.avatarUrl} alt="" className="w-16 h-16 rounded-xl object-cover" /> : <div className="w-16 h-16 rounded-xl bg-amber-800 grid place-items-center">♛</div>}
      <div><h3 className="font-semibold">{player.displayName || 'Player'}</h3><p className="text-amber-400">Skill Score: {Number.isFinite(player.skillScore) ? player.skillScore : 'N/A'}</p><p className="text-xs text-slate-400">{player.archetype || 'Unclassified'}</p></div>
    </div>
    <nav aria-label="Profile sections" className="flex gap-3 border-b border-slate-700 pb-2">
      {[['stats','Game Stats'],['career','Career Stats'],['badbeats','Bad Beats']].map(([id,label]) => <button type="button" key={id} onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined} className={tab === id ? 'text-amber-400 font-bold' : 'text-slate-400'}>{label}</button>)}
    </nav>
    {tab === 'stats' && <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-5">{METRICS.map(key => <div key={key} className="rounded-lg bg-slate-900 p-2"><strong>{pct(stats[key])}</strong><div className="text-xs text-slate-400">{key}</div></div>)}</div>}
    {tab === 'career' && <div className="grid grid-cols-2 gap-3 my-5">{[['Hands Played',career.handsPlayed],['Tournaments',career.tournaments],['Final Tables',career.finalTables],['Trophies',career.trophies]].map(([label,value])=><div key={label} className="bg-slate-900 rounded-lg p-3"><strong>{value ?? 'N/A'}</strong><div className="text-xs text-slate-400">{label}</div></div>)}</div>}
    {tab === 'badbeats' && <div className="grid grid-cols-2 gap-3 my-5"><div>Given: {career.badBeatsGiven ?? 'N/A'}</div><div>Received: {career.badBeatsReceived ?? 'N/A'}</div></div>}
    <div className="border-t border-slate-700 pt-4 mt-4">
      <label htmlFor="poker-player-action" className="block mb-2 font-semibold">Player Actions</label>
      <div className="flex gap-2">
        <select id="poker-player-action" value={selected} onChange={e => setSelected(e.target.value)} className="min-w-0 flex-1 rounded-lg bg-slate-800 border border-slate-600 p-2" disabled={disabled || pending}>
          <option value="">Select an action…</option>{PLAYER_EMOTES.map(action => <option key={action.id} value={action.id}>{action.label}</option>)}
        </select>
        <button type="button" onClick={send} disabled={!selected || pending || disabled || !onSendAction} className="rounded-lg bg-amber-600 px-4 py-2 font-bold disabled:opacity-50">{pending ? 'Sending…' : 'Send'}</button>
      </div>
      {error && <p role="alert" className="text-red-400 mt-2">{error}</p>}
      <p className="text-xs text-slate-400 mt-2">Cosmetic table animations only. Mute and cooldown settings are enforced by the game service.</p>
    </div>
  </section>;
}
