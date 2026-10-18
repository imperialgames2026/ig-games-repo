import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const pageVariants = {
  initial: (direction) => ({
    x: direction > 0 ? '100%' : '-100%',
    opacity: 0,
  }),
  animate: {
    x: 0,
    opacity: 1,
    transition: {
      type: 'tween',
      ease: 'easeOut',
      duration: 0.3,
    },
  },
  exit: (direction) => ({
    x: direction > 0 ? '-100%' : '100%',
    opacity: 0,
    transition: {
      type: 'tween',
      ease: 'easeIn',
      duration: 0.25,
    },
  }),
};

export default function PageTransition({ children }) {
  const location = useLocation();
  const [direction, setDirection] = useState(0);
  const [prevPath, setPrevPath] = useState(location.pathname);

  useEffect(() => {
    // Determine slide direction based on navigation
    const currentPath = location.pathname;
    const rootPages = ['/Home', '/Games', '/Store', '/Profile', '/'];
    const isCurrentRoot = rootPages.some(root => currentPath === root || currentPath.endsWith(root));
    const isPrevRoot = rootPages.some(root => prevPath === root || prevPath.endsWith(root));
    
    // Push (forward) = slide left, Pop (back) = slide right
    if (!isCurrentRoot && isPrevRoot) {
      setDirection(1); // Going deeper (push)
    } else if (isCurrentRoot && !isPrevRoot) {
      setDirection(-1); // Going back (pop)
    } else {
      setDirection(1); // Default forward
    }
    
    setPrevPath(currentPath);
  }, [location.pathname]);

  return (
    <AnimatePresence mode="wait" initial={false} custom={direction}>
      <motion.div
        key={location.pathname}
        custom={direction}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="w-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}