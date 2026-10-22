import React from 'react';
import { Link } from 'react-router-dom';
import ProgramUnavailable from '@/components/casino/ProgramUnavailable';

export default function ReferralsPage() {
  return (
    <div className="min-h-screen bg-[#0A0612] px-4 py-12">
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="text-4xl font-black text-white">Referrals</h1>
        <ProgramUnavailable title="Referral program">
          Referral codes, signup bonuses and purchase commissions are not active. Reward amounts and eligibility will be shown here when the program opens.
        </ProgramUnavailable>
        <div className="flex flex-wrap gap-4">
          <Link className="rounded-lg bg-pink-600 px-5 py-3 font-bold text-white" to="/Games">Browse practice games</Link>
          <Link className="rounded-lg border border-white/20 px-5 py-3 text-white" to="/Support">Contact support</Link>
        </div>
      </div>
    </div>
  );
}
