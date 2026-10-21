import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function PracticePolicy({ title, icon: Icon, children }) {
  return <main className="min-h-screen bg-[#0A0612] px-4 py-12 text-white">
    <div className="mx-auto max-w-4xl">
      <Link to="/" className="mb-7 inline-flex min-h-11 items-center gap-2 text-sm text-pink-300 hover:text-white"><ArrowLeft className="h-4 w-4"/>Back to Imperial Games</Link>
      <article className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#1A1528] to-[#0F0A1E] p-6 sm:p-9">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">Tester-chip preview</p>
        <div className="mt-4 flex items-center gap-3"><Icon className="h-8 w-8 shrink-0 text-pink-300" aria-hidden="true"/><h1 className="text-3xl font-black">{title}</h1></div>
        <div className="mt-7 space-y-6 text-sm leading-7 text-gray-300 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-white [&_a]:text-pink-300 [&_a]:underline [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">{children}</div>
      </article>
    </div>
  </main>;
}
