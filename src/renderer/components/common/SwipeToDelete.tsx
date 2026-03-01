import React, { useRef, useState, useEffect, useCallback } from 'react';

const THRESHOLD = 180; // px of rightward swipe to trigger delete
const DAMPEN = 0.55;   // scale down raw deltaX so fast flicks don't fire immediately
const RESET_DELAY = 400; // ms of inactivity before snapping back
const DELETE_COOLDOWN = 900; // ms — shared across all instances to prevent chain-deletes

// Module-level timestamp so every mounted instance respects the same cooldown.
let lastDeletedAt = 0;

/**
 * Detects horizontal trackpad / mouse horizontal-scroll swipe gestures (wheel events)
 * and reveals a delete action when swiped right past the threshold.
 *
 * Uses wheel events (not pointer events) so it never conflicts with HTML5 drag & drop.
 */
export function SwipeToDelete({
  onDelete,
  children,
}: {
  onDelete: () => void;
  children: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const accX = useRef(0);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const committed = useRef(false);

  const snapBack = useCallback(() => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    accX.current = 0;
    setTransitioning(true);
    setOffset(0);
  }, []);

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (committed.current) return;

      // Normalize deltaX across deltaMode (pixel / line / page)
      let dx = e.deltaX;
      if (e.deltaMode === 1 /* DOM_DELTA_LINE */) dx *= 16;
      else if (e.deltaMode === 2 /* DOM_DELTA_PAGE */) dx *= window.innerWidth;

      let dy = e.deltaY;
      if (e.deltaMode === 1) dy *= 16;
      else if (e.deltaMode === 2) dy *= window.innerHeight;

      // Only intercept clearly horizontal rightward swipes
      if (Math.abs(dx) < Math.abs(dy)) return;
      if (dx <= 0) {
        if (accX.current > 0) snapBack();
        return;
      }

      e.preventDefault(); // prevent the list from scrolling horizontally

      // If another item was just deleted, consume the event but don't accumulate.
      // This prevents the trailing wheel events of a single gesture from chain-deleting.
      if (Date.now() - lastDeletedAt < DELETE_COOLDOWN) {
        if (accX.current > 0) snapBack();
        return;
      }

      if (resetTimer.current) clearTimeout(resetTimer.current);
      setTransitioning(false);

      accX.current = Math.min(accX.current + dx * DAMPEN, THRESHOLD * 1.5);
      setOffset(accX.current);

      if (accX.current >= THRESHOLD) {
        committed.current = true;
        lastDeletedAt = Date.now(); // lock out all other instances
        setTransitioning(true);
        setOffset(600); // slide fully off screen
        accX.current = 0;
        setTimeout(() => {
          onDelete();
        }, 220);
        return;
      }

      // Auto-snap-back if the user stops swiping
      resetTimer.current = setTimeout(snapBack, RESET_DELAY);
    },
    [onDelete, snapBack],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheel);
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, [handleWheel]);

  const progress = Math.min(offset / THRESHOLD, 1);

  return (
    <div ref={containerRef} className="relative overflow-hidden">
      {/* Delete backdrop — revealed as content slides right */}
      <div
        className="absolute inset-0 bg-red-500 flex items-center pl-3 select-none pointer-events-none"
        style={{ opacity: progress }}
        aria-hidden
      >
        <span className="text-white text-xs font-bold">Delete</span>
      </div>

      {/* Sliding content layer */}
      <div
        style={{
          transform: `translateX(${Math.min(offset, 600)}px)`,
          transition: transitioning ? 'transform 0.22s ease-out' : 'none',
          position: 'relative',
          zIndex: 1,
          willChange: 'transform',
        }}
      >
        {children}
      </div>
    </div>
  );
}
