import React from 'react';
import { Link } from 'react-router-dom';
import { Coins } from 'lucide-react';

// Practice stacks belong to their server-owned tables. Do not derive a global
// chip balance from the unrelated historical IGN/IGD/IGT wallet records.
export default function PracticeChipBar() {
  return <aside aria-label="Tester chip mode" className="border-b border-amber-300/20 bg-[#211a16] px-4 py-2 text-amber-100">
    <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs">
      <span className="inline-flex items-center gap-2 font-semibold"><Coins className="h-4 w-4 text-amber-300" aria-hidden="true"/> Tester-chip preview <span className="hidden font-normal text-amber-100/70 sm:inline">· Fictional chips. No cash value.</span></span>
      <Link to="/TesterChips" className="rounded px-1 py-1 underline underline-offset-4 hover:text-white">How chips work</Link>
    </div>
  </aside>;
}
