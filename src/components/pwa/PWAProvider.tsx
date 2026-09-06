'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { FamilyMember, HouseholdData } from '@/types';

interface PWAContextType {
  isInstallable: boolean;
  installApp: () => Promise<void>;
  isPushSupported: boolean;
  isPushSubscribed: boolean;
  subscribeToPush: () => Promise<boolean>;
  activeMember: FamilyMember | null;
  setActiveMember: (member: FamilyMember) => void;
  household: HouseholdData | null;
  setHousehold: (household: HouseholdData) => void;
  apiKey: string;
  setApiKey: (key: string) => void;
  refreshFamily: () => Promise<void>;
}

const PWAContext = createContext<PWAContextType>({
  isInstallable: false,
  installApp: async () => {},
  isPushSupported: false,
  isPushSubscribed: false,
  subscribeToPush: async () => false,
  activeMember: null,
  setActiveMember: () => {},
  household: null,
  setHousehold: () => {},
  apiKey: '',
  setApiKey: () => {},
  refreshFamily: async () => {},
});

export const usePWA = () => useContext(PWAContext);

export function PWAProvider({ children }: { children: React.ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isPushSupported, setIsPushSupported] = useState(false);
  const [isPushSubscribed, setIsPushSubscribed] = useState(false);
  const [household, setHousehold] = useState<HouseholdData | null>(null);
  const [activeMember, setActiveMember] = useState<FamilyMember | null>(null);
  const [apiKey, setApiKey] = useState<string>('');

  // 1. Service Worker & Install Prompt
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Load saved API key from localStorage
      const savedKey = localStorage.getItem('famkit_api_key') || '';
      setApiKey(savedKey);

      // Register SW
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => {
            console.log('SW registered successfully:', reg.scope);
            checkPushSubscription(reg);
          })
          .catch((err) => console.warn('SW registration failed:', err));
      }

      // Check Push support
      if ('PushManager' in window && 'Notification' in window) {
        setIsPushSupported(true);
      }

      // Capture beforeinstallprompt
      const handleBeforeInstall = (e: any) => {
        e.preventDefault();
        setDeferredPrompt(e);
        setIsInstallable(true);
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstall);

      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      };
    }
  }, []);

  // 2. Fetch Household & Members
  const refreshFamily = async () => {
    try {
      const res = await fetch('/api/family');
      if (res.ok) {
        const data = await res.json();
        setHousehold(data);

        // Restore active member or select first
        const savedMemberId = localStorage.getItem('famkit_active_member');
        if (data.members && data.members.length > 0) {
          const matched = data.members.find((m: FamilyMember) => m.id === savedMemberId);
          const current = matched || data.members[0];
          setActiveMember(current);
          localStorage.setItem('famkit_active_member', current.id);
        }
      }
    } catch (err) {
      console.warn('Error fetching family:', err);
    }
  };

  useEffect(() => {
    refreshFamily();
  }, []);

  const handleSetActiveMember = (member: FamilyMember) => {
    setActiveMember(member);
    localStorage.setItem('famkit_active_member', member.id);
  };

  const handleSetApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('famkit_api_key', key);
  };

  // Check current push subscription
  const checkPushSubscription = async (reg: ServiceWorkerRegistration) => {
    try {
      const sub = await reg.pushManager.getSubscription();
      setIsPushSubscribed(!!sub);
    } catch (err) {
      console.warn('Error checking push subscription:', err);
    }
  };

  // PWA Install action
  const installApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
      setDeferredPrompt(null);
    }
  };

  // Subscribe to Push Notifications
  const subscribeToPush = async (): Promise<boolean> => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('Push notifications are not supported in this browser.');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        alert('Notification permission was denied. Please enable notifications in your browser settings.');
        return false;
      }

      const reg = await navigator.serviceWorker.ready;
      const keyRes = await fetch('/api/push');
      const { publicKey } = await keyRes.json();

      if (!publicKey) throw new Error('No VAPID public key available');

      // Convert URL-safe base64 to Uint8Array
      const padding = '='.repeat((4 - (publicKey.length % 4)) % 4);
      const base64 = (publicKey + padding).replace(/-/g, '+').replace(/_/g, '/');
      const rawData = window.atob(base64);
      const applicationServerKey = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) {
        applicationServerKey[i] = rawData.charCodeAt(i);
      }

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      // Send subscription to backend
      const res = await fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription,
          userId: activeMember?.id,
        }),
      });

      if (res.ok) {
        setIsPushSubscribed(true);
        return true;
      }
      return false;
    } catch (err: any) {
      console.error('Failed to subscribe to push notifications:', err);
      alert(`Error subscribing: ${err.message}`);
      return false;
    }
  };

  return (
    <PWAContext.Provider
      value={{
        isInstallable,
        installApp,
        isPushSupported,
        isPushSubscribed,
        subscribeToPush,
        activeMember,
        setActiveMember: handleSetActiveMember,
        household,
        setHousehold,
        apiKey,
        setApiKey: handleSetApiKey,
        refreshFamily,
      }}
    >
      {children}
    </PWAContext.Provider>
  );
}
