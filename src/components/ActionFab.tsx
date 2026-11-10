import React, { useEffect, useMemo } from 'react';
import {
  X,
  Plus,
  SlidersHorizontal,
  FolderPlus,
  Store,
  ListPlus,
  RefreshCw,
  Link2,
  Camera,
  Tag,
  Barcode,
} from 'lucide-react';
import { useActionFab, FabActionItem, FabConfig } from '../context/ActionFabContext';

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

export const ActionFab: React.FC<{ activeTab: string }> = ({ activeTab }) => {
  const { tabConfigs, isOpen, setIsOpen, toggleOpen } = useActionFab();

  // Close speed dial on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, setIsOpen]);

  // Close speed dial when switching tabs
  useEffect(() => {
    setIsOpen(false);
  }, [activeTab, setIsOpen]);

  // Built-in fallback config ensures the FAB is ALWAYS visible on supported tabs
  const fallbackConfig: FabConfig | null = useMemo(() => {
    if (activeTab === 'grocery') {
      return {
        pillLabel: 'Add',
        icon: Plus,
        actions: [
          {
            id: 'add-item',
            label: 'Add Item',
            icon: Plus,
            color: 'emerald',
            onClick: () => window.dispatchEvent(new CustomEvent('famkit:action', { detail: 'add-item' })),
          },
          {
            id: 'add-category',
            label: 'Add Category',
            icon: FolderPlus,
            color: 'teal',
            onClick: () => window.dispatchEvent(new CustomEvent('famkit:action', { detail: 'add-category' })),
          },
          {
            id: 'add-list',
            label: 'Add List',
            icon: ListPlus,
            color: 'cyan',
            onClick: () => window.dispatchEvent(new CustomEvent('famkit:action', { detail: 'add-list' })),
          },
          {
            id: 'manage-stores',
            label: 'Manage Stores',
            icon: Store,
            color: 'slate',
            onClick: () => window.dispatchEvent(new CustomEvent('famkit:action', { detail: 'manage-stores' })),
          },
        ],
      };
    }

    if (activeTab === 'home') {
      return {
        pillLabel: 'Manage',
        icon: SlidersHorizontal,
        actions: [
          {
            id: 'edit-controls',
            label: 'Edit Controls',
            icon: SlidersHorizontal,
            color: 'emerald',
            onClick: () => window.dispatchEvent(new CustomEvent('famkit:action', { detail: 'edit-controls' })),
          },
          {
            id: 'refresh-controls',
            label: 'Refresh Devices',
            icon: RefreshCw,
            color: 'teal',
            onClick: () => window.dispatchEvent(new CustomEvent('famkit:action', { detail: 'refresh-controls' })),
          },
        ],
      };
    }

    if (activeTab === 'calendar') {
      return {
        pillLabel: 'Event',
        icon: Plus,
        actions: [
          {
            id: 'add-calendar-event',
            label: 'Add Event',
            icon: Plus,
            color: 'emerald',
            onClick: () => window.dispatchEvent(new CustomEvent('famkit:action', { detail: 'add-event' })),
          },
          {
            id: 'sync-google-calendar',
            label: 'Sync Google Calendar',
            icon: RefreshCw,
            color: 'teal',
            onClick: () => window.dispatchEvent(new CustomEvent('famkit:action', { detail: 'sync-google' })),
          },
        ],
      };
    }

    if (activeTab === 'meals' || activeTab === 'recipes') {
      return {
        pillLabel: 'Recipe',
        icon: Plus,
        actions: [
          {
            id: 'import-recipe',
            label: 'Import',
            icon: Link2,
            color: 'teal',
            onClick: () => window.dispatchEvent(new CustomEvent('famkit:action', { detail: 'import-web' })),
          },
          {
            id: 'create-manual',
            label: 'Add Manually',
            icon: Plus,
            color: 'emerald',
            onClick: () => window.dispatchEvent(new CustomEvent('famkit:action', { detail: 'create-recipe-manual' })),
          },
          {
            id: 'manage-recipe-categories',
            label: 'Manage Categories',
            icon: Tag,
            color: 'amber',
            onClick: () => window.dispatchEvent(new CustomEvent('famkit:action', { detail: 'manage-recipe-categories' })),
          },
        ],
      };
    }

    return null;
  }, [activeTab]);

  const config = tabConfigs[activeTab] || fallbackConfig;

  // Don't render on settings, admin, family, pricing, etc.
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
      <div
        className={`fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />

      {/* Floating Speed-Dial Container */}
      <div className="fixed z-40 bottom-[calc(72px+1rem+env(safe-area-inset-bottom,0px))] md:bottom-8 right-4 md:right-8 flex flex-col items-end pointer-events-none select-none">
        {/* Animated Sub-Actions (Smaller FABs that animate up out of the larger FAB and expand out) */}
        <div className="flex flex-col items-end gap-2.5 mb-3 pointer-events-none">
          {config.actions.map((action, index) => {
            const ActionIcon = action.icon;
            // Calculate distance to main FAB so items animate straight out from the main FAB's position
            const slotsBelow = config.actions.length - index;
            const translateYClosed = slotsBelow * 54;

            return (
              <div
                key={action.id}
                className={`flex items-center justify-end gap-3 transition-all duration-300 ${
                  isOpen
                    ? 'opacity-100 pointer-events-auto'
                    : 'opacity-0 pointer-events-none'
                }`}
                style={{
                  transform: isOpen
                    ? 'translateY(0px) scale(1)'
                    : `translateY(${translateYClosed}px) scale(0.25)`,
                  transitionTimingFunction: isOpen
                    ? 'cubic-bezier(0.34, 1.56, 0.64, 1)'
                    : 'cubic-bezier(0.4, 0, 0.2, 1)',
                  transitionDelay: isOpen
                    ? `${(config.actions.length - 1 - index) * 40}ms`
                    : `${index * 25}ms`,
                }}
              >
                {/* Action Label Pill */}
                <button
                  type="button"
                  onClick={() => handleActionClick(action)}
                  tabIndex={isOpen ? 0 : -1}
                  className={`px-3.5 py-1.5 rounded-xl bg-slate-900/95 backdrop-blur-xl border border-white/15 text-slate-100 hover:text-white font-bold text-xs shadow-2xl shadow-slate-950/80 hover:bg-slate-800 transition-all duration-200 flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                    isOpen ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-3'
                  }`}
                  style={{
                    transitionDelay: isOpen
                      ? `${(config.actions.length - 1 - index) * 40 + 40}ms`
                      : '0ms',
                  }}
                >
                  <span>{action.label}</span>
                </button>

                {/* Centered Sub FAB Container matching Main FAB width (w-14) */}
                <div className="w-14 flex items-center justify-center shrink-0">
                  <button
                    type="button"
                    onClick={() => handleActionClick(action)}
                    tabIndex={isOpen ? 0 : -1}
                    className={`w-11 h-11 rounded-full flex items-center justify-center font-bold shadow-xl transition-all duration-150 hover:scale-110 active:scale-90 cursor-pointer ${getActionColorClasses(
                      action.color
                    )}`}
                    title={action.label}
                    aria-label={action.label}
                  >
                    <ActionIcon className="w-5 h-5 stroke-[2.2]" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Primary Round FAB with Plus that rotates into an X */}
        <button
          type="button"
          onClick={handleMainClick}
          aria-expanded={isOpen}
          aria-label={isOpen ? 'Close menu' : config.pillLabel || 'Actions'}
          className={`pointer-events-auto relative z-20 w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl active:scale-90 cursor-pointer select-none ${
            isOpen
              ? 'bg-slate-900 text-emerald-400 border border-emerald-500/40 shadow-slate-950/90 hover:bg-slate-800 hover:scale-105'
              : 'bg-gradient-to-tr from-emerald-500 via-teal-400 to-emerald-400 text-slate-950 shadow-emerald-500/35 border border-emerald-300/40 hover:scale-105 hover:shadow-emerald-500/50'
          }`}
          title={isOpen ? 'Close' : config.pillLabel || 'Actions'}
        >
          <Plus
            className={`w-6 h-6 stroke-[2.5] transition-transform duration-300 ease-out transform ${
              isOpen ? 'rotate-45 text-emerald-400' : 'rotate-0 text-slate-950'
            }`}
          />
        </button>
      </div>
    </>
  );
};
