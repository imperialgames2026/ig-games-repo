import {acceptTableFairness} from '@/lib/tableFairness';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabaseClient';

export function useBlackjackPractice() {
  const {user,isAuthenticated}=useAuth();
  const [state,setState]=useState(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const connected=useRef(true),generation=useRef(0);
  const latest=useRef(null);
  const pending=useRef(null);

  const invoke=useCallback(async(action,params={})=>{
    const epoch=generation.current;
    const {data,error:networkError}=await supabase.functions.invoke('ig-blackjack-practice',{body:{action,...params}});
    if(networkError)throw new Error('Blackjack server unreachable. Refresh to verify the action.');
    if(data?.error||!data)throw new Error(data?.error||'Blackjack service returned invalid response.');
    if(data.state && connected.current && epoch===generation.current){
      const checked=await acceptTableFairness(data.state,'blackjack');
      if(!connected.current||epoch!==generation.current)return data;
      const clientNow=Date.now();
      const serverNow=Date.parse(data.state.serverTime);
      const next={...checked,clockOffsetMs:Number.isFinite(serverNow)?clientNow-serverNow:0};
      if(!latest.current||Number(next.revision)>=Number(latest.current.revision)){
        latest.current=next;setState(next);
      }
    }
    return data;
  },[]);
  const refresh=useCallback(async(quiet=false)=>{
    if(!isAuthenticated){setLoading(false);setState(null);return;}
    try{await invoke(latest.current?.joined?'tick':'state');if(!quiet&&connected.current)setError('');}
    catch(e){if(connected.current&&(!quiet||e.name==='FairnessError'))setError(e.message);if(e.name==='FairnessError'&&connected.current)setState(null);}
    finally{if(connected.current)setLoading(false);}
  },[invoke,isAuthenticated]);
  useEffect(()=>{
    connected.current=true;generation.current++;latest.current=null;setState(null);
    void refresh();
    const poll=setInterval(()=>{void refresh(true);},2500);
    const heartbeat=setInterval(()=>{if(latest.current?.joined)void invoke('join').catch(()=>{});},25000);
    return ()=>{connected.current=false;generation.current++;clearInterval(poll);clearInterval(heartbeat);};
  },[refresh,invoke]);
  const run=useCallback(async(action,params={})=>{
    if(busy||!isAuthenticated)return false;
    setBusy(true);setError('');
    try{
      const keyed=['bet','deal','hit','stand','resolve'].includes(action);
      const fingerprint=keyed?JSON.stringify({action,params}):null;
      const id=keyed&&pending.current?.fingerprint===fingerprint?pending.current.id:crypto.randomUUID();
      if(keyed)pending.current={fingerprint,id};
      await invoke(action,keyed?{...params,requestId:id}:params);
      pending.current=null;return true;
    }catch(e){if(connected.current)setError(e.message);return false;}
    finally{if(connected.current)setBusy(false);}
  },[busy,invoke,isAuthenticated]);
  return {user,isAuthenticated,state,loading,busy,error,refresh,
    join:()=>run('join'),leave:()=>run('leave'),claim:()=>run('claim'),
    bet:(target,units)=>run('bet',{target,units}),
    action:(name)=>run(name,{expectedRound:latest.current?.round})};
}
