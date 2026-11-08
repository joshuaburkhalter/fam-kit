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
  pillLabel: string;
  icon?: React.ComponentType<{ className?: string }>;
  actions: FabActionItem[];
}

interface ActionFabContextValue {
  tabConfigs: Record<string, FabConfig>;
  registerTabFab: (tabKey: string, config: FabConfig) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  toggleOpen: () => void;
}

const ActionFabContext = createContext<ActionFabContextValue | undefined>(undefined);

export const ActionFabProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tabConfigs, setTabConfigs] = useState<Record<string, FabConfig>>({});
  const [isOpen, setIsOpen] = useState(false);

  const registerTabFab = useCallback((tabKey: string, config: FabConfig) => {
    setTabConfigs((prev) => {
      if (prev[tabKey] === config) return prev;
      return { ...prev, [tabKey]: config };
    });
  }, []);

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const value = useMemo(
    () => ({
      tabConfigs,
      registerTabFab,
      isOpen,
      setIsOpen,
      toggleOpen,
    }),
    [tabConfigs, registerTabFab, isOpen, toggleOpen]
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
 */
export const useRegisterFab = (tabKey: string, config: FabConfig, deps: any[] = []) => {
  const { registerTabFab } = useActionFab();

  useEffect(() => {
    registerTabFab(tabKey, config);
  }, [tabKey, registerTabFab, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
};
