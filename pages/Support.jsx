import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, CircleAlert, Headphones, Loader2, MessageCircle, Plus, RefreshCcw, Send, ShieldCheck, X } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';

const when = value => value && !Number.isNaN(Date.parse(value)) ? new Date(value).toLocaleString() : '—';
const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold transition hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-pink-400 disabled:cursor-not-allowed disabled:opacity-50';
const primary = button + ' border-pink-400/20 bg-gradient-to-r from-pink-600 to-purple-600 text-white hover:brightness-110';
const field = 'w-full rounded-xl border border-white/15 bg-[#0d0a17] p-3 text-base text-white outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-400/20 disabled:opacity-50';
async function call(action, values = {}) {
  const { data, error } = await supabase.functions.invoke('ig-support-v1', { body: { action, ...values } });
  if (error || data?.error) {
    let reason = data?.error;
    if (!reason && error?.context?.clone) {
      try { reason = (await error.context.clone().json())?.error; } catch { /* A failed gateway may not return JSON. */ }
    }
    throw Error(typeof reason === 'string' && reason.length <= 200 ? reason : 'Support is unavailable right now. Please try again.');
  }
  return data;
}
function requestId(reference, payload) {
  const fingerprint = JSON.stringify(payload);
  if (reference.current?.fingerprint !== fingerprint) reference.current = { fingerprint, id: crypto.randomUUID() };
  return reference.current.id;
}

