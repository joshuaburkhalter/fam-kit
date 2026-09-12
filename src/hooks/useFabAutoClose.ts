import { useEffect, useRef, type RefObject } from 'react';

interface UseFabAutoCloseOptions {
  isOpen: boolean;
  onClose: () => void;
  ignore?: boolean;
}

export function useFabAutoClose<T extends HTMLElement = HTMLDivElement>({
  isOpen,
  onClose,
  ignore = false,
}: UseFabAutoCloseOptions): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const openedAtRef = useRef<number>(0);

  useEffect(() => {
    if (!isOpen) return;
    openedAtRef.current = Date.now();

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (ignore) return;
      // Allow a brief grace period (50ms) to ensure opening tap doesn't self-trigger
      if (Date.now() - openedAtRef.current < 50) return;

      const target = e.target as Node | null;
      if (!target) return;

      // If clicked inside an open modal, alert, or element marked to keep FAB open
      if (target instanceof Element && (target.closest?.('.fixed.inset-0') || target.closest?.('[data-fab-keep-open]'))) {
        return;
      }

      if (ref.current && !ref.current.contains(target)) {
        onCloseRef.current();
      }
    };

    const handleScroll = (e: Event) => {
      if (ignore) return;
      // Grace period (250ms) to prevent mobile browser autofocus scroll from instantly closing
      if (Date.now() - openedAtRef.current < 250) return;

      const target = e.target as Node | null;
      // If the scroll happened inside the dock itself, ignore
      if (ref.current && target && (ref.current === target || ref.current.contains(target))) {
        return;
      }

      onCloseRef.current();
    };

    const handleWheel = (e: WheelEvent) => {
      if (ignore) return;
      if (Date.now() - openedAtRef.current < 250) return;

      const target = e.target as Node | null;
      if (ref.current && target && (ref.current === target || ref.current.contains(target))) {
        return;
      }

      if (Math.abs(e.deltaY) > 2 || Math.abs(e.deltaX) > 2) {
        onCloseRef.current();
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (ignore) return;
      if (Date.now() - openedAtRef.current < 250) return;

      const target = e.target as Node | null;
      if (ref.current && target && (ref.current === target || ref.current.contains(target))) {
        return;
      }

      onCloseRef.current();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
      }
    };

    document.addEventListener('mousedown', handlePointerDown, { passive: true });
    document.addEventListener('touchstart', handlePointerDown, { passive: true });
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    window.addEventListener('wheel', handleWheel, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      window.removeEventListener('scroll', handleScroll, { capture: true });
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, ignore]);

  return ref;
}
