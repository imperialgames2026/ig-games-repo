import React from 'react';
import { Link } from 'react-router-dom';
import { Crown, Info, Sparkles } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';
import {useVipStatus} from '@/hooks/useVipCatalog';

export default function VIPProgressCard({ wallet }) {
  const {catalog,progress}=useVipStatus(wallet);
  if(catalog.error)return <div role="alert" className="rounded-xl border border-red-300/30 p-5 text-slate-200">VIP schedule unavailable. <button className="underline" onClick={()=>void catalog.refetch()}>Retry VIP schedule</button></div>;
  if(!progress)return <p className="rounded-xl border border-white/10 p-5 text-slate-300">{catalog.isPending||!wallet?'Loading VIP progress…':'VIP progress unavailable.'}</p>;
  const {xp:currentXP,current:vipLevel,next:nextLevel,percent:progressPercent,remaining:xpRemaining}=progress;

  return (
    <div className="rounded-2xl bg-gradient-to-br from-[#1A1528] to-[#0F0A1E] border border-white/10 p-6">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Crown className="w-5 h-5 text-pink-400" />
            <span className="text-sm text-pink-300 font-semibold">VIP Status</span>
          </div>
          <h3 className="text-2xl font-black text-white">{vipLevel.icon} {vipLevel.name}</h3>
          <p className="text-sm text-gray-400 mt-1">{vipLevel.tier} Tier</p>
        </div>
        <Link to={createPageUrl('VIP')}>
          <Button variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10">
            <Info className="w-4 h-4 mr-2" />
            View VIP
          </Button>
        </Link>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">Progress to next level</span>
          <span className="text-white font-bold">{progressPercent}%</span>
        </div>
        <Progress value={progressPercent} className="h-3" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <div className="rounded-xl bg-white/5 border border-white/10 p-4">
            <p className="text-xs text-gray-400 mb-1">Current XP</p>
            <p className="text-xl font-black text-white">{currentXP.toLocaleString()}</p>
          </div>
          <div className="rounded-xl bg-white/5 border border-white/10 p-4">
            <p className="text-xs text-gray-400 mb-1">Next level</p>
            <p className="text-xl font-black text-pink-400">{nextLevel ? xpRemaining.toLocaleString() + ' XP' : 'Maxed'}</p>
          </div>
        </div>

        {nextLevel ? (
          <div className="flex items-center gap-2 text-xs text-gray-400 pt-1">
            <Sparkles className="w-3.5 h-3.5 text-pink-400" />
            {xpRemaining.toLocaleString()} XP until {nextLevel.name}
          </div>
        ) : (
          <div className="text-xs text-pink-400 font-bold pt-1">You reached the top VIP rank.</div>
        )}
      </div>
    </div>
  );
}