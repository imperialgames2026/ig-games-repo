import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { resolveIdentity } from './identity.js';

const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoadingAuth, setLoading] = useState(true);
  const [authError, setError] = useState(null);
  const generation = useRef(0);
  const checkAppState = useCallback(async ({background=false}={}) => {
    const request = ++generation.current;
    if (!background) setLoading(true);
    try {
      const identity = await resolveIdentity(supabase);
      if (request !== generation.current) return;
      setUser(identity);
      setError(null);
      return identity;
    } catch (error) {
      if (request !== generation.current) return;
      setUser(null);
      setError({ type: 'account_unverified', message: error.message });
      return null;
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    let mounted = true;
    let timer;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      ++generation.current;
      if (_event === 'PASSWORD_RECOVERY' && window.location.pathname !== '/ResetPassword') {window.location.assign('/ResetPassword');return;}
      clearTimeout(timer);
      if (!session) { setUser(null);setError(null);setLoading(false);return; }
      const background = _event === 'USER_UPDATED' || _event === 'TOKEN_REFRESHED';
      if (!background) { setUser(null);setError(null);setLoading(true); }
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
  }, [checkAppState]);
  const logout = async (shouldRedirect = true) => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    ++generation.current;
    setUser(null);
    if (shouldRedirect) window.location.assign('/login');
  };
  return <AuthContext.Provider value={{
    user, isAuthenticated: !!user, isLoadingAuth, authError,
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
