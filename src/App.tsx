import React, { useState, useEffect } from 'react';
import { PWAProvider } from './context/PWAContext';
import { Navbar } from './components/Navbar';
import { MobileNav } from './components/MobileNav';
import { AssistantPage } from './pages/AssistantPage';
import { GroceryPage } from './pages/GroceryPage';
import { MealsPage } from './pages/MealsPage';
import { RecipesPage } from './pages/RecipesPage';
import { CalendarPage } from './pages/CalendarPage';
import { SettingsPage } from './pages/SettingsPage';
import { LandingPage } from './pages/LandingPage';
import { LegalPage } from './pages/LegalPage';
import { AuthPage } from './components/AuthPage';
import { usePWA } from './context/PWAContext';
import { Loader2, ArrowRight } from 'lucide-react';

const VALID_TABS = ['assistant', 'grocery', 'meals', 'recipes', 'calendar', 'settings', 'family'];
const LAST_TAB_KEY = 'homebase_last_active_tab';

function resolveInitialLegalView(): 'privacy' | 'terms' | null {
  if (typeof window === 'undefined') return null;
  try {
    const p = window.location.pathname.toLowerCase();
    if (p === '/privacy' || p.startsWith('/privacy')) return 'privacy';
    if (p === '/terms' || p.startsWith('/terms')) return 'terms';
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'privacy') return 'privacy';
    if (params.get('view') === 'terms') return 'terms';
  } catch {}
  return null;
}

function resolveInitialTab(): string {
  if (typeof window === 'undefined') return 'assistant';

  try {
    const params = new URLSearchParams(window.location.search);
    const pathname = window.location.pathname.toLowerCase();

    // 1. Google OAuth return or explicit settings request
    if (
      params.has('google_sync') ||
      params.get('tab') === 'settings' ||
      pathname.startsWith('/settings')
    ) {
      return 'settings';
    }

    // 2. Explicit tab query parameter (e.g. /?tab=calendar)
    const tabParam = params.get('tab');
    if (tabParam && VALID_TABS.includes(tabParam)) {
      return tabParam;
    }

    // 3. PWA recipe share target
    const shared = params.get('shared');
    const sharedUrl = params.get('url') || params.get('text');
    if (shared || sharedUrl || pathname.startsWith('/recipes')) {
      return 'recipes';
    }

    // 4. Specific known path shortcuts
    if (pathname.startsWith('/grocery')) return 'grocery';
    if (pathname.startsWith('/meals') || pathname.startsWith('/meal-planner')) return 'meals';
    if (pathname.startsWith('/calendar')) return 'calendar';

    // 5. Restore user's last visited tab from previous session
    const saved = localStorage.getItem(LAST_TAB_KEY);
    if (saved && VALID_TABS.includes(saved)) {
      return saved;
    }
  } catch {}

  return 'assistant';
}

export const AppContent: React.FC = () => {
  const { currentUser, isLoadingAuth } = usePWA();
  const [activeTab, setActiveTabState] = useState<string>(resolveInitialTab);
  const [legalView, setLegalView] = useState<'privacy' | 'terms' | null>(resolveInitialLegalView);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return (
        params.has('auth') ||
        params.has('login') ||
        params.has('register') ||
        params.has('join')
      );
    }
    return false;
  });
  const [authInitialTab, setAuthInitialTab] = useState<'login' | 'register'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.has('register') || params.has('join') ? 'register' : 'login';
    }
    return 'login';
  });
  const [showLandingForUser, setShowLandingForUser] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('landing') === 'true' || params.get('view') === 'about';
    }
    return false;
  });

  const setActiveTab = (tab: string) => {
    setActiveTabState(tab);
    try {
      localStorage.setItem(LAST_TAB_KEY, tab);
    } catch {}
  };

  // Intercept global link clicks to /privacy and /terms and handle browser back/forward
  useEffect(() => {
    const handleLocationChange = () => {
      setLegalView(resolveInitialLegalView());
    };

    const handleLinkClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('a');
      if (!target) return;
      const href = target.getAttribute('href');
      if (href === '/privacy' || href?.startsWith('/privacy')) {
        e.preventDefault();
        window.history.pushState({}, '', '/privacy');
        setLegalView('privacy');
      } else if (href === '/terms' || href?.startsWith('/terms')) {
        e.preventDefault();
        window.history.pushState({}, '', '/terms');
        setLegalView('terms');
      }
    };

    window.addEventListener('popstate', handleLocationChange);
    document.addEventListener('click', handleLinkClick);

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      document.removeEventListener('click', handleLinkClick);
    };
  }, []);

  // Handle URL parameters for PWA share_target and OAuth callbacks
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (
      window.location.pathname.startsWith('/settings') ||
      params.has('google_sync') ||
      params.get('tab') === 'settings'
    ) {
      setActiveTab('settings');
    }
    const shared = params.get('shared');
    const sharedUrl = params.get('url') || params.get('text');
    if (shared || sharedUrl) {
      setActiveTab('recipes');
    }
  }, []);

  // Top priority: If user navigated to Privacy Policy or Terms of Service
  if (legalView) {
    return (
      <LegalPage
        type={legalView}
        onBack={() => {
          setLegalView(null);
          if (window.history.length > 1) {
            window.history.back();
          } else {
            window.history.pushState({}, '', '/');
          }
        }}
      />
    );
  }

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-3 text-emerald-400">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="text-xs text-slate-400 font-medium">Loading Homebase...</span>
      </div>
    );
  }

  // If user is not logged in: Show the public Landing Page by default
  if (!currentUser) {
    if (showAuthModal) {
      return (
        <AuthPage
          initialTab={authInitialTab}
          onBackToLanding={() => setShowAuthModal(false)}
        />
      );
    }
    return (
      <LandingPage
        onOpenAuth={(mode) => {
          setAuthInitialTab(mode || 'login');
          setShowAuthModal(true);
        }}
      />
    );
  }

  // If logged in, but specifically requested to see the Landing Page / Install guide
  if (showLandingForUser) {
    return (
      <div className="relative">
        <LandingPage onOpenAuth={() => setShowLandingForUser(false)} />
        <div className="fixed bottom-6 right-6 z-50">
          <button
            onClick={() => setShowLandingForUser(false)}
            className="px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 text-xs font-bold shadow-xl shadow-emerald-500/25 flex items-center gap-2 transition-all hover:scale-105 cursor-pointer"
          >
            <span>Return to App</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-slate-100 flex flex-col selection:bg-emerald-500/30 selection:text-emerald-300">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 w-full overflow-x-hidden">
        {activeTab === 'assistant' && <AssistantPage />}
        {activeTab === 'grocery' && <GroceryPage />}
        {activeTab === 'meals' && <MealsPage />}
        {activeTab === 'recipes' && <RecipesPage />}
        {activeTab === 'calendar' && <CalendarPage />}
        {(activeTab === 'settings' || activeTab === 'family') && <SettingsPage />}
      </main>

      <MobileNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
};

export function App() {
  return (
    <PWAProvider>
      <AppContent />
    </PWAProvider>
  );
}

export default App;
