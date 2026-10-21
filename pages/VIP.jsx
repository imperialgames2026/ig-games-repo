import React from 'react';
import {useQuery} from '@tanstack/react-query';
import {useAuth} from '@/lib/AuthContext';
import {vipCatalog} from '@/hooks/useVipCatalog';
import VIPProgressCard from '@/components/casino/VIPProgressCard';
import VIPTierExplainer from '@/components/casino/VIPTierExplainer';
import VIPRewardWheel from '@/components/casino/VIPRewardWheel';
import VIPLevelUpToast from '@/components/casino/VIPLevelUpToast';
export default function VIP(){
 const {user}=useAuth();
 const wallet=useQuery({queryKey:['vip-wallet',user?.id],queryFn:()=>vipCatalog.wallet(user.id),enabled:!!user?.id,refetchInterval:30000,retry:1});
 return <main className="mx-auto max-w-5xl space-y-6 px-4 py-10 text-white">
  <header><h1 className="text-4xl font-black">VIP Club</h1><p className="mt-3 text-slate-400">Your rank, XP progress, and all 34 VIP levels.</p></header>
  {wallet.error?<div role="alert" className="rounded-xl border border-red-300/30 p-4">Your XP could not be loaded. <button className="underline" onClick={()=>void wallet.refetch()}>Retry XP</button></div>:<VIPProgressCard wallet={wallet.data}/>}
  <VIPLevelUpToast wallet={wallet.data}/>
  <VIPRewardWheel/>
  <VIPTierExplainer/>
 </main>;
}
