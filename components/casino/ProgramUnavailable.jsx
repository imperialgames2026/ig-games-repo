import React, { useId } from 'react';
import { Clock3 } from 'lucide-react';

export default function ProgramUnavailable({ title, children, compact = false }) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className={`rounded-2xl border border-amber-300/20 bg-[#191522] text-white ${compact ? 'p-3' : 'p-6'}`}>
      <div className="flex items-center gap-3">
        <Clock3 aria-hidden="true" className="shrink-0 text-amber-300" size={20} />
        <h2 id={titleId} className="text-lg font-bold">{title}</h2>
      </div>
      <p className="mt-3 text-sm font-semibold text-amber-200">Not available in the current practice release</p>
      <div className="mt-2 text-sm leading-6 text-slate-300">{children}</div>
    </section>
  );
}
