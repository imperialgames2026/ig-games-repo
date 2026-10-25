import React from 'react';
import {Link} from 'react-router-dom';
import ProgramUnavailable from './ProgramUnavailable';

export default function PracticeFinancialUnavailable(){
  return <main className="min-h-[70vh] bg-[#0a0612] px-5 py-12 text-white">
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-3xl font-black">Financial services are disabled</h1>
      <ProgramUnavailable title="Practice chips only">
        <p>Deposits, withdrawals and redemption are unavailable. Practice chips
          cannot be purchased or redeemed and have no cash value.</p>
        <p className="mt-3">No payment preparation, funding address or prize
          claim is created from this screen.</p>
      </ProgramUnavailable>
      <Link to="/Games" className="inline-block rounded-xl bg-amber-300 px-5 py-3 font-bold text-slate-950">Back to practice games</Link>
    </div>
  </main>;
}
