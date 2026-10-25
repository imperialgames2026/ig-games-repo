import {acceptTableFairness} from '@/lib/tableFairness';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';

// Crash and Trenball are different betting layouts on exactly ONE shared crash room.
export function useSharedEventPractice(game) {
  const { user, isAuthenticated } = useAuth();
  const [table,setTable] = useState(null);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const live = useRef(true);
  const generation = useRef(0);
  const state = useRef(null);
  const pending = useRef(null);

  const receive = useCallback(async (next,epoch) => {
    if (!live.current || epoch!==generation.current || !next || next.game!==game) return;
    if(game==='baccarat')next = await acceptTableFairness(next,game);
    if(!live.current||epoch!==generation.current)return;
    if (!state.current || Number(next.revision)>=Number(state.current.revision)) {
      const receivedAt = Date.now();
      const serverTime = Date.parse(next.serverTime);
      state.current = {...next, clockOffsetMs:Number.isFinite(serverTime)?receivedAt-serverTime:0};
      setTable(state.current);
    }
  },[game]);
  const invoke = useCallback(async (action, values={}) => {
    const epoch=generation.current;
    const {data,error:networkError}=await supabase.functions.invoke('ig-shared-event-practice',{
      body:{game,action,...values},
    });
    if(networkError)throw new Error('Table is unreachable. Refresh and review pending bets.');
    if(!data || data.error)throw new Error(data?.error || 'Invalid game response');
    if(epoch===generation.current)await receive(data.state,epoch);
    return data;
  },[game,receive]);

  const refresh = useCallback(async (quiet=false) => {
    if(!isAuthenticated) {
      if(live.current){setTable(null);setLoading(false);}
      return;
    }
    try{await invoke('state');if(!quiet && live.current)setError('');}
    catch(e){if(live.current&&(!quiet||e.name==='FairnessError'))setError(e.message);if(e.name==='FairnessError'&&live.current)setTable(null);}
    finally{if(live.current)setLoading(false);}
  },[invoke,isAuthenticated]);

  useEffect(()=>{
    live.current=true;generation.current++;state.current=null;setLoading(true);setTable(null);
    void refresh();
    const poll=window.setInterval(()=>{void refresh(true);},3000);
    const keepalive=window.setInterval(()=>{
      if(state.current?.joined)void invoke('join').catch(()=>{});
    },25000);
    return ()=>{live.current=false;generation.current++;clearInterval(poll);clearInterval(keepalive);};
  },[game,refresh,invoke]);

  const execute = useCallback(async (action,values={})=>{
    if(busy || !isAuthenticated)return false;
    setBusy(true);setError('');
    try {
      // Reuse the same idempotency key after an uncertain network result, unless caller
      // intentionally starts a different action by changing the value/target.
      const hasId = action==='bet'||action==='resolve';
      const fingerprint = hasId ? JSON.stringify({action,values}) : null;
      const id=hasId && pending.current?.fingerprint===fingerprint ?
        pending.current.id : crypto.randomUUID();
      if(hasId)pending.current={fingerprint,id};
      await invoke(action,hasId?{...values,requestId:id}:values);
      pending.current=null;
      return true;
    } catch(e) {
      if(live.current)setError(e.message);
      return false;
    } finally{if(live.current)setBusy(false);}
  },[busy,isAuthenticated,invoke]);

  return {
    user,table,loading,busy,error,isAuthenticated,refresh,
    join:()=>execute('join'),leave:()=>execute('leave'),claim:()=>execute('claim'),
    bet:(target,units)=>execute('bet',{target,units}),
    resolve:()=>state.current?execute('resolve',{expectedRound:state.current.round}):Promise.resolve(false),
  };
}
