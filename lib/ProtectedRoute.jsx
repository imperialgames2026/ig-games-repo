import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

export default function ProtectedRoute({ children, roles }) {
  const { user, isAuthenticated, isLoadingAuth, authError, checkAppState } = useAuth();
  const location = useLocation();

  if (isLoadingAuth) {
    return <div className="fixed inset-0 flex items-center justify-center" role="status" aria-label="Checking sign-in"><div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-800" /></div>;
  }

  if (authError) return <main role="alert" className="p-8">{authError.message} <button onClick={checkAppState}>Retry account verification</button></main>;

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (user.is_excluded && location.pathname !== '/Support' && location.pathname !== '/ResponsiblePlay' && location.pathname !== '/SmsConsent') {
    return <main role="alert" className="p-8">Your account is excluded. <a href="/Support">Contact support</a>.</main>;
  }

  if (roles?.length && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
