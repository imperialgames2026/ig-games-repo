import React, { useState, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';

export default function PullToRefresh({ onRefresh, children }) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const reduceMotion = useReducedMotion();
  const scrollRef = useRef(null);
  const startYRef = useRef(0);
  const isPullingRef = useRef(false);

  const handleTouchStart = (e) => {
    const scrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    startYRef.current = e.touches[0].clientY;
    isPullingRef.current = scrollTop <= 0;
  };

  const handleTouchMove = (e) => {
    if (isRefreshing || !isPullingRef.current) return;

    const currentY = e.touches[0].clientY;
    const distance = currentY - startYRef.current;
    const scrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;

    if (scrollTop > 0 || distance <= 0) {
      isPullingRef.current = false;
      setPullDistance(0);
      return;
    }

    setPullDistance(Math.min(distance * 0.45, 96));

    if (distance > 110 && e.cancelable) {
      e.preventDefault();
    }
  };

  const handleTouchEnd = async () => {
    isPullingRef.current = false;

    if (pullDistance > 72 && !isRefreshing) {
      if (pending.current) return;
      pending.current = true;
      setIsRefreshing(true); setError('');
      try { await onRefresh(); }
      catch { setError('Refresh could not finish. Pull down again to retry.'); }
      finally { pending.current = false; setIsRefreshing(false); setPullDistance(0); }
    }

    setPullDistance(0);
  };

  return (
    <div
      ref={scrollRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={() => { isPullingRef.current = false; setPullDistance(0); }}
      className="relative"
      style={{ touchAction: 'pan-y' }}
    >
      <motion.div
        animate={{ height: pullDistance }}
        aria-hidden={!pullDistance && !isRefreshing}
        className="flex items-center justify-center bg-gradient-to-b from-pink-500/10 to-transparent overflow-hidden"
      >
        <motion.div
          animate={{ rotate: reduceMotion ? 0 : isRefreshing ? 360 : (pullDistance / 72) * 180 }}
          transition={{ repeat: isRefreshing ? Infinity : 0, duration: 1 }}
          className="flex items-center justify-center"
        >
          <RefreshCw aria-hidden="true" className="w-5 h-5 text-pink-400" />
          {isRefreshing && <span role="status" className="sr-only">Refreshing page…</span>}
        </motion.div>
      </motion.div>

      {error && <p role="alert" className="px-4 py-3 text-sm text-amber-200">{error}</p>}
      {children}
    </div>
  );
}
