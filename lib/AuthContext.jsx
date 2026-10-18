import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  const loadSessionUser = useCallback(async (sessionUser) => {
    if (!sessionUser) {
      setUser(null);
      setIsAuthenticated(false);
      return;
    }

    // Auth identity is authoritative. Profile data is optional and must never
    // prevent an otherwise valid Auth session from opening the application.
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id,email,full_name,profile_picture,role,is_excluded,kyc_status')
      .eq('id', sessionUser.id)
      .maybeSingle();

    if (error) console.error('Could not load profile:', error.message);

    setUser({
      ...(profile ?? {}),
      id: sessionUser.id,
      email: sessionUser.email ?? profile?.email ?? null,
      role: profile?.role ?? 'player',
      is_excluded: profile?.is_excluded ?? false,
    });
    setIsAuthenticated(true);
  }, []);

  const checkAppState = useCallback(async () => {
    setIsLoadingAuth(true);
    setAuthError(null);
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      await loadSessionUser(data.session?.user ?? null);
    } catch (error) {
      console.error('Supabase auth check failed:', error);
      setAuthError({ type: 'unknown', message: error.message || 'Failed to load session' });
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoadingAuth(false);
    }
  }, [loadSessionUser]);

  useEffect(() => {
    let mounted = true;
    // Subscribe before checking the current session so sign-in events aren't missed.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setAuthError(null);
      void loadSessionUser(session?.user ?? null).catch((error) => {
        console.error('Failed to synchronize auth state:', error);
        setAuthError({ type: 'unknown', message: error.message || 'Failed to load profile' });
      }).finally(() => {
        if (mounted) setIsLoadingAuth(false);
      });
    });
    void checkAppState();
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [checkAppState, loadSessionUser]);

  const logout = async (shouldRedirect = true) => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
    setIsAuthenticated(false);
    if (shouldRedirect) window.location.assign('/login');
  };

  const navigateToLogin = () => window.location.assign('/login');

  return (
    <AuthContext.Provider value={{
      user, isAuthenticated, isLoadingAuth, authError,
      isLoadingPublicSettings: false,
      appPublicSettings: { provider: 'supabase' },
      logout, navigateToLogin, checkAppState,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
