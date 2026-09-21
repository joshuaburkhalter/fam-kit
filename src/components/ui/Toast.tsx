import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, AlertCircle, X } from 'lucide-react';

export interface ToastProps {
  message: string | null;
  onClose?: () => void;
  duration?: number;
  icon?: React.ReactNode;
  type?: 'success' | 'error';
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const Toast: React.FC<ToastProps> = ({
  message,
  onClose,
  duration = 3200,
  icon,
  type = 'success',
  action,
}) => {
  const [renderedMessage, setRenderedMessage] = useState<string | null>(message);
  const [isShowing, setIsShowing] = useState<boolean>(false);
  const dismissTimeoutRef = useRef<any>(null);
  const cleanupTimeoutRef = useRef<any>(null);

  const isError = type === 'error';

  useEffect(() => {
    if (message) {
      setRenderedMessage(message);
      // Next tick enables smooth slide-in transition from top
      const animFrame = requestAnimationFrame(() => {
        setIsShowing(true);
      });

      if (dismissTimeoutRef.current) clearTimeout(dismissTimeoutRef.current);
      if (cleanupTimeoutRef.current) clearTimeout(cleanupTimeoutRef.current);

      dismissTimeoutRef.current = setTimeout(() => {
        handleDismiss();
      }, duration);

      return () => cancelAnimationFrame(animFrame);
    } else if (isShowing) {
      handleDismiss();
    }
  }, [message, duration]);

  const handleDismiss = () => {
    setIsShowing(false);
    if (dismissTimeoutRef.current) clearTimeout(dismissTimeoutRef.current);
    if (cleanupTimeoutRef.current) clearTimeout(cleanupTimeoutRef.current);

    // Wait for 300ms slide-out animation to finish before clearing DOM
    cleanupTimeoutRef.current = setTimeout(() => {
      setRenderedMessage(null);
      if (onClose) onClose();
    }, 320);
  };

  if (!renderedMessage || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed top-[max(0.75rem,env(safe-area-inset-top))] sm:top-[max(1.25rem,env(safe-area-inset-top))] left-0 right-0 z-[9999] pointer-events-none flex justify-center px-3 sm:px-4">
      <div
        onClick={handleDismiss}
        className={`pointer-events-auto w-[94vw] sm:w-full max-w-xl md:max-w-2xl bg-slate-900/95 border ${
          isError
            ? 'border-red-500/40 text-red-200 shadow-red-500/15'
            : 'border-emerald-500/40 text-emerald-200 shadow-emerald-500/15'
        } px-4 sm:px-5 py-3 sm:py-3.5 rounded-2xl sm:rounded-3xl shadow-2xl backdrop-blur-xl flex items-center justify-between gap-3 text-xs sm:text-sm font-semibold transition-all duration-300 ease-out cursor-pointer select-none active:scale-[0.99] ${
          isShowing
            ? 'translate-y-0 opacity-100 scale-100'
            : '-translate-y-24 opacity-0 scale-95'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div
            className={`w-7 h-7 rounded-xl border flex items-center justify-center shrink-0 ${
              isError
                ? 'bg-red-500/15 border-red-500/30 text-red-400'
                : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
            }`}
          >
            {icon || (isError ? <AlertCircle className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />)}
          </div>
          <span className="truncate sm:text-wrap leading-tight">{renderedMessage}</span>
        </div>
        {action && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              action.onClick();
              handleDismiss();
            }}
            className="px-2.5 py-1 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold text-xs shrink-0 cursor-pointer border border-emerald-500/40 transition-colors"
          >
            {action.label}
          </button>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleDismiss();
          }}
          className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
          title="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>,
    document.body
  );
};
