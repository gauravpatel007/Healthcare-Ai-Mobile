import { useEffect, useRef } from 'react';

export function useSwipeGesture({
  onSwipeLeft,
  onSwipeRight,
  threshold = 50,
  targetRef = null,
  isNested = false
}) {
  const touchStart = useRef(null);
  const touchEnd = useRef(null);

  useEffect(() => {
    const handleTouchStart = (e) => {
      const target = e.target;

      // If this is an outer app gesture, ignore touches starting inside an inner swipe container
      if (!isNested && target.closest('[data-swipe-nested="true"]')) {
        return;
      }

      // If this is an inner gesture, ignore touches starting outside its own container
      if (isNested && targetRef?.current && !targetRef.current.contains(target)) {
        return;
      }

      // Ignore if starting on an interactive element to avoid overriding native behavior
      const ignoreTags = ['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT', 'A'];
      if (ignoreTags.includes(target.tagName) || target.closest('button') || target.closest('a') || target.closest('[role="tab"]')) {
        return;
      }

      // Or if it's within a horizontally scrollable container
      const scrollParent = target.closest('.overflow-x-auto, .overflow-auto');
      if (scrollParent && scrollParent.scrollWidth > scrollParent.clientWidth) {
        return;
      }

      touchStart.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
    };

    const handleTouchMove = (e) => {
      if (!touchStart.current) return;
      touchEnd.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
    };

    const handleTouchEnd = () => {
      if (!touchStart.current || !touchEnd.current) {
        touchStart.current = null;
        touchEnd.current = null;
        return;
      }

      const dx = touchStart.current.x - touchEnd.current.x;
      const dy = Math.abs(touchStart.current.y - touchEnd.current.y);
      const isHorizontalSwipe = Math.abs(dx) > dy && Math.abs(dx) > threshold;

      if (isHorizontalSwipe) {
        if (dx > 0 && onSwipeLeft) {
          // Swipe Left (finger moved left, delta is positive) -> go next
          onSwipeLeft();
        } else if (dx < 0 && onSwipeRight) {
          // Swipe Right (finger moved right, delta is negative) -> go prev
          onSwipeRight();
        }
      }

      touchStart.current = null;
      touchEnd.current = null;
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onSwipeLeft, onSwipeRight, threshold, targetRef, isNested]);
}

