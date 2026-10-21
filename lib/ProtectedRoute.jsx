import React from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import SiteLoading from '@/components/SiteLoading';

export default function ProtectedRoute({ children, roles }) {
  const { user, isAuthenticated, isLoadingAuth, authError, checkAppState } = useAuth();
  const location = useLocation();

  if (isLoadingAuth) {
    return <SiteLoading label="Checking sign-in" fullScreen />;
  }

  if (authError) return <main className="flex min-h-screen items-center justify-center bg-[#0A0612] p-5 text-white">
    <section role="alert" className="w-full max-w-lg rounded-3xl border border-white/15 bg-[#1A1528] p-7 sm:p-10">
      <img src="/imperial-gaming.png" alt="Imperial Games" width="56" height="56" className="rounded-full" />
      <h1 className="mt-6 text-2xl font-black">We couldn’t verify your account</h1>
      <p className="mt-3 leading-7 text-gray-300">Check your connection and try again. Your account needs to be verified before this page can open.</p>
      <button type="button" onClick={() => void checkAppState()} className="mt-6 min-h-11 rounded-xl bg-pink-600 px-5 py-3 font-bold hover:bg-pink-500">Retry account verification</button>
      <Link to="/Games" className="mt-4 block text-sm text-amber-200 underline underline-offset-4">Browse the game library</Link>
    </section>
  </main>;

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (user.is_excluded && location.pathname !== '/Support' && location.pathname !== '/ResponsiblePlay') {
    return <main className="flex min-h-[70vh] items-center justify-center bg-[#0A0612] p-5 text-white"><section role="alert" className="max-w-lg rounded-3xl border border-amber-300/25 bg-[#1A1528] p-8"><h1 className="text-2xl font-black">Your play break is active</h1><p className="mt-3 leading-7 text-gray-300">Your account is excluded from play. You can still contact support and read the responsible play information.</p><div className="mt-6 flex flex-wrap gap-4"><Link to="/Support" className="rounded-xl bg-pink-600 px-5 py-3 font-bold hover:bg-pink-500">Contact support</Link><Link to="/ResponsiblePlay" className="rounded-xl border border-white/20 px-5 py-3 font-bold hover:bg-white/5">Responsible play</Link></div></section></main>;
  }

  if (roles?.length && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
