import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings] = useState({ provider: 'supabase' });

  const loadSessionUser = async (sessionUser) => {
    if (!sessionUser) { setUser(null); setIsAuthenticated(false); return; }
    const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', sessionUser.id).single();
    if (error) throw error;
    setUser({ ...profile, id: sessionUser.id, email: sessionUser.email });
    setIsAuthenticated(true);
  };

  const checkAppState = async () => {
    setIsLoadingAuth(true); setAuthError(null);
    try {
      const { data } = await supabase.auth.getSession();
      await loadSessionUser(data.session?.user ?? null);
    } catch (error) {
      console.error('Supabase auth check failed:', error);
      setAuthError({ type: 'unknown', message: error.message || 'Failed to load session' });
      setUser(null); setIsAuthenticated(false);
    } finally { setIsLoadingAuth(false); }
  };

  useEffect(() => {
    checkAppState();
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => loadSessionUser(session?.user ?? null).catch(error => {
        console.error('Failed to load profile:', error);
        setAuthError({ type: 'unknown', message: error.message || 'Failed to load profile' });
      }), 0);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  const logout = async (shouldRedirect = true) => {
    await supabase.auth.signOut(); setUser(null); setIsAuthenticated(false);
    if (shouldRedirect) window.location.assign('/login');
  };

  return <AuthContext.Provider value={{ user, isAuthenticated, isLoadingAuth, isLoadingPublicSettings, authError, appPublicSettings, logout, navigateToLogin: () => window.location.assign('/login'), checkAppState }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
