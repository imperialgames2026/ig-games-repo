import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { ShieldCheck, UserRound, AlertTriangle } from 'lucide-react';

const KNOWN = new Set(['not_started','pending','pending_review','approved','rejected','verified','unverified','requires_action','in_review']);
export default function VerifiedKYCStatus() {
  const { user } = useAuth();
  const raw = typeof user?.kyc_status === 'string' ? user.kyc_status.toLowerCase() : 'not_started';
  const status = KNOWN.has(raw) ? raw : 'unavailable';
  return <main className="bg-[#0A0612] text-white min-h-screen py-12 px-4">
    <div className="max-w-2xl mx-auto">
      <Link className="text-amber-300 hover:underline text-sm" to="/Profile">← Back to profile</Link>
      <h1 className="text-3xl sm:text-4xl font-black mt-6">Identity Verification</h1>
      <p className="text-gray-400 mt-3">Supabase-sourced status for the signed-in account.</p>
      <div className="border border-white/10 bg-[#18162b] rounded-3xl p-7 mt-8">
        <div className="flex gap-3 items-center"><ShieldCheck className="text-amber-300"/><h2 className="text-xl font-bold">Current status</h2></div>
        <p className="mt-5 text-2xl text-amber-200 font-bold capitalize">{status.replaceAll('_',' ')}</p>
        <p className="text-sm text-gray-400 mt-3">Status comes from the verified profile, not from a self-declared identity document.</p>
      </div>
      <div role="status" className="border border-amber-500/30 bg-amber-500/5 text-amber-100 rounded-2xl p-5 mt-6">
        <h3 className="flex gap-2 font-bold items-center"><AlertTriangle size={18}/> Uploads are not active</h3>
        <p className="text-sm mt-2">Do not upload passports, IDs, selfies or phone verification codes to the old Base44 form. A separately reviewed provider-backed verification flow must be enabled before submissions can be accepted.</p>
      </div>
      <Link to="/Support" className="block text-amber-300 mt-6 underline">Contact support about your verification status</Link>
    </div>
  </main>;
}
