import React from 'react';
import { useLocation } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';

export default function PageTransition({ children }) {
  const { pathname } = useLocation();
  const reduceMotion = useReducedMotion();
  return <motion.div key={pathname} initial={reduceMotion ? false : { opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0 : 0.16 }} className="min-w-0 w-full">
    {children}
  </motion.div>;
}
