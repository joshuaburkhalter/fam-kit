import { useEffect, useRef, type RefObject } from 'react';

interface UseFabAutoCloseOptions {
  isOpen: boolean;
  onClose: () => void;
  ignore?: boolean;
  closeOnScroll?: boolean;
}

export function useFabAutoClose<T extends HTMLElement = HTMLDivElement>({
  isOpen,
  onClose,
  ignore = false,
  closeOnScroll = false,
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
      // Allow a brief grace period (100ms) to ensure opening tap doesn't self-trigger
      if (Date.now() - openedAtRef.current < 100) return;

      const target = e.target as Node | null;
      if (!target) return;

      // If clicked inside an open modal, alert, or element marked to keep FAB open
      if (target instanceof Element && (target.closest?.('.fixed.inset-0') || target.closest?.('[data-fab-keep-open]'))) {
        return;
      }

      // If clicked/tapped outside the dock
      if (ref.current && !ref.current.contains(target)) {
        onCloseRef.current();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown, { passive: true });
    document.addEventListener('keydown', handleKeyDown);

    let removeScrollListeners: (() => void) | undefined;

    // Only attach scroll listeners if closeOnScroll is explicitly enabled
    // and never close if an input/textarea inside the dock is active
    if (closeOnScroll) {
      const handleScroll = (e: Event) => {
        if (ignore) return;
        if (Date.now() - openedAtRef.current < 500) return;

        // Never close on scroll if an input inside the dock is focused (e.g. mobile keyboard adjust)
        if (ref.current && ref.current.contains(document.activeElement)) {
          return;
        }

        const target = e.target as Node | null;
        if (ref.current && target && (ref.current === target || ref.current.contains(target))) {
          return;
        }

        onCloseRef.current();
      };

      window.addEventListener('scroll', handleScroll, { passive: true });
      removeScrollListeners = () => {
        window.removeEventListener('scroll', handleScroll);
      };
    }

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      if (removeScrollListeners) removeScrollListeners();
    };
  }, [isOpen, ignore, closeOnScroll]);

  return ref;
}
