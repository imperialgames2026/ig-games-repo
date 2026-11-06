import React,{useEffect,useMemo,useRef,useState} from 'react';
import {useAuth} from '../lib/AuthContext';
import {supabase} from '../lib/supabaseClient';
import {createPvpClient,createActorBoundPvpInvoker} from '../lib/pvpClient.mjs';
import {pvpPending} from '../lib/pvpPending.mjs';
import {acceptPvpSnapshot,pendingPvpGames} from '../lib/pvpIntegration.mjs';
import AuthenticatedPvpRuntime from '../components/games/AuthenticatedPvpRuntime';
// Production activation is compiled after backend rollout; URL/storage cannot enable it.
const localReview=import.meta.env.MODE==='pvp-local-test'&&import.meta.env.VITE_LOCAL_PVP_REVIEW==='true';
const enabled=localReview||import.meta.env.VITE_ENABLE_PVP_PRACTICE==='true';
export default function PvpGameRoom(){
 const {user}=useAuth();const [playerCount,setPlayerCount]=useState(null),[game,setGame]=useState('chess'),[roomId,setRoomId]=useState(''),[invite,setInvite]=useState(''),[snapshot,setSnapshot]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);const lock=useRef(false),generation=useRef(0),roomRef=useRef('');
 const api=useMemo(()=>createPvpClient(createActorBoundPvpInvoker(supabase,user?.id,{localUrl:localReview?'/api/pvp-local-review':null}),user?.id,()=>crypto.randomUUID(),pvpPending(window.sessionStorage,user?.id)),[user?.id]);
 useEffect(()=>{generation.current++;lock.current=false;setBusy(false);const requested=new URLSearchParams(window.location.search).get('roomId')||'';const initial=/^[a-f0-9-]{36}$/i.test(requested)?requested:'';roomRef.current=initial;setSnapshot(null);setRoomId(initial);setError('');},[user?.id]);
 const apply=(s,switchRoom=false)=>{if(s?.roomId&&s.viewerId===user?.id&&(!roomRef.current||roomRef.current===s.roomId||switchRoom)){roomRef.current=s.roomId;setRoomId(s.roomId);window.history.replaceState(null,'',window.location.pathname+'?roomId='+encodeURIComponent(s.roomId));setSnapshot(current=>acceptPvpSnapshot(current,s,{roomId:s.roomId,viewerId:user.id}));}};
 async function mutate(payload,retry=false){if(lock.current)return;if(payload?.op==='create')generation.current++;const epoch=generation.current;lock.current=true;setBusy(true);setError('');try{const result=retry?await api.retry():await api.mutate(payload);if(epoch===generation.current)apply(result.snapshot,result.receipt.operation==='create');}catch(e){if(epoch===generation.current){setError(e.message);if(api.isKnownRejected())api.discardKnownRejected();}}finally{if(epoch===generation.current){lock.current=false;setBusy(false);}}}
 useEffect(()=>{
  if(!enabled||!roomId||!/^[a-f0-9-]{36}$/i.test(roomId))return undefined;let stopped=false;const epoch=generation.current;
  const poll=async()=>{try{const s=await api.snapshot(roomId);if(!stopped&&epoch===generation.current)apply(s);}catch(e){if(!stopped&&epoch===generation.current)setError(e.message);}};
  poll();const timer=setInterval(poll,1000);return()=>{stopped=true;clearInterval(timer);};
 },[api,roomId]);
 if(!enabled)return <main data-pvp-room className="p-6"><h1>Private PvP rooms</h1><p>Authenticated game service rollout is not enabled in this build. No game or financial operation was requested.</p></main>;
 const revision=snapshot?.revision,readOnly=user?.role==='tester',capacity=pendingPvpGames.find(g=>g.id===game)?.seats,adjustable=/^(poker|omaha)(8|9)$/.test(game);
 return <main data-pvp-room className="mx-auto w-full min-w-0 max-w-6xl bg-slate-950 p-4 pb-28 text-white"><h1>Online private practice games</h1><p>Invite other registered players. Practice only: no paid entry, wallet transfers, purchases or prizes. All required playing seats must be filled before play.</p><p>Your account ID: <code>{user?.id}</code></p><div data-pvp-room-tools>
  <label>Game<select aria-label="Game" value={game} onChange={e=>{setGame(e.target.value);setPlayerCount(null);}}>{pendingPvpGames.map(g=><option key={g.id} value={g.id}>{g.name} · {g.seats} players</option>)}</select></label>
  {adjustable&&<label>Players<select aria-label="Players" value={playerCount??capacity} onChange={e=>setPlayerCount(Number(e.target.value))}><option value={capacity}>{capacity} players</option><option value={7}>7 players on this {capacity}-seat table</option></select></label>}
  <button disabled={busy||api.hasPending()||readOnly} onClick={()=>mutate({op:'create',game,...(adjustable?{players:playerCount??capacity}:{})})}>Create private room</button>
  <label>Room ID<input aria-label="Room ID" disabled={busy||api.hasPending()} value={roomId} onChange={e=>{generation.current++;roomRef.current=e.target.value;setSnapshot(null);setRoomId(e.target.value);}}/></label>
  {snapshot&&<><h2>{snapshot.view.title}</h2><p data-testid="room-revision">Revision {revision} · seat {snapshot.view.seat}{snapshot.view.playerCount<snapshot.view.tableSeats?` · ${snapshot.view.playerCount} players on a ${snapshot.view.tableSeats}-seat table`:null}</p></>}
  {snapshot?.view.owner&&<div><label>Invited account ID<input aria-label="Invited account ID" value={invite} onChange={e=>setInvite(e.target.value)}/></label><button disabled={busy||api.hasPending()||readOnly} onClick={()=>mutate({op:'invite',roomId,expectedVersion:revision,targetId:invite})}>Invite account</button></div>}
  {snapshot&&snapshot.view.seat<0&&snapshot.view.seats.map((s,i)=><button key={i} disabled={busy||api.hasPending()||readOnly||s.occupied||s.inactive} onClick={()=>mutate({op:'join',roomId,expectedVersion:revision,seat:i})}>{s.inactive?`Seat ${i+1} unused`:`Take seat ${i+1}`}</button>)}
  {api.hasPending()&&<button disabled={busy} onClick={()=>mutate(null,true)}>Retry original request</button>}
  {api.pendingProblem()&&<p role="alert">{api.pendingProblem()}</p>}{error&&<p role="alert">{error}</p>}</div>
  {snapshot&&<AuthenticatedPvpRuntime key={snapshot.roomId+user.id} snapshot={snapshot} viewerId={user.id} busy={busy||api.hasPending()||readOnly||snapshot.view.seats.some(s=>!s.occupied&&!s.inactive)} onAction={action=>mutate({op:'action',roomId,expectedVersion:revision,action})}/>}
 </main>;
}
