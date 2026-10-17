import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';

// Shared game state lives in Supabase, never in a browser-controlled wallet.
// Poll for table updates while present; all mutations are transactional server RPCs.
export function useMultiplayerPractice(game) {
  const { user, isAuthenticated } = useAuth();
  const [table, setTable] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const alive = useRef(true);
  const latest = useRef(null);

  const ingest = useCallback((fresh) => {
    if (!alive.current || !fresh || fresh.game !== game) return;
    // Prevent an out-of-order poll from overwriting a more recent action result.
    if (!latest.current || Number(fresh.revision) >= Number(latest.current.revision)) {
      latest.current = fresh;
      setTable(fresh);
    }
  }, [game]);

  const invoke = useCallback(async (action, args = {}) => {
    const { data, error: networkError } = await supabase.functions.invoke('ig-multiplayer-practice', {
      body: { game, action, ...args },
    });
    if (networkError) throw new Error('Cannot reach the practice table. Refresh before retrying an action.');
    if (!data || data.error) throw new Error(data?.error || 'Practice table returned an invalid response');
    ingest(data.state);
    return data;
  }, [game, ingest]);

  const refresh = useCallback(async (quiet = false) => {
    if (!isAuthenticated) {
      if (alive.current) { setLoading(false); setTable(null); }
      return;
    }
    try {
      await invoke('state');
      if (!quiet && alive.current) setError('');
    } catch (e) {
      if (!quiet && alive.current) setError(e.message);
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [invoke, isAuthenticated]);

  useEffect(() => {
    alive.current = true;
    latest.current = null;
    setTable(null);
    setLoading(true);
    void refresh();
    const polling = window.setInterval(() => { void refresh(true); }, 3000);
    const heartbeat = window.setInterval(() => {
      if (latest.current?.joined && !busy) {
        void invoke('join').catch(() => {}); // Keep an actively watching shooter's seat fresh.
      }
    }, 25000);
    return () => {
      alive.current = false;
      window.clearInterval(polling);
      window.clearInterval(heartbeat);
    };
  }, [game, refresh, invoke]); // Table is retained server-side across refreshes.

  const action = useCallback(async (name, args = {}) => {
    if (busy || !isAuthenticated) return false;
    setBusy(true);
    setError('');
    try {
      await invoke(name, args);
      return true;
    } catch (e) {
      if (alive.current) setError(e.message);
      return false;
    } finally {
      if (alive.current) setBusy(false);
    }
  }, [busy, isAuthenticated, invoke]);

  const placeBet = useCallback((target, units) => action('bet', {
    target, units, requestId: crypto.randomUUID(),
  }), [action]);
  const runRound = useCallback(() => {
    if (!table) return Promise.resolve(false);
    return action(game === 'craps' ? 'roll' : 'spin', {
      requestId: crypto.randomUUID(), expectedRound: table.round,
    });
  }, [action, game, table]);

  return {
    table, loading, busy, error, user, isAuthenticated,
    refresh, join: () => action('join'), claim: () => action('claim'),
    placeBet, runRound,
  };
}