export default function Support() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const selected = params.get('ticket');
  const currentSelection = useRef(selected);
  currentSelection.current = selected;
  const [tickets, setTickets] = useState([]), [ticket, setTicket] = useState(null), [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true), [detailLoading, setDetailLoading] = useState(false), [busy, setBusy] = useState(false);
  const [listError, setListError] = useState(''), [detailError, setDetailError] = useState(''), [actionError, setActionError] = useState(''), [success, setSuccess] = useState('');
  const [showCreate, setShowCreate] = useState(false), [subject, setSubject] = useState(''), [firstMessage, setFirstMessage] = useState(''), [reply, setReply] = useState('');
  const listGeneration = useRef(0), detailGeneration = useRef(0), submitting = useRef(false);
  const openRequest = useRef(null), replyRequest = useRef(null);
  const subjectInput = useRef(null);
  const refresh = useCallback(async () => {
    const generation = ++listGeneration.current;
    setLoading(true); setListError('');
    try { const response = await call('mine'); if (generation === listGeneration.current) setTickets(response.tickets || []); }
    catch (failure) { if (generation === listGeneration.current) setListError(failure.message); }
    finally { if (generation === listGeneration.current) setLoading(false); }
  }, []);
  const refreshDetail = useCallback(async id => {
    const generation = ++detailGeneration.current;
    setTicket(null); setMessages([]); setDetailError('');
    if (!id) { setDetailLoading(false); return; }
    setDetailLoading(true);
    try {
      const response = await call('messages', { ticketId: id });
      if (!response?.ticket) throw Error('This ticket could not be found. Choose another ticket or open a new one.');
      if (generation === detailGeneration.current) { setTicket(response.ticket); setMessages(response.messages || []); }
    } catch (failure) { if (generation === detailGeneration.current) setDetailError(failure.message); }
    finally { if (generation === detailGeneration.current) setDetailLoading(false); }
  }, []);
  useEffect(() => {
    setTickets([]); setTicket(null); setMessages([]); setSuccess(''); setActionError('');
    setSubject(''); setFirstMessage(''); setReply('');
    openRequest.current = null; replyRequest.current = null;
    void refresh();
    return () => { ++listGeneration.current; ++detailGeneration.current; };
  }, [user?.id, refresh]);
  useEffect(() => { setReply(''); setActionError(''); void refreshDetail(selected); return () => { ++detailGeneration.current; }; }, [selected, user?.id, refreshDetail]);
  useEffect(() => { if (showCreate) subjectInput.current?.focus(); }, [showCreate]);
  const chooseTicket = id => { ++detailGeneration.current; setTicket(null); setMessages([]); setShowCreate(false); setParams(id ? { ticket: id } : {}); setSuccess(''); setActionError(''); };
  const newTicket = () => { if (submitting.current) return; setShowCreate(value => !value); setParams({}); setSuccess(''); setActionError(''); };

  async function open(event) {
    event.preventDefault();
    const payload = { subject: subject.trim(), body: firstMessage.trim() };
    if (submitting.current || payload.subject.length < 3 || payload.subject.length > 120 || !payload.body || payload.body.length > 2000) return;
    submitting.current = true; setBusy(true); setActionError(''); setSuccess('');
    try {
      const response = await call('open', { ...payload, requestId: requestId(openRequest, payload) });
      if (typeof response?.id !== 'string') throw Error('The ticket response was incomplete. Refresh your tickets before trying again.');
      openRequest.current = null; setSubject(''); setFirstMessage(''); setShowCreate(false);
      setParams({ ticket: response.id }); setSuccess('Support ticket created. Our team can now review it.');
      await refresh();
    } catch (failure) { setActionError(failure.message + ' Your draft is saved here; retrying unchanged details uses the same request.'); }
    finally { submitting.current = false; setBusy(false); }
  }
  async function send(event) {
    event.preventDefault();
    const payload = { ticketId: selected, body: reply.trim() };
    if (submitting.current || !ticket || ticket.id !== selected || ticket.status === 'closed' || !payload.body || payload.body.length > 2000) return;
    submitting.current = true; setBusy(true); setActionError(''); setSuccess('');
    try {
      const response = await call('post', { ...payload, requestId: requestId(replyRequest, payload) });
      if (typeof response?.id !== 'string') throw Error('The message response was incomplete. Refresh the conversation before trying again.');
      replyRequest.current = null; setReply(''); setSuccess('Message sent to support.');
      await Promise.all([currentSelection.current === payload.ticketId ? refreshDetail(payload.ticketId) : Promise.resolve(), refresh()]);
    } catch (failure) { setActionError(failure.message + ' Your reply is kept here so you can retry the same request.'); }
    finally { submitting.current = false; setBusy(false); }
  }

  return <div className="min-h-screen bg-[#0A0612] px-4 py-8 text-white sm:py-12"><div className="mx-auto max-w-6xl space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-5">
      <div><div className="mb-4 inline-flex rounded-2xl border border-pink-400/20 bg-pink-400/10 p-3"><Headphones className="h-6 w-6 text-pink-300" /></div><p className="text-xs font-bold uppercase tracking-[.22em] text-amber-300">Imperial Games · Here to help</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">Customer Support</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-gray-400">Ask about a practice game, report a problem or continue a private conversation with our team.</p></div>
      <div className="flex flex-wrap gap-2"><button type="button" onClick={() => { void refresh(); if (selected) void refreshDetail(selected); }} disabled={busy || loading || detailLoading} className={button}><RefreshCcw size={15} /> Refresh</button><button type="button" onClick={newTicket} disabled={busy} className={primary}>{showCreate ? <X size={16} /> : <Plus size={16} />}{showCreate ? 'Close draft' : 'New ticket'}</button></div>
    </header>
    <div className="grid gap-3 sm:grid-cols-3"><Link to="/TesterChips" className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[.025] p-4 text-sm text-gray-300 hover:border-pink-400/40">How tester chips work<ArrowRight className="h-4 w-4 shrink-0 text-pink-300" /></Link><Link to="/ProvablyFair" className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[.025] p-4 text-sm text-gray-300 hover:border-pink-400/40">Understand game fairness<ArrowRight className="h-4 w-4 shrink-0 text-pink-300" /></Link><Link to="/ResponsiblePlay" className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[.025] p-4 text-sm text-gray-300 hover:border-pink-400/40">Responsible practice play<ArrowRight className="h-4 w-4 shrink-0 text-pink-300" /></Link></div>
    <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-[#171122] p-4 text-sm leading-6 text-gray-300"><ShieldCheck size={20} className="mt-0.5 shrink-0 text-amber-300" /><p>Your conversations are private to you and authorized support staff. Never include passwords, private keys or payment details. Automated triage does not make account decisions.</p></div>
    {actionError && <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm leading-6 text-red-200"><CircleAlert className="mt-0.5 h-5 w-5 shrink-0" /><p>{actionError}</p></div>}
    {success && <div role="status" className="flex items-center gap-3 rounded-xl border border-emerald-400/25 bg-emerald-400/10 p-4 text-sm text-emerald-100"><CheckCircle2 className="h-5 w-5 shrink-0" />{success}</div>}
    {showCreate && <section aria-labelledby="new-ticket-heading" className="rounded-2xl border border-pink-400/25 bg-[#1b1227] p-5 sm:p-6"><h2 id="new-ticket-heading" className="text-xl font-bold">Open a support case</h2><p className="mt-2 text-sm text-gray-400">Include the game, approximate time and what you expected to happen.</p><form onSubmit={open} className="mt-5 space-y-4" aria-busy={busy}><fieldset disabled={busy} className="min-w-0 space-y-4"><legend className="sr-only">New support ticket</legend>
      <div><label htmlFor="ticket-subject" className="block text-sm font-semibold">Subject</label><input ref={subjectInput} id="ticket-subject" aria-label="Ticket subject" value={subject} onChange={event => setSubject(event.target.value)} minLength={3} maxLength={120} required className={field + ' mt-2'} placeholder="Describe the issue in a few words" /></div>
      <div><label htmlFor="ticket-message" className="block text-sm font-semibold">What happened?</label><textarea id="ticket-message" aria-label="Ticket message" value={firstMessage} onChange={event => setFirstMessage(event.target.value)} maxLength={2000} rows={5} required className={field + ' mt-2'} placeholder="What were you doing when the problem happened?" /><p className="mt-2 text-right text-xs text-gray-500">{firstMessage.length} / 2,000 characters</p></div>
      <button disabled={subject.trim().length < 3 || !firstMessage.trim()} className={primary}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}{busy ? 'Submitting…' : 'Submit ticket'}</button>
    </fieldset></form></section>}
    <div className="grid items-start gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside aria-label="Your support tickets" className="overflow-hidden rounded-2xl border border-white/10 bg-[#15101f]"><div className="border-b border-white/10 p-4"><h2 className="font-bold">Your tickets</h2><p className="mt-1 text-xs text-gray-500">Your 30 most recently updated cases</p></div><div className="max-h-[600px] overflow-y-auto">
        {listError && <div role="alert" className="space-y-3 p-5 text-sm leading-6 text-red-200"><p>{listError}</p><button type="button" onClick={() => void refresh()} disabled={loading} className={button}>Retry ticket list</button></div>}
        {loading && <p role="status" className="flex items-center gap-2 p-5 text-sm text-gray-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading your tickets…</p>}
        {!loading && !listError && tickets.length === 0 && <div className="p-5"><p className="font-semibold">No support tickets yet.</p><p className="mt-2 text-sm leading-6 text-gray-400">Need a hand with something? Open a new ticket to start a conversation.</p></div>}
        {!loading && tickets.map(item => <button type="button" disabled={busy} onClick={() => chooseTicket(item.id)} key={item.id} aria-current={selected === item.id ? 'true' : undefined} className={'block w-full border-b border-white/5 p-4 text-left transition hover:bg-white/5 disabled:opacity-50 ' + (selected === item.id ? 'border-l-2 border-l-pink-400 bg-pink-400/10' : '')}><span className="block truncate text-sm font-semibold">{item.subject}</span><span className="mt-2 block text-xs capitalize text-amber-200">{item.status?.replaceAll('_', ' ')}</span><span className="mt-1 block text-xs text-gray-500">{when(item.updated_at)}</span></button>)}
      </div></aside>
      <section aria-label="Support conversation" className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-[#15101f]">
        {!selected ? <div className="flex min-h-[370px] flex-col items-center justify-center p-6 text-center"><div className="rounded-full border border-white/10 bg-white/5 p-5"><MessageCircle className="h-8 w-8 text-pink-300" /></div><h2 className="mt-5 text-lg font-bold">Select a ticket or create one</h2><p className="mt-2 max-w-xs text-sm leading-6 text-gray-400">Replies from our support team appear here. Check back for updates to your case.</p></div> : detailLoading ? <div role="status" className="flex min-h-[370px] items-center justify-center gap-3 text-sm text-gray-300"><Loader2 className="h-5 w-5 animate-spin text-pink-300" /> Loading ticket…</div> : detailError ? <div role="alert" className="flex min-h-[370px] flex-col items-center justify-center gap-4 p-6 text-center"><CircleAlert className="h-9 w-9 text-amber-300" /><h2 className="text-xl font-bold">Conversation unavailable</h2><p className="max-w-sm text-sm leading-6 text-gray-400">{detailError}</p><button type="button" onClick={() => void refreshDetail(selected)} className={button}>Retry conversation</button><button type="button" onClick={() => chooseTicket(null)} className="text-sm text-pink-300 hover:underline">Back to your tickets</button></div> : ticket && <div>
          <header className="border-b border-white/10 p-5"><button type="button" onClick={() => chooseTicket(null)} disabled={busy} className="mb-4 inline-flex min-h-8 items-center gap-2 text-xs text-pink-300 hover:underline disabled:opacity-50"><ArrowLeft size={14} /> All tickets</button><div className="flex flex-wrap items-start justify-between gap-3"><h2 className="min-w-0 break-words text-xl font-bold">{ticket.subject}</h2><span className="rounded-full border border-amber-300/15 bg-amber-300/5 px-3 py-1 text-xs capitalize text-amber-200">{ticket.status?.replaceAll('_', ' ')}</span></div></header>
          <div className="max-h-[420px] min-h-[190px] space-y-4 overflow-y-auto p-5" aria-label="Ticket messages">{messages.length ? messages.map(message => <div key={message.id} className={'max-w-[95%] rounded-2xl border p-4 ' + (message.sender_kind === 'staff' ? 'mr-auto border-purple-300/20 bg-purple-300/10' : 'ml-auto border-amber-300/20 bg-amber-300/5')}><div className="mb-2 flex flex-wrap justify-between gap-2 text-xs"><span className="font-bold text-amber-200">{message.sender_kind === 'staff' ? 'Support team' : 'You'}</span><time className="text-gray-500">{when(message.created_at)}</time></div><p className="whitespace-pre-wrap break-words text-sm leading-6">{message.body}</p></div>) : <p className="py-5 text-center text-sm text-gray-400">There are no messages in this conversation yet.</p>}</div>
          {ticket.status === 'closed' ? <p className="border-t border-white/10 p-5 text-sm leading-6 text-gray-400">This ticket is closed. <button type="button" onClick={newTicket} className="font-semibold text-pink-300 hover:underline">Open a new ticket</button> if you need more help.</p> : <form onSubmit={send} className="space-y-3 border-t border-white/10 p-5" aria-busy={busy}><label htmlFor="support-reply" className="block text-sm font-semibold">Reply to support</label><textarea id="support-reply" value={reply} onChange={event => setReply(event.target.value)} rows={4} maxLength={2000} required disabled={busy} placeholder="Add more details or reply to support…" className={field} /><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-gray-500">{reply.length} / 2,000 characters</p><button disabled={!reply.trim() || busy} className={primary}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}{busy ? 'Sending…' : 'Send message'}</button></div></form>}
        </div>}
      </section>
    </div>
  </div></div>;
}
