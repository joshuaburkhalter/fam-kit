import React, { useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import { useActionFab, FabActionItem } from '../context/ActionFabContext';

function getActionColorClasses(color?: FabActionItem['color']) {
  switch (color) {
    case 'emerald':
      return 'bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 shadow-emerald-500/25';
    case 'teal':
      return 'bg-gradient-to-tr from-teal-500 to-cyan-400 text-slate-950 shadow-teal-500/25';
    case 'cyan':
      return 'bg-gradient-to-tr from-cyan-500 to-blue-400 text-slate-950 shadow-cyan-500/25';
    case 'purple':
      return 'bg-gradient-to-tr from-purple-500 to-pink-500 text-white shadow-purple-500/25';
    case 'amber':
      return 'bg-gradient-to-tr from-amber-500 to-orange-400 text-slate-950 shadow-amber-500/25';
    case 'rose':
      return 'bg-gradient-to-tr from-rose-500 to-pink-500 text-white shadow-rose-500/25';
    case 'blue':
      return 'bg-gradient-to-tr from-blue-500 to-indigo-500 text-white shadow-blue-500/25';
    case 'slate':
    default:
      return 'bg-slate-800 text-slate-200 border border-white/10 hover:text-white shadow-slate-950/50';
  }
}

export const ActionFab: React.FC = () => {
  const { config, isOpen, setIsOpen, toggleOpen } = useActionFab();

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, setIsOpen]);

  // If no actions registered, don't render anything
  if (!config || !config.actions || config.actions.length === 0) {
    return null;
  }

  const MainIcon = config.icon || Plus;
  const isSingleAction = config.actions.length === 1;

  const handleMainClick = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(10);
    }
    if (isSingleAction) {
      config.actions[0].onClick();
    } else {
      toggleOpen();
    }
  };

  const handleActionClick = (action: FabActionItem) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(10);
    }
    setIsOpen(false);
    action.onClick();
  };

  return (
    <>
      {/* Backdrop when speed dial is open */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs transition-opacity duration-200 animate-in fade-in"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Floating Speed-Dial Container */}
      <div className="fixed z-40 bottom-[calc(72px+0.85rem+env(safe-area-inset-bottom,0px))] md:bottom-8 right-4 md:right-8 flex flex-col items-end pointer-events-none select-none">
        {/* Animated Sub-Actions (Smaller FABs) */}
        {isOpen && (
          <div className="flex flex-col items-end gap-2.5 mb-3 pointer-events-auto">
            {config.actions.map((action, index) => {
              const ActionIcon = action.icon;
              return (
                <div
                  key={action.id}
                  className="flex items-center justify-end gap-2.5 animate-in fade-in slide-in-from-bottom-4 duration-200 fill-mode-both"
                  style={{
                    animationDelay: `${(config.actions.length - 1 - index) * 35}ms`,
                  }}
                >
                  {/* Action Label Pill */}
                  <button
                    type="button"
                    onClick={() => handleActionClick(action)}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-900/95 backdrop-blur-xl border border-white/15 text-slate-100 hover:text-white font-bold text-xs shadow-2xl shadow-slate-950/80 hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <span>{action.label}</span>
                  </button>

                  {/* Sub FAB Circle */}
                  <button
                    type="button"
                    onClick={() => handleActionClick(action)}
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold shadow-xl transition-all duration-150 hover:scale-110 active:scale-95 cursor-pointer ${getActionColorClasses(
                      action.color
                    )}`}
                    title={action.label}
                  >
                    <ActionIcon className="w-5 h-5 stroke-[2.2]" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Primary FAB / Pill */}
        <button
          type="button"
          onClick={handleMainClick}
          className={`pointer-events-auto flex items-center gap-2 transition-all duration-200 shadow-2xl active:scale-95 cursor-pointer ${
            isOpen
              ? 'w-12 h-12 rounded-full bg-slate-800 text-white border border-white/20 justify-center shadow-slate-950/80 hover:bg-slate-700'
              : 'px-4 py-2.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-black text-xs shadow-emerald-500/30 border border-emerald-400/40 hover:scale-105'
          }`}
          title={isOpen ? 'Close' : config.pillLabel || 'Actions'}
        >
          {isOpen ? (
            <X className="w-5 h-5 stroke-[2.5] transition-transform duration-200 rotate-90" />
          ) : (
            <>
              <MainIcon className="w-4 h-4 stroke-[2.5]" />
              <span className="font-extrabold text-xs tracking-wide uppercase">
                {config.pillLabel || 'Actions'}
              </span>
            </>
          )}
        </button>
      </div>
    </>
  );
};
