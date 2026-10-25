import {acceptTableFairness} from '@/lib/tableFairness';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import {createPracticeActionQueue} from '@/lib/practiceActionQueue';

// Shared game state lives in Supabase, never in a browser-controlled wallet.
// Poll for table updates while present; all mutations are transactional server RPCs.
export function useMultiplayerPractice(game) {
  const { user, isAuthenticated } = useAuth();
  const [table, setTable] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pendingAction,setPendingAction]=useState(null);
  const alive = useRef(true);
  const generation = useRef(0);
  const latest = useRef(null);
  const actionLock=useRef(false),queueRef=useRef(null);
  const getQueue=useCallback(()=>{
    const key=`ig.practice.pending.v1:${game}:${user?.id}`;
    if(!queueRef.current||queueRef.current.key!==key){
      queueRef.current={key,queue:createPracticeActionQueue({storage:window.sessionStorage,key,makeId:()=>crypto.randomUUID()})};
    }
    return queueRef.current.queue;
  },[game,user?.id]);

  useEffect(()=>{
    if(!isAuthenticated){setPendingAction(null);return;}
    try{setPendingAction(getQueue().peek());}catch(e){setError(e.message);}
  },[getQueue,isAuthenticated]);

  const ingest = useCallback(async (fresh,epoch) => {
    if (!alive.current || epoch!==generation.current || !fresh || fresh.game !== game) return;
    fresh = await acceptTableFairness(fresh,game);
    if(!alive.current||epoch!==generation.current)return;
    if(latest.current&&Number(fresh.revision)===Number(latest.current.revision)&&Date.parse(fresh.serverTime)<Date.parse(latest.current.serverTime))return;
    // Prevent an out-of-order poll from overwriting a more recent action result.
    if (!latest.current || Number(fresh.revision) >= Number(latest.current.revision)) {
      // Relate server clock to the device, so its countdown cannot be cheated by changing local time.
      const receivedAt = Date.now();
      const serverTime = Date.parse(fresh.serverTime);
      const clockOffsetMs = Number.isFinite(serverTime) ? receivedAt - serverTime : 0;
      latest.current = { ...fresh, clockOffsetMs };
      setTable(latest.current);
    }
  }, [game]);

  const invoke = useCallback(async (action, args = {}) => {
    const epoch=generation.current;
    const { data, error: networkError } = await supabase.functions.invoke('ig-multiplayer-practice', {
      body: { game, action, ...args },
    });
    if (networkError) {
      const failure=new Error('Practice action could not be confirmed. Refresh and retry its original request.');
      failure.definitiveRejection=[400,401,403,404,409,422].includes(networkError.context?.status);
      throw failure;
    }
    if (!data || data.error) throw new Error(data?.error || 'Practice table returned an invalid response');
    if(epoch===generation.current)await ingest(data.state,epoch);
    return data;
  }, [game, ingest]);

  const refresh = useCallback(async (quiet = false) => {
    if (!isAuthenticated) {
      if (alive.current) { setLoading(false); setTable(null); }
      return;
    }
    try {
      await invoke('state');
      if (!quiet && alive.current) setError('');
    } catch (e) {
      if (alive.current && (!quiet || e.name==='FairnessError')) setError(e.message);
      if(e.name==='FairnessError' && alive.current)setTable(null);
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [invoke, isAuthenticated]);

  useEffect(() => {
    alive.current = true;generation.current++;
    latest.current = null;
    setTable(null);
    setLoading(true);
    setBusy(false);
    void refresh();
    const polling = window.setInterval(() => { void refresh(true); }, 3000);
    const heartbeat = window.setInterval(() => {
      if (latest.current?.joined && !busy) {
        void invoke('join').catch(() => {}); // Keep an actively watching shooter's seat fresh.
      }
    }, 25000);
    return () => {
      alive.current = false;generation.current++;
      window.clearInterval(polling);
      window.clearInterval(heartbeat);
    };
  }, [game, user?.id, refresh, invoke]); // Table is retained server-side across refreshes.

  const action = useCallback(async (name, args = {}) => {
    if (actionLock.current || !isAuthenticated || !user?.id) return false;
    const epoch=generation.current;
    actionLock.current=true;
    setBusy(true);
    setError('');
    let queue,request;
    try {
      queue=getQueue();
      if(['bet','roll','refill'].includes(name)){
        request=queue.prepare(name,args);setPendingAction(request);
      }else if(queue.peek())throw Error('Confirm the pending practice action before changing the table.');
      const response=await invoke(name,request?{...request.params,requestId:request.requestId}:args);
      if(request&&(!response.state||response.state.game!==game))throw Error('Practice action returned no verifiable table state. Retry its original request.');
      if(request)queue.confirm(request.requestId);
      if(alive.current&&epoch===generation.current)setPendingAction(queue.peek());
      return true;
    } catch (e) {
      if(request){
        try{queue.failed(request.requestId,{definitiveRejection:e.definitiveRejection===true});}catch{ /* Keep the original receipt in memory if storage is unavailable. */ }
      }
      if(queue&&alive.current&&epoch===generation.current)setPendingAction(queue.peek());
      if (alive.current&&epoch===generation.current) setError(e.message);
      return false;
    } finally {
      actionLock.current=false;
      if (alive.current&&epoch===generation.current) setBusy(false);
    }
  }, [game, getQueue, isAuthenticated, invoke, user?.id]);

  // Clock broadcasts are untrusted invalidation hints, never game outcomes.
  // Authenticated snapshots remain authoritative; polling recovers dropped events.
  useEffect(()=>{
    if(game!=='roulette'||!isAuthenticated)return;
    let lastSignal=0;
    const channel=supabase.channel('ig-practice-roulette-clock').on('broadcast',{event:'roulette-clock'},()=>{const now=Date.now();if(now-lastSignal<800)return;lastSignal=now;void refresh(true);}).subscribe();
    return()=>{void supabase.removeChannel(channel);};
  },[game,isAuthenticated,refresh]);

  const placeBet = useCallback((target, units) => action('bet', {
    target, units,
  }), [action]);
  const runRound = useCallback(() => {
    if (!table||game!=='craps') return Promise.resolve(false);
    return action('roll', {
      expectedRound: table.round,
    });
  }, [action, game, table]);

  return {
    table, loading, busy, error, user, isAuthenticated,pendingAction,
    retryPending:()=>{try{const saved=getQueue().peek();return saved?action(saved.action,saved.params):Promise.resolve(false);}catch(e){setError(e.message);return Promise.resolve(false);}},
    refresh, join: (mode) => action('join', mode && game==='craps' ? {mode} : {}),
    refill: () => action('refill'),
    leave: () => action('leave'),
    claim: () => action('claim'), placeBet, runRound,
  };
}
