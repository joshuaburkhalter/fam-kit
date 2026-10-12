import { useRef, useState, useCallback } from 'react';
import { triggerHaptic } from '../lib/haptics';

export interface UseLongPressOptions {
  threshold?: number;
  onLongPress: (e: React.SyntheticEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
}

export function useLongPress({
  threshold = 420,
  onLongPress,
  onClick,
}: UseLongPressOptions) {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const [isPressing, setIsPressing] = useState(false);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsPressing(false);
  }, []);

  const start = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      // If right click or other button, ignore
      if ('button' in e && e.button !== 0) return;

      clear();
      isLongPressRef.current = false;
      setIsPressing(true);

      if ('touches' in e && e.touches[0]) {
        startPosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if ('clientX' in e) {
        startPosRef.current = { x: e.clientX, y: e.clientY };
      }

      timerRef.current = setTimeout(() => {
        isLongPressRef.current = true;
        setIsPressing(false);
        triggerHaptic(35);
        onLongPress(e);
      }, threshold);
    },
    [threshold, onLongPress, clear]
  );

  const move = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      if (!startPosRef.current || !timerRef.current) return;
      const clientX = 'touches' in e ? e.touches[0]?.clientX : (e as React.MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0]?.clientY : (e as React.MouseEvent).clientY;

      if (clientX !== undefined && clientY !== undefined) {
        const dx = Math.abs(clientX - startPosRef.current.x);
        const dy = Math.abs(clientY - startPosRef.current.y);
        // If moved more than 9 pixels (scrolling or drag), cancel long press
        if (dx > 9 || dy > 9) {
          clear();
        }
      }
    },
    [clear]
  );

  const handleEnd = useCallback(() => {
    clear();
  }, [clear]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (isLongPressRef.current) {
        e.preventDefault();
        e.stopPropagation();
        isLongPressRef.current = false;
        return;
      }
      onClick?.(e);
    },
    [onClick]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      clear();
      triggerHaptic(25);
      onLongPress(e);
    },
    [clear, onLongPress]
  );

  return {
    handlers: {
      onTouchStart: start,
      onTouchMove: move,
      onTouchEnd: handleEnd,
      onTouchCancel: handleEnd,
      onMouseDown: start,
      onMouseMove: move,
      onMouseUp: handleEnd,
      onMouseLeave: handleEnd,
      onContextMenu: handleContextMenu,
      onClick: handleClick,
    },
    isPressing,
  };
}
