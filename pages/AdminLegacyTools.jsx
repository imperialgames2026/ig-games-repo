import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

const modules = [
  { title: 'VIP levels', description: 'Published XP thresholds through level 34.', to: '/AdminVIP' },
  { title: 'Reward wheels', description: 'Section rewards, amounts, weights and publication controls.', to: '/AdminRewardWheels' },
  { title: 'Withdrawals and wallets', description: 'Review recorded requests. Payout execution remains unavailable.', to: '/AdminWallets' },
  { title: 'Poker events', description: 'Current tournament configuration and event tools.', to: '/SuperadminPokerTournaments', superadmin: true },
  { title: 'Sweepstakes requests', description: 'Review intake and audit history. Intake does not fulfill a prize.', to: '/AdminSweepstakesAudit' },
  { title: 'Announcements', description: 'Draft, publish, expire and archive announcements.', to: '/AdminAnnouncements' },
  { title: 'Support', description: 'Read tickets and reply through the authorized support service.', to: '/AdminSupport' },
];
const heldModules = [
  'Legacy game catalog editing and activation',
  'Token pack sales and purchase bonuses',
  'Manual crash round generation',
  'Voucher issuance and redemption',
  'Legacy poker tables, rake settings and tournament managers',
  'Blackjack table configuration',
  'Weekly wager tournaments',
  'Slot drop and original-game win/loss overrides',
];

export default function AdminLegacyTools() {
  const { user } = useAuth();
  return (
    <div className="space-y-7 text-white">
      <header>
        <h1 className="text-3xl font-bold">Operator tool directory</h1>
        <p className="mt-3 max-w-3xl text-slate-300">Use the current modules below. The previous operator forms are retired because their actions are unavailable in this release.</p>
      </header>
      <section aria-labelledby="current-operator-tools" className="space-y-4">
        <h2 id="current-operator-tools" className="text-xl font-bold">Current modules</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {modules.filter(module => !module.superadmin || user?.role === 'superadmin').map(module => (
            <Link key={module.to} to={module.to} className="rounded-2xl border border-white/15 bg-[#151822] p-5 transition hover:border-amber-300/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300">
              <h3 className="font-bold text-amber-200">{module.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">{module.description}</p>
            </Link>
          ))}
        </div>
      </section>
      <section aria-labelledby="unavailable-operator-tools" className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-6">
        <h2 id="unavailable-operator-tools" className="text-xl font-bold">Unavailable legacy tools</h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">These programs remain in the migration backlog. This directory cannot change game availability, grant rewards or execute payments.</p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-300">
          {heldModules.map(title => <li key={title}>{title}</li>)}
        </ul>
      </section>
    </div>
  );
}
