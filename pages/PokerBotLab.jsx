import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { requireSupabase } from '@/lib/supabaseClient';
import { Bot, ShieldCheck, Users, Play, RefreshCw, FlaskConical, ArrowLeft, AlertTriangle } from 'lucide-react';

async function call(action, tableId) {
  const body = tableId ? { action, tableId } : { action };
  const { data, error } = await requireSupabase().functions.invoke('ig-poker-bot-lab', { body });
  if (error) {
    const details = await error.context?.json?.().catch(() => null);
    throw new Error(details?.error || error.message || 'Poker bot lab unavailable');
  }
  if (!data || data.error || data.practiceOnly !== true) throw new Error(data?.error || 'Invalid practice response');
  return data;
}

const names = [
  ['Imperial Ace','Tight and selective','🂡'],
  ['Bluff Baron','Aggressive bluffer','♠'],
  ['Calling Carl','Loose/passive caller','♦'],
  ['Wildcard Wendy','Unpredictable','🃏'],
];
export default function PokerBotLab() {
  const { user } = useAuth();
  const authorized = user?.role === 'superadmin' && !user?.is_excluded;
  const [state, setState] = useState({bots:[],tables:[]});
  const [tableId, setTableId] = useState('');
  const [trace, setTrace] = useState([]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState('');
  const reload = useCallback(async () => {
    if (!authorized) return;
    try {const response = await call('list'); setState(response);}
    catch(e) {setFail(e.message);}
  },[authorized]);
  useEffect(() => {void reload();},[reload]);
  async function act(action) {
    if (!authorized || busy) return;
    setBusy(true); setStatus(''); setFail('');
    try {
      const data=await call(action, ['run','step'].includes(action)?tableId:undefined);
      if(data.tableId)setTableId(data.tableId);
      if(data.steps)setTrace(data.steps);
      else if(data.step)setTrace([data.step]);
      setStatus(action === 'provision' ?
        'Dedicated AI BOT identities provisioned and interactive logins blocked.' :
        action === 'create' ? 'Four AI test seats created in a new private practice table.' :
        action === 'run' ? (data.table?.status === 'complete' ? 'Practice hand completed.' : 'Step budget reached; run again to continue.') :
        'One server-controlled action processed.');
      await reload();
    } catch(e) {setFail(e.message);}
    finally {setBusy(false);}
  }
  if (!authorized) return <main className="min-h-screen bg-[#0A1019] text-white p-10" role="alert">
    This staging test control is available only to an authorized Superadmin.
  </main>;
  return <main className="min-h-screen bg-[#0A1019] text-white pb-20">
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Link to="/PokerLobby" className="text-amber-300 inline-flex gap-2 items-center text-sm hover:underline"><ArrowLeft size={16}/> Poker lobby</Link>
      <header className="mt-6">
        <p className="flex gap-2 items-center text-xs tracking-widest text-amber-300 uppercase"><FlaskConical size={18}/> Superadmin · staging test laboratory</p>
        <h1 className="text-3xl sm:text-5xl font-black mt-2">AI Poker Test Players</h1>
        <p className="text-gray-300 mt-3 max-w-3xl">Create four unmistakably labeled nonhuman players and simulate hands through the actual server-validated Hold’em practice tables.</p>
      </header>
      <div className="border border-amber-500/40 bg-amber-900/10 rounded-xl p-4 mt-6 text-sm text-amber-100 flex items-start gap-3" role="status">
        <AlertTriangle size={21} className="shrink-0"/>
        <span>These AI agents use different rule-based decision strategies, not a predictive language model. Their Auth logins are banned and their passwords discarded. This lab is isolated to the staging project; no IGN, IGD or redeemable wallet balance is used. Humans joining a test table are never controlled by bots.</span>
      </div>
      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
        {names.map(([name,style,emoji]) => <article key={name} className="bg-[#1c2032] border border-white/10 rounded-2xl p-5">
          <div className="text-4xl" aria-hidden="true">{emoji}</div>
          <h2 className="text-lg font-bold mt-4">{name}</h2>
          <p className="text-xs text-amber-300 uppercase tracking-wide font-semibold mt-1">AI BOT</p>
          <p className="text-sm text-gray-400 mt-2">{style}</p>
          <p className="text-xs text-gray-500 mt-3">{state.bots?.some(b=>b.name.includes(name)) ? 'Account provisioned' : 'Awaiting provisioning'}</p>
        </article>)}
      </section>
      <section className="bg-[#1b2134] rounded-2xl border border-white/10 p-6 mt-7">
        <h2 className="text-xl font-black mb-3 flex gap-2 items-center"><Bot size={23}/> Set up the test players</h2>
        <p className="text-sm text-gray-400 mb-5">Only the staging Superadmin can provision nonhuman Auth records. The provisioning action is idempotent for accounts already registered in the bot roster.</p>
        <div className="flex flex-wrap gap-3">
          <button type="button" disabled={busy} onClick={()=>void act('provision')} className="bg-amber-400 text-gray-950 px-5 py-3 rounded-xl font-bold disabled:opacity-50">
            {state.bots?.length===4?'Verify / provision missing bots':'Provision four AI bot accounts'}
          </button>
          <button type="button" disabled={busy||state.bots?.length!==4} onClick={()=>void act('create')} className="bg-emerald-600 px-5 py-3 rounded-xl font-bold disabled:opacity-50 flex items-center gap-2"><Users size={18}/> Create 4-seat test table</button>
          <button type="button" disabled={busy} onClick={()=>void reload()} className="bg-white/10 px-5 py-3 rounded-xl font-bold disabled:opacity-50 flex items-center gap-2"><RefreshCw size={18}/> Refresh</button>
        </div>
      </section>
      <section className="bg-[#1b2134] rounded-2xl border border-white/10 p-6 mt-5">
        <h2 className="text-xl font-black">Run poker test hands</h2>
        <label htmlFor="bot-table" className="block text-gray-300 text-sm mt-5">Registered AI test table ID</label>
        <input id="bot-table" value={tableId} onChange={e=>setTableId(e.target.value.trim())}
          placeholder="Select from created test tables or paste UUID"
          className="mt-2 bg-[#0c1525] border border-gray-600 rounded-xl px-4 py-3 w-full text-sm font-mono"/>
        {state.tables?.length>0 && <div className="flex gap-2 flex-wrap my-4">{state.tables.map(t=>
          <button key={t.table_id} type="button" className="rounded-lg text-xs border border-amber-500/40 px-3 py-2 text-amber-200"
            onClick={()=>setTableId(t.table_id)}>Table {t.table_id.slice(0,8)}</button>)}</div>}
        <div className="flex flex-wrap gap-3 mt-5">
          <button type="button" disabled={busy||!/^[0-9a-f-]{36}$/i.test(tableId)} onClick={()=>void act('run')}
            className="bg-indigo-600 px-5 py-3 rounded-xl font-bold flex items-center gap-2 disabled:opacity-50"><Play size={18}/> Simulate a full hand</button>
          <button type="button" disabled={busy||!/^[0-9a-f-]{36}$/i.test(tableId)} onClick={()=>void act('step')}
            className="bg-slate-600 px-5 py-3 rounded-xl font-bold disabled:opacity-50">One bot action / advance</button>
          {tableId && <Link to={'/PlayPoker?tableId='+encodeURIComponent(tableId)} className="border border-amber-400/60 px-5 py-3 rounded-xl text-amber-200 font-bold">Open live poker table →</Link>}
        </div>
        {busy && <p role="status" className="text-amber-200 mt-4">Executing secured staging action…</p>}
        {status && <p role="status" className="text-emerald-300 mt-4">{status}</p>}
        {fail && <p role="alert" className="text-rose-300 mt-4">{fail}</p>}
        {trace.length>0 && <div className="mt-6 bg-black/30 border border-white/10 rounded-xl p-4 max-h-80 overflow-auto">
          <h3 className="font-bold text-sm mb-2">Server-accepted activity</h3>
          <ol className="text-sm text-gray-300 space-y-1 list-decimal list-inside">
            {trace.map((step,i)=><li key={i}>{step.bot ? step.bot+': ' : ''}{step.action||step.status}{step.amount>0?' · raise target '+step.amount:''}</li>)}
          </ol>
        </div>}
      </section>
      <p className="text-xs text-gray-500 mt-6 flex gap-2 items-center"><ShieldCheck size={15}/> No service-role secrets or bot credentials are exposed to the browser. The backend verifies every Superadmin action.</p>
    </div>
  </main>;
}
