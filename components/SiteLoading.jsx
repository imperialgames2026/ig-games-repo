import React from 'react';

export default function SiteLoading({ label = 'Loading page', fullScreen = false }) {
  return <div role="status" aria-label={label} className={
    'flex flex-col items-center justify-center gap-4 bg-[#0A0612] px-6 py-16 text-center text-gray-300 ' +
    (fullScreen ? 'fixed inset-0 z-50' : 'min-h-[40vh]')
  }>
    <img src="/imperial-gaming.png" alt="" width="56" height="56" className="rounded-full" />
    <span aria-hidden="true" className="h-6 w-6 animate-spin rounded-full border-2 border-white/15 border-t-amber-300 motion-reduce:animate-none" />
    <p className="text-sm">{label}…</p>
  </div>;
}
