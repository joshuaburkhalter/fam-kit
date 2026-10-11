import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  headerRight?: React.ReactNode;
  customHeader?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  width?: string; // e.g. "max-w-md", "max-w-xl"
  maxWidth?: string; // e.g. "max-w-md", "max-w-lg", "max-w-xl", "max-w-2xl" (default: "max-w-full sm:max-w-xl md:max-w-2xl")
  contentClassName?: string;
}

// Module-level manager for drawer history states to support stacked / transitioning drawers
interface DrawerStackEntry {
  id: string;
  close: () => void;
}

const activeDrawerStack: DrawerStackEntry[] = [];
let hasPushedGlobalDrawerHistory = false;
let backDebounceTimer: any = null;

function registerDrawerToStack(id: string, close: () => void) {
  if (backDebounceTimer) {
    clearTimeout(backDebounceTimer);
    backDebounceTimer = null;
  }
  const existingIdx = activeDrawerStack.findIndex((e) => e.id === id);
  if (existingIdx !== -1) {
    activeDrawerStack[existingIdx].close = close;
  } else {
    activeDrawerStack.push({ id, close });
  }

  if (!hasPushedGlobalDrawerHistory && typeof window !== 'undefined') {
    hasPushedGlobalDrawerHistory = true;
    window.history.pushState({ type: 'drawer', timestamp: Date.now() }, '', window.location.href);
  }
}

function unregisterDrawerFromStack(id: string, fromPopState = false) {
  const existingIdx = activeDrawerStack.findIndex((e) => e.id === id);
  if (existingIdx !== -1) {
    activeDrawerStack.splice(existingIdx, 1);
  }

  if (activeDrawerStack.length === 0) {
    if (backDebounceTimer) {
      clearTimeout(backDebounceTimer);
      backDebounceTimer = null;
    }

    if (!fromPopState) {
      backDebounceTimer = setTimeout(() => {
        if (activeDrawerStack.length === 0 && hasPushedGlobalDrawerHistory && typeof window !== 'undefined') {
          hasPushedGlobalDrawerHistory = false;
          window.history.back();
        }
      }, 100);
    } else {
      hasPushedGlobalDrawerHistory = false;
    }
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    if (activeDrawerStack.length > 0) {
      const topEntry = activeDrawerStack[activeDrawerStack.length - 1];
      if (topEntry) {
        topEntry.close();
      }
    } else {
      hasPushedGlobalDrawerHistory = false;
    }
  });
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  badge,
  headerRight,
  customHeader,
  footer,
  children,
  width,
  maxWidth,
  contentClassName = 'p-4 sm:p-6 space-y-4',
}) => {
  const getResponsiveWidth = () => {
    const raw = width || maxWidth;
    if (!raw) return 'w-full sm:max-w-xl md:max-w-2xl';
    const parts = raw.split(' ').map((p) => p.trim()).filter(Boolean);
    const smParts = parts.map((p) => (p.includes(':') ? p : `sm:${p}`));
    return `w-full max-w-full ${smParts.join(' ')}`;
  };
  const panelWidth = getResponsiveWidth();
  const drawerIdRef = useRef(`drawer_${Math.random().toString(36).substring(2, 9)}`);
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const isClosingRef = useRef(false);
  isClosingRef.current = isClosing;

  // Sync render state immediately when isOpen becomes true
  if (isOpen && !isRendered) {
    setIsRendered(true);
    setIsClosing(false);
  }

  const handleClose = (fromPopState: boolean = false) => {
    if (isClosingRef.current) return;
    setIsClosing(true);
    unregisterDrawerFromStack(drawerIdRef.current, fromPopState);

    setTimeout(() => {
      onClose();
      setIsRendered(false);
      setIsClosing(false);
    }, 260);
  };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      registerDrawerToStack(drawerIdRef.current, () => handleClose(true));

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') handleClose(false);
      };

      window.addEventListener('keydown', handleKeyDown);

      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        if (activeDrawerStack.length <= 1) {
          document.body.style.overflow = '';
        }
        unregisterDrawerFromStack(drawerIdRef.current, false);
      };
    } else if (isRendered && !isClosing) {
      setIsClosing(true);
      unregisterDrawerFromStack(drawerIdRef.current, false);
      const timer = setTimeout(() => {
        setIsRendered(false);
        setIsClosing(false);
        if (activeDrawerStack.length === 0) {
          document.body.style.overflow = '';
        }
      }, 260);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isRendered) return null;

  const drawerContent = (
    <div className="fixed inset-0 z-[9999] flex justify-end">
      {/* Semi-transparent backdrop with smooth fade animation */}
      <div
        className={`fixed inset-0 bg-black/65 backdrop-blur-xs cursor-pointer ${
          isClosing ? 'animate-backdrop-out pointer-events-none' : 'animate-backdrop-in'
        }`}
        onClick={() => handleClose(false)}
      />

      {/* Slide-out Drawer Panel with fluid hardware-accelerated spring slide */}
      <div
        className={`relative z-10 ${panelWidth} h-full h-[100dvh] bg-[#0a0f1d] border-l-0 sm:border-l border-white/10 shadow-2xl shadow-black flex flex-col overflow-hidden ${
          isClosing ? 'animate-drawer-out' : 'animate-drawer-in'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {customHeader ? (
          customHeader
        ) : (
          <div className="px-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] pb-4 sm:p-5 border-b border-white/10 flex items-center justify-between gap-3 bg-gradient-to-r from-slate-900 via-[#0a0f1d] to-slate-900 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              {icon && (
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-emerald-500/20 shrink-0">
                  {icon}
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black text-white tracking-tight truncate">
                    {title}
                  </h2>
                  {badge}
                </div>
                {subtitle && (
                  <p className="text-[11px] text-slate-400 truncate">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {headerRight}
              <button
                type="button"
                onClick={() => handleClose(false)}
                aria-label="Close drawer"
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Scrollable Content Body */}
        <div className={`flex-1 overflow-y-auto ${contentClassName}`}>
          {children}
        </div>

        {/* Optional Footer */}
        {footer && (
          <div className="px-4 pt-3.5 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:p-4 border-t border-white/10 bg-slate-950/80 flex items-center justify-end gap-2 text-xs shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(drawerContent, document.body);
  }
  return drawerContent;
};
