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
  installPWA: () => Promise<void>;
  subscribeToPush: () => Promise<boolean>;
  setCurrentUser: (user: User) => void;
  setHousehold: (household: Household) => void;
  refreshHouseholdsAndUsers: () => Promise<void>;
  refreshAisles: () => Promise<void>;
}

const PWAContext = createContext<PWAContextType | undefined>(undefined);

export const PWAProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [household, setHouseholdState] = useState<Household | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUserState] = useState<User | null>(null);
  const [aisles, setAisles] = useState<Aisle[]>([]);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [canInstallPWA, setCanInstallPWA] = useState<boolean>(false);
  const [isPWAInstalled, setIsPWAInstalled] = useState<boolean>(false);
  const [isPushSupported, setIsPushSupported] = useState<boolean>(false);
  const [isPushSubscribed, setIsPushSubscribed] = useState<boolean>(false);

  // Load initial household & users
  const refreshHouseholdsAndUsers = async () => {
    try {
      const households = await api.getHouseholds();
      if (households.length > 0) {
        const savedHouseholdId = localStorage.getItem('famkit_household_id');
        const activeHousehold =
          households.find((h) => h.id === savedHouseholdId) || households[0];
        setHouseholdState(activeHousehold);
        localStorage.setItem('famkit_household_id', activeHousehold.id);

        const householdUsers = await api.getUsers(activeHousehold.id);
        setUsers(householdUsers);

        const savedUserId = localStorage.getItem('famkit_user_id');
        const activeUser =
          householdUsers.find((u) => u.id === savedUserId) || householdUsers[0] || null;
        setCurrentUserState(activeUser);
        if (activeUser) {
          localStorage.setItem('famkit_user_id', activeUser.id);
        }

        const householdAisles = await api.getAisles(activeHousehold.id);
        setAisles(householdAisles);
      }
    } catch (err) {
      console.error('Failed to load initial data:', err);
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

  const setCurrentUser = (u: User) => {
    setCurrentUserState(u);
    localStorage.setItem('famkit_user_id', u.id);
  };

  useEffect(() => {
    refreshHouseholdsAndUsers();

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
        installPWA,
        subscribeToPush,
        setCurrentUser,
        setHousehold,
        refreshHouseholdsAndUsers,
        refreshAisles,
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
