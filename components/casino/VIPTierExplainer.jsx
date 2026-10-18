import React from 'react';
import { ChevronDown, Crown } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { VIP_LEVELS } from './VIPHelper';

const tierRanges = [
  { tier: 'Beginner', levels: 'Beginner', min: 1, max: 1, icon: '△', subtitle: 'Starting point for every player.' },
  { tier: 'Bronze', levels: 'Bronze I - Bronze IV', min: 2, max: 5, icon: '◇', subtitle: 'All bonuses unlocked and boosted.' },
  { tier: 'Silver', levels: 'Silver I - Silver IV', min: 6, max: 9, icon: '⬡', subtitle: 'Enhanced Level Up, Weekly & Monthly Bonus.' },
  { tier: 'Gold', levels: 'Gold I - Gold IV', min: 10, max: 13, icon: '⬢', subtitle: 'Superior Level Up, Weekly & Monthly Bonus.' },
  { tier: 'Platinum', levels: 'Platinum I - Platinum IV', min: 14, max: 17, icon: '▣', subtitle: 'Premium Level Up, Weekly & Monthly Bonus.' },
  { tier: 'Diamond', levels: 'Diamond I - Diamond VII', min: 18, max: 24, icon: '◈', subtitle: 'Elite Level Up, Weekly & Monthly Bonus.' },
  { tier: 'Eternal', levels: 'Eternal I - Eternal X', min: 25, max: 34, icon: '✧', subtitle: 'Maximum Level Up, Weekly & Monthly Bonus.' },
];

export default function VIPTierExplainer() {
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
          const tierLevels = VIP_LEVELS.filter((level) => level.level >= tier.min && level.level <= tier.max);
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
                <div className="mb-3 text-sm text-gray-300">{tier.subtitle}</div>
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