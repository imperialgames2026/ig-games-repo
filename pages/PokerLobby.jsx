import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ChevronRight, CircleAlert, Clock3, Copy, Crown, Layers3, Loader2, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { practicePokerEvents } from '@/lib/practicePokerEvents';
import { isPokerId } from '@/lib/pokerTableView';
import { parsePokerInvite } from '@/lib/pokerInvite';

const actionStyle = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-3 font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#151020]';
const number = value => (typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value))) && Number.isSafeInteger(Number(value)) && Number(value) >= 0 ? Number(value).toLocaleString() : '—';
const statuses = { registration: 'Registration open', running: 'In progress', complete: 'Completed', completed: 'Completed', draft: 'Host is preparing' };

export default function PokerLobby() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [registered, setRegistered] = useState([]);
  const [invite, setInvite] = useState('');
  const [variant, setVariant] = useState('holdem');
  const [inviteError, setInviteError] = useState('');
  const mounted = useRef(true), pending = useRef(false), request = useRef(0), account = useRef(user?.id), inviteInput = useRef(null);
  account.current = user?.id;
  const canPlay = isAuthenticated && user?.role !== 'tester' && !user?.is_excluded;
  const parsedInvite = parsePokerInvite(invite, variant);

  const refresh = useCallback(async () => {
    if (!isAuthenticated || !user?.id || user.is_excluded) return;
    const ticket = ++request.current;
    const actor = user.id;
    const current = () => mounted.current && ticket === request.current && actor === account.current;
    setLoading(true); setLoadError('');
    try {
      const result = await practicePokerEvents.list();
      if (current()) setEvents(Array.isArray(result.events) ? result.events : []);
    } catch (error) {
      if (current()) setLoadError(error.message || 'Practice events could not load. Please try again.');
    } finally { if (current()) setLoading(false); }
  }, [isAuthenticated, user?.id, user?.is_excluded]);

  useEffect(() => {
    mounted.current = true;
    setEvents([]); setRegistered([]); setNotice(''); setActionError(''); setLoadError(''); setLoading(false);
    void refresh();
    return () => { mounted.current = false; ++request.current; };
  }, [refresh]);

  async function perform(task) {
    if (pending.current) return;
    const actor = account.current, current = () => mounted.current && actor === account.current;
    pending.current = true; setWorking(true); setActionError(''); setNotice('');
    try { await task(current); }
    catch (error) { if (current()) setActionError(error.message || 'The request could not be completed. Please try again.'); }
    finally { pending.current = false; if (mounted.current) setWorking(false); }
  }

  function openInvite(event) {
    event.preventDefault();
    if (!parsedInvite) {
      setInviteError('Enter a valid poker invite link or table ID. For a table ID, choose the matching game.');
      inviteInput.current?.focus(); return;
    }
    navigate(parsedInvite.destination);
  }

  return <main className="min-h-screen bg-[#0a0612] text-white">
    <header className="relative overflow-hidden border-b border-white/10 bg-gradient-to-br from-[#28142d] via-[#140c20] to-[#1c1539]">
      <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-24 h-96 w-96 rounded-full bg-pink-600/10 blur-3xl" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-300">Imperial Games · Tester chips</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">Multiplayer Poker</h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-gray-300">Your friends. Your table. A fresh stack.<br className="hidden sm:block" /> Choose Hold’em or Omaha and make your next hand a shared one.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#choose-table" className={`${actionStyle} bg-gradient-to-r from-pink-600 to-purple-600 hover:brightness-110`}>Find your table <ArrowRight className="h-4 w-4" aria-hidden="true" /></a>
            <a href="#join-room" className={`${actionStyle} border border-white/20 bg-white/5 hover:bg-white/10`}>I have an invite</a>
          </div>
          <p className="mt-5 flex items-center gap-2 text-sm text-amber-100"><ShieldCheck className="h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" /> Fictional chips. No purchases, entry fees or cash prizes.</p>
        </div>
        <div aria-hidden="true" className="relative mx-auto hidden w-full max-w-sm rounded-[45%] border-[8px] border-[#3a2737] bg-gradient-to-b from-[#1d3b32] to-[#11271f] px-12 py-12 text-center shadow-[0_20px_70px_rgba(0,0,0,0.35)] sm:block">
          <div className="absolute inset-4 rounded-[45%] border border-amber-200/15" /><Crown className="relative mx-auto h-7 w-7 text-amber-300/80" />
          <div className="relative mt-5 flex justify-center"><span className="flex h-24 w-16 -rotate-12 items-center justify-center rounded-lg border-2 border-white bg-[#eff2f8] text-4xl text-[#201126] shadow-lg">♠</span><span className="-ml-4 flex h-24 w-16 rotate-12 items-center justify-center rounded-lg border-2 border-white bg-[#eff2f8] text-4xl text-pink-700 shadow-lg">♥</span></div>
          <p className="relative mt-6 text-xs font-bold uppercase tracking-[0.2em] text-amber-100/80">Meet at the felt</p>
        </div>
      </div>
    </header>

    <div className="mx-auto max-w-6xl space-y-10 px-4 py-10 sm:px-6 sm:py-12">
      {!isAuthenticated && <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-pink-300/20 bg-pink-500/5 p-5" aria-label="Poker account access">
        <div><h2 className="font-bold">A seat for every player</h2><p className="mt-1 text-sm leading-6 text-gray-300">Browse the lobby freely. Sign in with your own account before creating a room or taking a seat.</p></div>
        <Link to="/login" state={{ from: { pathname: '/PokerLobby' } }} className={`${actionStyle} shrink-0 bg-pink-600 hover:bg-pink-500`}>Sign in to play <ChevronRight className="h-4 w-4" aria-hidden="true" /></Link>
      </section>}
      {user?.role === 'tester' && <p role="status" className="flex items-start gap-3 rounded-xl border border-amber-300/30 bg-amber-300/5 p-4 text-sm leading-6 text-amber-100"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />Your account has read-only tester access. You can review permitted screens, but taking a seat and registering require a player account. Contact your testing coordinator for access.</p>}
      {user?.is_excluded && <p role="alert" className="rounded-xl border border-amber-300/30 p-4 text-amber-100">Your account is excluded from play. <Link className="underline" to="/Support">Contact support</Link> if you need help.</p>}

      <section id="choose-table" className="scroll-mt-28" aria-labelledby="variants-heading">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-pink-300">Pick your game</p><h2 id="variants-heading" className="mt-2 text-2xl font-black sm:text-3xl">A table for your next hand</h2></div><Link to="/TesterChips" className="text-sm font-bold text-amber-200 underline underline-offset-4">How tester chips work</Link></div>
        <div className="grid gap-5 md:grid-cols-2">
          <article className="flex flex-col rounded-2xl border border-amber-300/20 bg-gradient-to-br from-[#26202b] to-[#171020] p-6 sm:p-7">
            <div className="flex items-center justify-between gap-3"><span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-300/10 text-3xl text-amber-200">♠</span><span className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs text-gray-300"><Users className="h-3.5 w-3.5" aria-hidden="true" />Up to 8 seats</span></div>
            <h3 className="mt-5 text-2xl font-black">Texas Hold’em</h3><p className="mt-3 flex-1 text-sm leading-7 text-gray-300">Two private cards. One shared board. Read the action, protect your stack, and make your best five-card hand.</p>
            <p className="mt-4 text-sm text-amber-100">1,000 tester chips per new private seat</p>
            <Link to="/PlayPoker" className={`${actionStyle} mt-5 bg-amber-300 text-[#191020] hover:bg-amber-200`}>Create or join a Hold’em table <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
          </article>
          <article className="flex flex-col rounded-2xl border border-purple-300/20 bg-gradient-to-br from-[#251836] to-[#171020] p-6 sm:p-7">
            <div className="flex items-center justify-between gap-3"><span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-300/10 text-3xl text-purple-200">♦</span><span className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs text-gray-300"><Users className="h-3.5 w-3.5" aria-hidden="true" />Up to 6 seats</span></div>
            <h3 className="mt-5 text-2xl font-black">Omaha</h3><p className="mt-3 flex-1 text-sm leading-7 text-gray-300">Four private cards, more possibilities. Make your hand with exactly two private cards and three cards from the board.</p>
            <p className="mt-4 text-sm text-purple-100">1,000 tester chips per new private seat</p>
            <Link to="/PlayOmaha" className={`${actionStyle} mt-5 border border-purple-300/50 bg-purple-300/10 text-purple-100 hover:bg-purple-300/20`}>Create or join an Omaha table <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
          </article>
        </div>
      </section>

      <section id="join-room" className="scroll-mt-28 rounded-2xl border border-white/10 bg-[#181120] p-6 sm:p-7" aria-labelledby="join-room-heading">
        <div className="flex items-center gap-3"><Copy className="h-5 w-5 text-pink-300" aria-hidden="true" /><h2 id="join-room-heading" className="text-xl font-black">Join a friend’s room</h2></div>
        <p id="poker-invite-help" className="mt-2 text-sm leading-6 text-gray-300">Paste the invite link your host shared. If you only have a table ID, choose the matching game.</p>
        <form noValidate onSubmit={openInvite} className="mt-5 grid items-end gap-4 lg:grid-cols-[1fr_11rem_auto]">
          <label className="min-w-0 text-sm font-semibold" htmlFor="poker-invite">Poker invite or table ID<input ref={inviteInput} id="poker-invite" value={invite} onChange={event => { setInvite(event.target.value); setInviteError(''); }} placeholder="Paste an invite link or table ID" autoCapitalize="none" autoComplete="off" spellCheck={false} aria-invalid={!!inviteError} aria-describedby={`poker-invite-help${inviteError ? ' poker-invite-error' : ''}`} className="mt-2 block min-h-12 w-full rounded-xl border border-white/20 bg-[#0d0915] px-4 py-3 text-sm font-normal outline-none focus:border-pink-300 focus:ring-1 focus:ring-pink-300" /></label>
          <label className="text-sm font-semibold" htmlFor="poker-variant">Room game<select id="poker-variant" value={parsedInvite?.fromLink ? parsedInvite.variant : variant} disabled={!!parsedInvite?.fromLink} onChange={event => setVariant(event.target.value)} className="mt-2 block min-h-12 w-full rounded-xl border border-white/20 bg-[#0d0915] px-3 py-3 font-normal outline-none focus:border-pink-300 focus:ring-1 focus:ring-pink-300 disabled:opacity-70"><option value="holdem">Hold’em</option><option value="omaha">Omaha</option></select></label>
          <button type="submit" className={`${actionStyle} bg-pink-600 hover:bg-pink-500`}>Open table <ArrowRight className="h-4 w-4" aria-hidden="true" /></button>
        </form>
        {parsedInvite?.fromLink && <p role="status" className="mt-3 flex items-center gap-2 text-sm text-emerald-200"><CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />{parsedInvite.variant === 'omaha' ? 'Omaha' : 'Hold’em'} invite recognized. The matching room will open.</p>}
        {inviteError && <p id="poker-invite-error" role="alert" className="mt-3 text-sm text-rose-200">{inviteError}</p>}
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#181120] p-6 sm:p-7" aria-labelledby="poker-events-heading" aria-busy={loading}>
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-pink-300">Meet your testing group</p><h2 id="poker-events-heading" className="mt-2 text-2xl font-black">Practice tournaments and Sit & Go</h2></div>{isAuthenticated && !user?.is_excluded && <button type="button" disabled={loading || working} onClick={() => void refresh()} className={`${actionStyle} min-h-10 border border-white/15 px-4 py-2 text-sm hover:bg-white/5 disabled:opacity-50`}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />Refresh events</button>}</div>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-400">Free, host-managed test events. Your host coordinates when an event starts and where you sit. Event features are in preview; there are no entry fees or cash prizes.</p>
        {!isAuthenticated ? <div className="mt-5 rounded-xl border border-dashed border-white/15 p-6 text-center"><Users className="mx-auto h-7 w-7 text-purple-300" aria-hidden="true" /><p className="mt-3 text-sm text-gray-300">Sign in to see events shared with your testing group.</p><Link to="/login" state={{ from: { pathname: '/PokerLobby' } }} className="mt-3 inline-block text-sm font-bold text-pink-300 underline underline-offset-4">Sign in to view practice events</Link></div> : user?.is_excluded ? null : <>
          {loading && <p role="status" className="mt-5 flex items-center gap-2 text-sm text-gray-300"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />{events.length ? 'Refreshing practice events…' : 'Loading practice events…'}</p>}
          {loadError && <div role="alert" className="mt-5 rounded-xl border border-amber-300/25 bg-amber-300/5 p-4"><p className="flex items-start gap-2 text-sm leading-6 text-amber-100"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{loadError}</p><p className="mt-2 text-sm text-gray-300">{events.length ? 'The last loaded list is shown below. Refresh before registering.' : 'Event availability could not be checked. You can still use the private-table links above.'}</p><button type="button" disabled={loading || working} onClick={() => void refresh()} className="mt-3 min-h-10 text-sm font-bold text-amber-200 underline underline-offset-4 disabled:opacity-50">Try loading events again</button></div>}
          {!loading && !loadError && events.length === 0 && <div className="mt-5 rounded-xl border border-dashed border-white/15 p-6 text-center"><Crown className="mx-auto h-7 w-7 text-amber-300" aria-hidden="true" /><h3 className="mt-3 font-bold">No practice events are currently open</h3><p className="mt-2 text-sm leading-6 text-gray-400">You don’t need an event to play. Create a private Hold’em or Omaha table and share its invite with a friend.</p><a href="#choose-table" className="mt-3 inline-block text-sm font-bold text-pink-300 underline underline-offset-4">Choose a private table</a></div>}
          {events.length > 0 && <div className="mt-5 grid gap-4 md:grid-cols-2">{events.map(event => {
            const hasEntry = !!event.myEntry || registered.includes(event.id);
            return <article key={event.id} className="flex flex-col rounded-xl border border-white/15 bg-black/20 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3"><h3 className="min-w-0 break-words text-lg font-bold">{event.name || 'Poker event'}</h3><span className="rounded-full bg-purple-300/10 px-3 py-1 text-xs text-purple-200">{statuses[event.status] || 'Host update pending'}</span></div>
              <p className="mt-3 text-sm text-gray-400">{event.format === 'sng' ? 'Sit & Go' : 'Practice tournament'} · {number(event.registered)} / {number(event.maxPlayers)} registered</p>
              <dl className="mt-4 grid grid-cols-2 gap-4 border-y border-white/10 py-4 text-sm"><div><dt className="text-gray-400">Starting stack</dt><dd className="mt-1 font-bold text-amber-100">{number(event.startingStack)} chips</dd></div><div><dt className="text-gray-400">Starting blinds</dt><dd className="mt-1 font-bold">{number(event.smallBlind)} / {number(event.bigBlind)}</dd></div></dl>
              <div className="mt-4 flex flex-1 flex-wrap items-end gap-3">
                {event.status === 'registration' && !hasEntry && <button type="button" disabled={working || !canPlay || !!loadError || loading} onClick={() => void perform(async current => {
                  const result = await practicePokerEvents.register(event.id);
                  if (!current()) return;
                  if (result.registered !== true) throw new Error('Registration could not be confirmed. Refresh the event before trying again.');
                  setRegistered(previous => [...new Set([...previous, event.id])]);
                  setNotice(`You are registered for ${event.name || 'this practice event'}. Your host will assign a table when the event starts.`);
                  await refresh();
                })} className={`${actionStyle} bg-pink-600 px-4 py-2 text-sm hover:bg-pink-500 disabled:opacity-50`}>{working ? 'Please wait…' : 'Register free'}</button>}
                {hasEntry && <><button type="button" disabled={working} onClick={() => void perform(async current => {
                  const result = await practicePokerEvents.tables(event.id);
                  if (!current()) return;
                  if (!isPokerId(result.myTableId)) { setNotice('You are registered. Your host has not assigned a table yet. Check again after the event starts.'); return; }
                  navigate('/PlayPoker?tableId=' + encodeURIComponent(result.myTableId));
                })} className={`${actionStyle} border border-purple-300/40 bg-purple-300/10 px-4 py-2 text-sm hover:bg-purple-300/20 disabled:opacity-50`}>Open my table</button><span className="inline-flex items-center gap-1.5 pb-3 text-xs text-emerald-200"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />Registered</span></>}
              </div>
            </article>;
          })}</div>}
        </>}
        {notice && <p role="status" className="mt-5 rounded-xl border border-emerald-300/25 bg-emerald-300/5 p-4 text-sm leading-6 text-emerald-100">{notice}</p>}
        {actionError && <p role="alert" className="mt-5 rounded-xl border border-rose-300/25 bg-rose-300/5 p-4 text-sm leading-6 text-rose-100">{actionError}</p>}
      </section>

      <section className="grid gap-5 md:grid-cols-[1.4fr_1fr]" aria-label="Poker session guidance">
        <div className="rounded-2xl border border-white/10 p-6"><h2 className="flex items-center gap-2 text-lg font-bold"><Clock3 className="h-5 w-5 text-amber-300" aria-hidden="true" />Know before you deal</h2><ul className="mt-4 space-y-3 text-sm leading-6 text-gray-300"><li>Each player needs a separate account. Two players with chips must be seated before the host can deal.</li><li>Turns use a 10-second clock with a free, one-use +30-second practice extension when available.</li><li>Seated players advance the streets and resolve the showdown. The host deals the next hand; there is no unattended dealer loop.</li><li>Stacks carry between hands. Rejoining the same seat does not issue another 1,000 chips.</li></ul></div>
        <div className="rounded-2xl border border-white/10 bg-[#181120] p-6"><Layers3 className="h-6 w-6 text-purple-300" aria-hidden="true" /><h2 className="mt-4 text-lg font-bold">Keep your tables together</h2><p className="mt-2 text-sm leading-6 text-gray-400">Already have room IDs? Keep up to three independent Hold’em rooms in your multi-table desk.</p><Link to="/PokerMultiTable" className="mt-4 inline-flex min-h-10 items-center gap-2 text-sm font-bold text-pink-300 underline underline-offset-4">My multi-table desk <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>{user?.role === 'superadmin' && <Link to="/PokerBotLab" className="mt-2 block min-h-10 text-sm font-bold text-amber-200 underline underline-offset-4">Open the operator’s AI Poker Lab</Link>}</div>
      </section>
    </div>
  </main>;
}
