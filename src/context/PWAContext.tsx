import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Household, User, Aisle } from '../types';
import { api } from '../lib/api';

interface PWAContextType {
  household: Household | null;
  users: User[];
  currentUser: User | null;
  aisles: Aisle[];
  isOnline: boolean;
  canInstallPWA: boolean;
  isPWAInstalled: boolean;
  isPushSupported: boolean;
  isPushSubscribed: boolean;
  apiKey: string;
  setApiKey: (key: string) => void;
  isLoadingAuth: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    name: string;
    email?: string;
    password?: string;
    avatarColor?: string;
    role?: string;
    action: 'create_household' | 'join_household';
    householdName?: string;
    inviteCode?: string;
  }) => Promise<void>;
  logout: () => void;
  installPWA: () => Promise<void>;
  subscribeToPush: () => Promise<boolean>;
  setHousehold: (household: Household) => void;
  refreshHouseholdsAndUsers: () => Promise<void>;
  refreshAisles: () => Promise<void>;
  autoAudioResponses: boolean;
  setAutoAudioResponses: (enabled: boolean) => void;
}

const PWAContext = createContext<PWAContextType | undefined>(undefined);

export const PWAProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [household, setHouseholdState] = useState<Household | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUserState] = useState<User | null>(null);
  const [aisles, setAisles] = useState<Aisle[]>([]);
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [canInstallPWA, setCanInstallPWA] = useState<boolean>(false);
  const [isPWAInstalled, setIsPWAInstalled] = useState<boolean>(false);
  const [isPushSupported, setIsPushSupported] = useState<boolean>(false);
  const [isPushSubscribed, setIsPushSubscribed] = useState<boolean>(false);
  const [apiKey, setApiKeyState] = useState<string>(() => {
    return localStorage.getItem('famkit_gemini_api_key') || '';
  });

  const setApiKey = (key: string) => {
    const trimmed = key.trim();
    setApiKeyState(trimmed);
    if (trimmed) {
      localStorage.setItem('famkit_gemini_api_key', trimmed);
    } else {
      localStorage.removeItem('famkit_gemini_api_key');
    }
  };

  const [autoAudioResponses, setAutoAudioResponsesState] = useState<boolean>(() => {
    const saved = localStorage.getItem('homebase_auto_audio');
    return saved !== null ? saved === 'true' : false;
  });

  const setAutoAudioResponses = (enabled: boolean) => {
    setAutoAudioResponsesState(enabled);
    localStorage.setItem('homebase_auto_audio', String(enabled));
  };

  // Load household members & aisles for active household
  const refreshHouseholdsAndUsers = async () => {
    const activeHouseholdId = localStorage.getItem('famkit_household_id');
    if (!activeHouseholdId) return;

    try {
      const householdUsers = await api.getUsers(activeHouseholdId);
      setUsers(householdUsers);

      const householdAisles = await api.getAisles(activeHouseholdId);
      setAisles(householdAisles);
    } catch (err) {
      console.error('Failed to load household data:', err);
    }
  };

  const refreshAisles = async () => {
    if (household) {
      try {
        const list = await api.getAisles(household.id);
        setAisles(list);
      } catch (err) {
        console.error('Failed to refresh aisles:', err);
      }
    }
  };

  const setHousehold = (h: Household) => {
    setHouseholdState(h);
    localStorage.setItem('famkit_household_id', h.id);
    refreshHouseholdsAndUsers();
  };

  const login = async (email: string, password: string) => {
    const res = await api.login(email, password);
    localStorage.setItem('famkit_auth_token', res.token);
    localStorage.setItem('famkit_user_id', res.user.id);
    localStorage.setItem('famkit_household_id', res.household.id);

    setCurrentUserState(res.user);
    setHouseholdState(res.household);

    try {
      const [householdUsers, householdAisles] = await Promise.all([
        api.getUsers(res.household.id),
        api.getAisles(res.household.id),
      ]);
      setUsers(householdUsers);
      setAisles(householdAisles);
    } catch (e) {
      console.error('Error fetching household data on login:', e);
    }
  };

  const register = async (data: {
    name: string;
    email?: string;
    password?: string;
    avatarColor?: string;
    role?: string;
    action: 'create_household' | 'join_household';
    householdName?: string;
    inviteCode?: string;
  }) => {
    const res = await api.register(data);
    localStorage.setItem('famkit_auth_token', res.token);
    localStorage.setItem('famkit_user_id', res.user.id);
    localStorage.setItem('famkit_household_id', res.household.id);

    setCurrentUserState(res.user);
    setHouseholdState(res.household);

    try {
      const [householdUsers, householdAisles] = await Promise.all([
        api.getUsers(res.household.id),
        api.getAisles(res.household.id),
      ]);
      setUsers(householdUsers);
      setAisles(householdAisles);
    } catch (e) {
      console.error('Error fetching household data on register:', e);
    }
  };

  const logout = () => {
    localStorage.removeItem('famkit_auth_token');
    localStorage.removeItem('famkit_user_id');
    localStorage.removeItem('famkit_household_id');
    setCurrentUserState(null);
    setHouseholdState(null);
    setUsers([]);
    setAisles([]);
  };

  // Auth Rehydration on mount
  useEffect(() => {
    const initAuth = async () => {
      const savedToken = localStorage.getItem('famkit_auth_token');
      if (savedToken) {
        try {
          const { user, household: h } = await api.getMe();
          if (user && h) {
            setCurrentUserState(user);
            setHouseholdState(h);
            localStorage.setItem('famkit_user_id', user.id);
            localStorage.setItem('famkit_household_id', h.id);

            const [householdUsers, householdAisles] = await Promise.all([
              api.getUsers(h.id),
              api.getAisles(h.id),
            ]);
            setUsers(householdUsers);
            setAisles(householdAisles);
          } else {
            logout();
          }
        } catch {
          logout();
        }
      }
      setIsLoadingAuth(false);
    };

    initAuth();

    // Online / Offline tracking
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // PWA install prompt capture
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstallPWA(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if running as standalone PWA
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsPWAInstalled(isStandalone);

    // Push notification capability check
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setIsPushSupported(true);
      navigator.serviceWorker.ready.then(async (reg) => {
        const sub = await reg.pushManager.getSubscription();
        setIsPushSubscribed(!!sub);
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const installPWA = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsPWAInstalled(true);
      setCanInstallPWA(false);
    }
    setDeferredPrompt(null);
  };

  const subscribeToPush = async (): Promise<boolean> => {
    if (!isPushSupported || !household) return false;
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        alert('Notification permission was denied.');
        return false;
      }

      const { publicKey } = await api.getVapidPublicKey();
      const reg = await navigator.serviceWorker.ready;

      // Convert VAPID key to Uint8Array
      const padding = '='.repeat((4 - (publicKey.length % 4)) % 4);
      const base64 = (publicKey + padding).replace(/-/g, '+').replace(/_/g, '/');
      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: outputArray,
      });

      await api.subscribePush({
        householdId: household.id,
        userId: currentUser?.id,
        subscription: subscription.toJSON(),
      });

      setIsPushSubscribed(true);
      return true;
    } catch (err) {
      console.error('Push subscription failed:', err);
      return false;
    }
  };

  return (
    <PWAContext.Provider
      value={{
        household,
        users,
        currentUser,
        aisles,
        isOnline,
        canInstallPWA,
        isPWAInstalled,
        isPushSupported,
        isPushSubscribed,
        apiKey,
        setApiKey,
        isLoadingAuth,
        login,
        register,
        logout,
        installPWA,
        subscribeToPush,
        setHousehold,
        refreshHouseholdsAndUsers,
        refreshAisles,
        autoAudioResponses,
        setAutoAudioResponses,
      }}
    >
      {children}
    </PWAContext.Provider>
  );
};

export const usePWA = () => {
  const context = useContext(PWAContext);
  if (!context) {
    throw new Error('usePWA must be used within a PWAProvider');
  }
  return context;
};
