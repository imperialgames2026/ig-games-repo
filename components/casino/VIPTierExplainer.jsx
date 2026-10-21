import React from 'react';
import { Crown } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {useVipCatalog} from '@/hooks/useVipCatalog';
import {VIP_STYLES} from '@/lib/vipCatalog';

export default function VIPTierExplainer() {
  const catalog=useVipCatalog();
  if(catalog.error)return <p role="alert" className="text-slate-300">VIP tiers unavailable. <button className="underline" onClick={()=>void catalog.refetch()}>Retry VIP tiers</button></p>;
  if(!catalog.data)return <p className="text-slate-300">Loading VIP tiers…</p>;
  const levels=catalog.data.levels;
  const tierRanges=[...new Set(levels.map(row=>row.tier))].map(tier=>{
    const rows=levels.filter(row=>row.tier===tier);
    return {tier,icon:VIP_STYLES[tier].icon,levels:rows.length===1?rows[0].name:rows[0].name+' – '+rows.at(-1).name};
  });
  return (
    <div className="rounded-2xl bg-gradient-to-br from-[#1A1528] to-[#0F0A1E] border border-white/10 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-pink-500/15 flex items-center justify-center">
          <Crown className="w-5 h-5 text-pink-400" />
        </div>
        <div>
          <h3 className="text-xl font-black text-white">VIP Tiers & Levels</h3>
          <p className="text-sm text-gray-400">Open each tier to see the level range and XP milestones.</p>
        </div>
      </div>

      <Accordion type="single" collapsible className="space-y-3">
        {tierRanges.map((tier) => {
          const tierLevels = levels.filter((level) => level.tier === tier.tier);
          return (
            <AccordionItem key={tier.tier} value={tier.tier} className="border border-white/10 rounded-xl bg-white/5 px-4">
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-3 text-left">
                  <span className="text-2xl">{tier.icon}</span>
                  <div>
                    <p className="text-white font-bold">{tier.tier}</p>
                    <p className="text-xs text-gray-400">{tier.levels}</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <div className="grid gap-2">
                  {tierLevels.map((level) => (
                    <div key={level.level} className="flex items-center justify-between rounded-lg bg-black/20 border border-white/5 px-3 py-2">
                      <span className="text-sm text-white font-semibold">{level.name}</span>
                      <span className="text-xs text-pink-300">{level.xp_required.toLocaleString()} XP</span>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}