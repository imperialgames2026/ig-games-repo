import React from 'react';
import { Ban } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function ExclusionBanner() {
  return (
    <div className="min-h-screen bg-[#0A0612] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 rounded-full bg-red-500/20 border-2 border-red-500/40 flex items-center justify-center mx-auto mb-6">
          <Ban className="w-10 h-10 text-red-400" />
        </div>
        <h1 className="text-3xl font-black text-white mb-3">Account Excluded</h1>
        <p className="text-gray-400 mb-6">
          Your account has been placed under <strong className="text-red-400">exclusion</strong>. 
          You are not able to play games or make purchases at this time.
        </p>
        <p className="text-gray-400 mb-8">
          You may still access your account to <strong className="text-green-400">withdraw your balance</strong>.
        </p>
        <Link
          to={createPageUrl('Withdraw')}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold transition-colors"
        >
          Go to Withdraw
        </Link>
        <p className="mt-6 text-sm text-gray-500">
          If you believe this is an error, contact{' '}
          <a href="mailto:support@imperialhouse.online" className="text-pink-400 hover:text-pink-300">
            support@imperialhouse.online
          </a>
        </p>
      </div>
    </div>
  );
}