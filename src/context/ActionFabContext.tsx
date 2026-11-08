import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';

export interface FabActionItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  color?: 'emerald' | 'teal' | 'cyan' | 'purple' | 'amber' | 'blue' | 'rose' | 'slate';
  onClick: () => void;
  disabled?: boolean;
}

export interface FabConfig {
  pillLabel?: string;
  icon?: React.ComponentType<{ className?: string }>;
  actions: FabActionItem[];
}

interface ActionFabContextValue {
  config: FabConfig | null;
  registerFab: (config: FabConfig | null) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  toggleOpen: () => void;
}

const ActionFabContext = createContext<ActionFabContextValue | undefined>(undefined);

export const ActionFabProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<FabConfig | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const registerFab = useCallback((newConfig: FabConfig | null) => {
    setConfig(newConfig);
    setIsOpen(false);
  }, []);

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const value = useMemo(
    () => ({
      config,
      registerFab,
      isOpen,
      setIsOpen,
      toggleOpen,
    }),
    [config, registerFab, isOpen, toggleOpen]
  );

  return <ActionFabContext.Provider value={value}>{children}</ActionFabContext.Provider>;
};

export const useActionFab = () => {
  const context = useContext(ActionFabContext);
  if (!context) {
    throw new Error('useActionFab must be used within an ActionFabProvider');
  }
  return context;
};

/**
 * Hook for pages to register their bottom FAB actions.
 * Cleans up on unmount.
 */
export const useRegisterFab = (config: FabConfig | null, deps: any[] = []) => {
  const { registerFab } = useActionFab();

  useEffect(() => {
    registerFab(config);
    return () => {
      registerFab(null);
    };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
};
