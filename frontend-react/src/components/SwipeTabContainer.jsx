import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSwipeGesture } from '../hooks/useSwipeGesture';

const SwipeTabContainer = ({ tabs, activeTab, onTabChange, children }) => {
  const containerRef = useRef(null);
  const activeIndex = tabs.indexOf(activeTab);
  const [direction, setDirection] = useState(0);

  // We need a ref to track current activeIndex to avoid stale closures in swipe handlers
  const indexRef = useRef(activeIndex);
  useEffect(() => {
    indexRef.current = activeIndex;
  }, [activeIndex]);

  const handleSwipeLeft = () => {
    // Next tab
    const current = indexRef.current;
    if (current < tabs.length - 1) {
      setDirection(1);
      onTabChange(tabs[current + 1]);
    } else {
      window.dispatchEvent(new CustomEvent('nested-swipe-bounds', { detail: 'left' }));
    }
  };

  const handleSwipeRight = () => {
    // Previous tab
    const current = indexRef.current;
    if (current > 0) {
      setDirection(-1);
      onTabChange(tabs[current - 1]);
    } else {
      window.dispatchEvent(new CustomEvent('nested-swipe-bounds', { detail: 'right' }));
    }
  };

  useSwipeGesture({
    onSwipeLeft: handleSwipeLeft,
    onSwipeRight: handleSwipeRight,
    threshold: 40,
    targetRef: containerRef,
    isNested: true
  });

  const variants = {
    enter: (direction) => {
      return {
        x: direction > 0 ? '100%' : '-100%',
        rotateY: direction > 0 ? 45 : -45,
        opacity: 0,
        scale: 0.9,
        filter: 'blur(2px)'
      };
    },
    center: {
      zIndex: 1,
      x: 0,
      rotateY: 0,
      opacity: 1,
      scale: 1,
      filter: 'blur(0px)'
    },
    exit: (direction) => {
      return {
        zIndex: 0,
        x: direction < 0 ? '100%' : '-100%',
        rotateY: direction < 0 ? 45 : -45,
        opacity: 0,
        scale: 0.9,
        filter: 'blur(2px)'
      };
    }
  };

  return (
    <div
      ref={containerRef}
      data-swipe-nested="true"
      className="relative overflow-hidden w-full h-full min-h-[400px]"
      style={{ perspective: '1200px' }}
    >
      <AnimatePresence initial={false} custom={direction} mode="popLayout">
        <motion.div
          key={activeTab}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            x: { type: 'spring', stiffness: 400, damping: 32 },
            opacity: { duration: 0.2 },
            scale: { type: 'spring', stiffness: 400, damping: 32 },
            rotateY: { type: 'spring', stiffness: 400, damping: 32 },
            filter: { duration: 0.2 }
          }}
          className="w-full h-full"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default SwipeTabContainer;
