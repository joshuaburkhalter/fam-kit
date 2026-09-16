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
  installPWA: () => Promise<void>;
  isPushSupported: boolean;
  isPushSubscribed: boolean;
  apiKey: string;
  setApiKey: (key: string) => void;
  isLoadingAuth: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (data: {
    username: string;
    name?: string;
    email?: string;
    password?: string;
    avatarColor?: string;
    role?: string;
    action: 'create_household' | 'join_household';
    householdName?: string;
    inviteCode?: string;
  }) => Promise<void>;
  logout: () => void;
  isPushSupported: boolean;
  isPushSubscribed: boolean;
  pushPermission: NotificationPermission | 'unsupported';
  subscribeToPush: () => Promise<boolean>;
  unsubscribeFromPush: () => Promise<boolean>;
  setHousehold: (household: Household) => void;
  refreshHouseholdsAndUsers: () => Promise<void>;
  refreshAisles: () => Promise<void>;
  autoAudioResponses: boolean;
  setAutoAudioResponses: (enabled: boolean) => void;
  updateProfile: (data: {
    name?: string;
    username?: string;
    email?: string;
    avatar?: string;
    avatarColor?: string;
    role?: string;
    password?: string;
  }) => Promise<User>;
  switchUser: (user: User) => void;
}

const normalizeUser = (u: any): User | null => {
  if (!u) return null;
  const isPhoto = u.avatar && typeof u.avatar === 'string' && (u.avatar.startsWith('data:image') || u.avatar.startsWith('http'));
  const userColor = u.avatar_color || u.color || u.avatarColor || '#10b981';
  return {
    id: u.id,
    household_id: u.household_id || u.householdId || '',
    name: u.name,
    username: u.username || undefined,
    email: u.email || undefined,
    avatar: isPhoto ? u.avatar : undefined,
    avatar_color: userColor,
    role: (u.role?.toLowerCase() as any) || 'member',
    created_at: u.created_at || u.createdAt || '',
  };
};

function saveDeviceProfile(user: User, householdName?: string) {
  try {
    const stored = localStorage.getItem('famkit_device_profiles');
    let list: Array<{
      id: string;
      name: string;
      username?: string;
      avatar?: string;
      avatar_color: string;
      role: string;
      householdId?: string;
      householdName?: string;
    }> = stored ? JSON.parse(stored) : [];

    const existingIndex = list.findIndex((p) => p.id === user.id);
    const profileEntry = {
      id: user.id,
      name: user.name,
      username: user.username,
      avatar: user.avatar,
      avatar_color: user.avatar_color,
      role: user.role,
      householdId: user.household_id,
      householdName: householdName || undefined,
    };

    if (existingIndex >= 0) {
      list[existingIndex] = profileEntry;
    } else {
      list.unshift(profileEntry);
    }
    list = list.slice(0, 10);
    localStorage.setItem('famkit_device_profiles', JSON.stringify(list));
  } catch (err) {
    console.warn('Failed to save device profile:', err);
  }
}

const normalizeHousehold = (h: any): Household | null => {
  if (!h) return null;
  const code = h.invite_code || h.inviteCode || '';
  return {
    id: h.id,
    name: h.name,
    invite_code: code,
    inviteCode: code,
    created_at: h.created_at || h.createdAt || '',
  };
};

const PWAContext = createContext<PWAContextType | undefined>(undefined);

