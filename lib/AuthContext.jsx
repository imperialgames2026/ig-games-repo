import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { resolveIdentity } from './identity.js';
import { queryClientInstance } from './query-client.js';
import { clearAuthLinkErrorUrl, readAuthLinkError } from './authFlow.js';

const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoadingAuth, setLoading] = useState(true);
  const [authError, setError] = useState(null);
  const [authLinkError, setAuthLinkError] = useState(() => readAuthLinkError(window.location));
  const generation = useRef(0);
  const verifiedUserId = useRef(null);
  const clearIdentity = useCallback(() => {
    verifiedUserId.current = null;
    queryClientInstance.clear();
    setUser(null);
  }, []);
  const clearAuthLinkError = useCallback(() => {
    clearAuthLinkErrorUrl(window);
    setAuthLinkError(null);
  }, []);
  const checkAppState = useCallback(async ({background=false}={}) => {
    const request = ++generation.current;
    if (!background) setLoading(true);
    try {
      const identity = await resolveIdentity(supabase);
      if (request !== generation.current) return;
      if (verifiedUserId.current !== (identity?.id ?? null)) queryClientInstance.clear();
      verifiedUserId.current = identity?.id ?? null;
      setUser(identity);
      setError(null);
      return identity;
    } catch (error) {
      if (request !== generation.current) return;
      clearIdentity();
      setError({ type: error.type === 'mfa_required' ? 'mfa_required' : 'account_unverified', message: error.message });
      return null;
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, [clearIdentity]);
  useEffect(() => {
    let mounted = true;
    let timer;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      ++generation.current;
      if (_event === 'PASSWORD_RECOVERY' && window.location.pathname !== '/ResetPassword') {window.location.assign('/ResetPassword');return;}
      clearTimeout(timer);
      if (!session) { clearIdentity();setError(null);setLoading(false);return; }
      const sameUser = session.user?.id === verifiedUserId.current;
      const background = sameUser && ['USER_UPDATED', 'TOKEN_REFRESHED', 'SIGNED_IN', 'MFA_CHALLENGE_VERIFIED'].includes(_event);
      if (!background) { clearIdentity();setError(null);setLoading(true); }
      // Leave the auth callback before calling Supabase APIs (auth lock).
      timer = setTimeout(() => { if (mounted) void checkAppState({background}); }, 0);
    });
    void checkAppState();
    return () => {
      mounted = false;
      ++generation.current;
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, [checkAppState, clearIdentity]);
  const logout = async (shouldRedirect = true) => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    ++generation.current;
    clearIdentity();
    if (shouldRedirect) window.location.assign('/login');
  };
  return <AuthContext.Provider value={{
    user, isAuthenticated: !!user, isLoadingAuth, authError, authLinkError, clearAuthLinkError,
    authChecked: !isLoadingAuth, checkUserAuth: checkAppState,
    isLoadingPublicSettings: false, appPublicSettings: { provider: 'supabase' },
    logout, navigateToLogin: () => window.location.assign('/login'), checkAppState,
  }}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within an AuthProvider');
  return value;
}
