import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';

export default function PullToRefresh({ onRefresh, children }) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
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
      setIsRefreshing(true);
      await onRefresh();
      setIsRefreshing(false);
    }

    setPullDistance(0);
  };

  return (
    <div
      ref={scrollRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative"
      style={{ touchAction: 'pan-y' }}
    >
      <motion.div
        animate={{ height: pullDistance }}
        className="flex items-center justify-center bg-gradient-to-b from-pink-500/10 to-transparent overflow-hidden"
      >
        <motion.div
          animate={{ rotate: isRefreshing ? 360 : (pullDistance / 72) * 180 }}
          transition={{ repeat: isRefreshing ? Infinity : 0, duration: 1 }}
          className="flex items-center justify-center"
        >
          <RefreshCw className="w-5 h-5 text-pink-400" />
        </motion.div>
      </motion.div>

      {children}
    </div>
  );
}