export const PWAProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [household, setHouseholdState] = useState<Household | null>(() => {
    try {
      const cached = localStorage.getItem('famkit_household');
      if (cached) return normalizeHousehold(JSON.parse(cached));
    } catch {}
    const cachedId = localStorage.getItem('famkit_household_id');
    if (cachedId) {
      return { id: cachedId, name: 'My Family', invite_code: '', created_at: '' };
    }
    return null;
  });
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUserState] = useState<User | null>(() => {
    try {
      const cached = localStorage.getItem('famkit_current_user');
      if (cached) return normalizeUser(JSON.parse(cached));
    } catch {}
    return null;
  });
  const [aisles, setAisles] = useState<Aisle[]>([]);
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [canInstallPWA, setCanInstallPWA] = useState<boolean>(false);
  const [isPWAInstalled, setIsPWAInstalled] = useState<boolean>(false);
  const [isPushSupported, setIsPushSupported] = useState<boolean>(false);
  const [isPushSubscribed, setIsPushSubscribed] = useState<boolean>(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  );
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
    const normalized = normalizeHousehold(h);
    setHouseholdState(normalized);
    if (normalized) {
      localStorage.setItem('famkit_household_id', normalized.id);
      localStorage.setItem('famkit_household', JSON.stringify(normalized));
    }
    refreshHouseholdsAndUsers();
  };

  const login = async (identifier: string, password: string) => {
    const res = await api.login(identifier, password);
    localStorage.setItem('famkit_auth_token', res.token);
    localStorage.setItem('famkit_user_id', res.user.id);
    localStorage.setItem('famkit_household_id', res.household.id);

    const normUser = normalizeUser(res.user);
    const normH = normalizeHousehold(res.household);
    setCurrentUserState(normUser);
    setHouseholdState(normH);

    if (normH) {
      localStorage.setItem('famkit_household', JSON.stringify(normH));
    }

    if (normUser) {
      localStorage.setItem('famkit_current_user', JSON.stringify(normUser));
      localStorage.setItem('famkit_last_username', normUser.username || normUser.name);
      saveDeviceProfile(normUser, res.household?.name);
    }

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
    username: string;
    name?: string;
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

    const normUser = normalizeUser(res.user);
    const normH = normalizeHousehold(res.household);
    setCurrentUserState(normUser);
    setHouseholdState(normH);

    if (normH) {
      localStorage.setItem('famkit_household', JSON.stringify(normH));
    }

    if (normUser) {
      localStorage.setItem('famkit_current_user', JSON.stringify(normUser));
      localStorage.setItem('famkit_last_username', normUser.username || normUser.name);
      saveDeviceProfile(normUser, res.household?.name);
    }

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
    localStorage.removeItem('famkit_household');
    localStorage.removeItem('famkit_current_user');
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
            const normUser = normalizeUser(user);
            const normH = normalizeHousehold(h);
            setCurrentUserState(normUser);
            setHouseholdState(normH);
            if (normH) {
              localStorage.setItem('famkit_household', JSON.stringify(normH));
              localStorage.setItem('famkit_household_id', normH.id);
            }
            if (normUser) {
              localStorage.setItem('famkit_user_id', normUser.id);
              localStorage.setItem('famkit_current_user', JSON.stringify(normUser));
              localStorage.setItem('famkit_last_username', normUser.username || normUser.name);
              saveDeviceProfile(normUser, h.name);
            }

            const [householdUsers, householdAisles] = await Promise.all([
              api.getUsers(h.id),
              api.getAisles(h.id),
            ]);
            setUsers(householdUsers);
            setAisles(householdAisles);
          } else {
            logout();
          }
        } catch (err: any) {
          console.warn('Auth check network warning:', err);
          // Only log out if the server explicitly rejected the token with 401
          if (String(err?.message || err).includes('401')) {
            logout();
          }
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

    // Service worker & update management
    if ('serviceWorker' in navigator) {
      if (import.meta.env.DEV) {
        // In local development, unregister any lingering service workers and clear caches
        navigator.serviceWorker.getRegistrations().then((regs) => {
          regs.forEach((r) => r.unregister());
        });
        if ('caches' in window) {
          caches.keys().then((names) => {
            names.forEach((name) => caches.delete(name));
          });
        }
      } else {
        // In production, register sw.js and automatically activate updates
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => {
            reg.update().catch(() => {});
            if (reg.waiting) {
              reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
            reg.addEventListener('updatefound', () => {
              const installing = reg.installing;
              if (installing) {
                installing.addEventListener('statechange', () => {
                  if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                    installing.postMessage({ type: 'SKIP_WAITING' });
                  }
                });
              }
            });
          })
          .catch((e) => {
            console.debug('Service worker registration note:', e);
          });
      }
    }

    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setIsPushSupported(true);
      if (typeof Notification !== 'undefined') {
        setPushPermission(Notification.permission);
      }
      navigator.serviceWorker.ready.then(async (reg) => {
        const sub = await reg.pushManager.getSubscription();
        setIsPushSubscribed(!!sub);
        // If device has a subscription and user is in a household, ensure backend has it recorded
        if (sub && household?.id) {
          api.subscribePush({
            householdId: household.id,
            userId: currentUser?.id,
            subscription: sub.toJSON(),
          }).catch(() => {});
        }
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
      setPushPermission(permission);
      if (permission !== 'granted') {
        return false;
      }

      const { publicKey } = await api.getVapidPublicKey();
      const swUrl = import.meta.env.DEV ? '/sw-push.js' : '/sw.js';
      await navigator.serviceWorker.register(swUrl);
      const reg = await navigator.serviceWorker.ready;

      // Cleanly replace any previous subscription so new VAPID keys take effect
      const existingSub = await reg.pushManager.getSubscription();
      if (existingSub) {
        try {
          await existingSub.unsubscribe();
        } catch {}
      }

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

  const unsubscribeFromPush = async (): Promise<boolean> => {
    if (!isPushSupported) return false;
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          const endpoint = sub.endpoint;
          await sub.unsubscribe();
          await api.unsubscribePush(endpoint, currentUser?.id);
        } else if (currentUser?.id) {
          await api.unsubscribePush(undefined, currentUser.id);
        }
      }
      setIsPushSubscribed(false);
      return true;
    } catch (err) {
      console.error('Push unsubscription failed:', err);
      return false;
    }
  };

  const updateProfile = async (data: {
    name?: string;
    username?: string;
    email?: string;
    avatar?: string;
    avatarColor?: string;
    role?: string;
    password?: string;
  }): Promise<User> => {
    if (!currentUser) throw new Error('Not logged in');
    const updated = await api.updateUserProfile({
      userId: currentUser.id,
      ...data,
    });
    const normUser = normalizeUser(updated);
    if (normUser) {
      setCurrentUserState(normUser);
      setUsers((prev) => prev.map((u) => (u.id === normUser.id ? normUser : u)));
      localStorage.setItem('famkit_current_user', JSON.stringify(normUser));
      localStorage.setItem('famkit_last_username', normUser.username || normUser.name);
      saveDeviceProfile(normUser, household?.name);
      return normUser;
    }
    return updated;
  };

  const switchUser = (user: User) => {
    const normUser = normalizeUser(user);
    if (!normUser) return;
    setCurrentUserState(normUser);
    localStorage.setItem('famkit_user_id', normUser.id);
    localStorage.setItem('famkit_auth_token', normUser.id);
    localStorage.setItem('famkit_current_user', JSON.stringify(normUser));
    localStorage.setItem('famkit_last_username', normUser.username || normUser.name);
    saveDeviceProfile(normUser, household?.name);
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
        pushPermission,
        apiKey,
        setApiKey,
        isLoadingAuth,
        login,
        register,
        logout,
        installPWA,
        subscribeToPush,
        unsubscribeFromPush,
        setHousehold,
        refreshHouseholdsAndUsers,
        refreshAisles,
        autoAudioResponses,
        setAutoAudioResponses,
        updateProfile,
        switchUser,
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
