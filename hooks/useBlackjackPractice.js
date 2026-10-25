import {acceptTableFairness} from '@/lib/tableFairness';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import {createPracticeActionQueue} from '@/lib/practiceActionQueue';

export function useBlackjackPractice() {
  const {user,isAuthenticated}=useAuth();
  const [state,setState]=useState(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const connected=useRef(true),generation=useRef(0);
  const latest=useRef(null);
  const [pendingAction,setPendingAction]=useState(null);
  const dispatchLock=useRef(false),queueRef=useRef(null);
  const getQueue=useCallback(()=>{
    const key=`ig.practice.pending.v1:blackjack:${user?.id}`;
    if(queueRef.current?.key!==key)queueRef.current={key,queue:createPracticeActionQueue({storage:window.sessionStorage,key,makeId:()=>crypto.randomUUID()})};
    return queueRef.current.queue;
  },[user?.id]);
  useEffect(()=>{
    if(!isAuthenticated){setPendingAction(null);return;}
    try{setPendingAction(getQueue().peek());}catch(e){setError(e.message);}
  },[getQueue,isAuthenticated]);

  const invoke=useCallback(async(action,params={})=>{
    const epoch=generation.current;
    const {data,error:networkError}=await supabase.functions.invoke('ig-blackjack-practice',{body:{action,...params}});
    if(networkError){const failure=new Error('Blackjack action could not be confirmed. Retry its original request.');failure.definitiveRejection=[400,401,403,404,409,422].includes(networkError.context?.status);throw failure;}
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
  },[user?.id,refresh,invoke]);
  const run=useCallback(async(action,params={},restored=null)=>{
    if(dispatchLock.current||!isAuthenticated||!user?.id)return false;
    dispatchLock.current=true;const epoch=generation.current;
    setBusy(true);setError('');let queue,request;
    try{
      queue=getQueue();
      if(restored)request=queue.prepare(restored.action,restored.params);
      else if(action==='bet')request=queue.prepare('blackjackBet',params);
      else if(['deal','hit','stand','resolve'].includes(action))request=queue.prepare('blackjack_'+action,params);
      else if(queue.peek())throw Error('Confirm the pending practice action before changing the table.');
      if(request)setPendingAction(request);
      const name=request?(request.action==='blackjackBet'?'bet':request.action.slice('blackjack_'.length)):action;
      const data=await invoke(name,request?{...request.params,requestId:request.requestId}:params);
      if(request){
        if(!data.state||data.state.game!=='blackjack')throw Error('Blackjack returned no verifiable table state. Retry its original request.');
        queue.confirm(request.requestId);
      }
      if(connected.current&&epoch===generation.current)setPendingAction(queue.peek());
      return true;
    }catch(e){
      if(request){try{queue.failed(request.requestId,{definitiveRejection:e.definitiveRejection===true});}catch{/* Preserve original receipt. */}}
      if(connected.current&&epoch===generation.current){if(queue)setPendingAction(queue.peek());setError(e.message);}return false;
    }finally{dispatchLock.current=false;if(connected.current&&epoch===generation.current)setBusy(false);}
  },[getQueue,isAuthenticated,invoke,user?.id]);
  const retryPending=()=>{try{const saved=getQueue().peek();return saved?run('',{},saved):Promise.resolve(false);}catch(e){setError(e.message);return Promise.resolve(false);}};
  return {user,isAuthenticated,state,loading,busy,error,refresh,pendingAction,retryPending,
    join:()=>run('join'),leave:()=>run('leave'),claim:()=>run('claim'),
    bet:(target,units)=>run('bet',{target,units}),
    action:(name)=>run(name,{expectedRound:latest.current?.round})};
}
