import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Returns { isExcluded, loading }
 * Reads the current user's is_excluded flag.
 */
export function useExclusionCheck() {
  const [isExcluded, setIsExcluded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      try {
        const u = await base44.auth.me();
        setIsExcluded(!!u?.is_excluded);
      } catch {
        setIsExcluded(false);
      } finally {
        setLoading(false);
      }
    };
    check();
  }, []);

  return { isExcluded, loading };
}