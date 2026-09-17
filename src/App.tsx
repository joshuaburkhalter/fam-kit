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
import { PricingPage } from './pages/PricingPage';
import { PaywallModal } from './components/PaywallModal';
import { AuthPage } from './components/AuthPage';
import { usePWA } from './context/PWAContext';
import { Loader2, ArrowRight, CheckCircle2, X } from 'lucide-react';

const VALID_TABS = ['assistant', 'grocery', 'meals', 'recipes', 'calendar', 'settings', 'family'];
const LAST_TAB_KEY = 'homebase_last_active_tab';

function resolveInitialOverlayView(): 'privacy' | 'terms' | 'pricing' | null {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    // If returning from Stripe checkout, dismiss any overlay to display app dashboard
    if (params.has('stripe_session_id') || params.get('stripe_status') === 'success') {
      return null;
    }

    const p = window.location.pathname.toLowerCase();
    if (p === '/privacy' || p.startsWith('/privacy')) return 'privacy';
    if (p === '/terms' || p.startsWith('/terms')) return 'terms';
    if (p === '/pricing' || p.startsWith('/pricing')) return 'pricing';
    if (params.get('view') === 'privacy') return 'privacy';
    if (params.get('view') === 'terms') return 'terms';
    if (params.get('view') === 'pricing' || params.get('tab') === 'pricing') return 'pricing';
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
  const { currentUser, isLoadingAuth, hasActiveAccess, verifyCheckoutSession } = usePWA();
  const [activeTab, setActiveTabState] = useState<string>(resolveInitialTab);
  const [overlayView, setOverlayView] = useState<'privacy' | 'terms' | 'pricing' | null>(resolveInitialOverlayView);
  const [stripeSuccessMessage, setStripeSuccessMessage] = useState<string | null>(null);
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

  // Intercept global link clicks to /privacy, /terms, /pricing and handle browser back/forward
  useEffect(() => {
    const handleLocationChange = () => {
      setOverlayView(resolveInitialOverlayView());
    };

    const handleLinkClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('a');
      if (!target) return;
      const href = target.getAttribute('href');
      if (href === '/privacy' || href?.startsWith('/privacy')) {
        e.preventDefault();
        window.history.pushState({}, '', '/privacy');
        setOverlayView('privacy');
      } else if (href === '/terms' || href?.startsWith('/terms')) {
        e.preventDefault();
        window.history.pushState({}, '', '/terms');
        setOverlayView('terms');
      } else if (href === '/pricing' || href?.startsWith('/pricing')) {
        e.preventDefault();
        window.history.pushState({}, '', '/pricing');
        setOverlayView('pricing');
      }
    };

    window.addEventListener('popstate', handleLocationChange);
    document.addEventListener('click', handleLinkClick);

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      document.removeEventListener('click', handleLinkClick);
    };
  }, []);

  // Handle URL parameters for PWA share_target, OAuth callbacks, and Stripe Checkout returns
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

    // Stripe checkout return verification
    const stripeSessionId = params.get('stripe_session_id') || params.get('session_id');
    const stripeStatus = params.get('stripe_status');
    if (stripeSessionId) {
      verifyCheckoutSession(stripeSessionId)
        .then((res) => {
          if (res.success) {
            setOverlayView(null);
            setStripeSuccessMessage(res.message || 'Payment confirmed! Welcome to Homebase.');
            // Clean up query string and reset path to root
            window.history.replaceState({}, document.title, '/');
          }
        })
        .catch((err) => {
          console.error('Failed to verify Stripe session:', err);
        });
    } else if (stripeStatus === 'success') {
      setOverlayView(null);
      setStripeSuccessMessage('Payment confirmed! Welcome to Homebase.');
      window.history.replaceState({}, document.title, '/');
    }
  }, [verifyCheckoutSession]);

  // Top priority overlay views: Privacy Policy, Terms of Service, or Pricing
  if (overlayView === 'privacy' || overlayView === 'terms') {
    return (
      <LegalPage
        type={overlayView}
        onBack={() => {
          setOverlayView(null);
          if (window.history.length > 1) {
            window.history.back();
          } else {
            window.history.pushState({}, '', '/');
          }
        }}
      />
    );
  }

  if (overlayView === 'pricing') {
    return (
      <PricingPage
        onBack={() => {
          setOverlayView(null);
          if (window.history.length > 1) {
            window.history.back();
          } else {
            window.history.pushState({}, '', '/');
          }
        }}
        onOpenAuth={(mode) => {
          setAuthInitialTab(mode || 'login');
          setShowAuthModal(true);
          setOverlayView(null);
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
        onOpenPricing={() => {
          window.history.pushState({}, '', '/pricing');
          setOverlayView('pricing');
        }}
      />
    );
  }

  // If user is logged in, but their household does not have active subscription / voucher access -> Paywall
  if (!hasActiveAccess) {
    return (
      <PaywallModal
        onOpenPricingDetails={() => {
          window.history.pushState({}, '', '/pricing');
          setOverlayView('pricing');
        }}
      />
    );
  }

  // If logged in and active, but specifically requested to see the Landing Page / Install guide
  if (showLandingForUser) {
    return (
      <div className="relative">
        <LandingPage
          onOpenAuth={() => setShowLandingForUser(false)}
          onOpenPricing={() => {
            window.history.pushState({}, '', '/pricing');
            setOverlayView('pricing');
          }}
        />
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

  const handleOpenPricing = () => {
    window.history.pushState({}, '', '/pricing');
    setOverlayView('pricing');
  };

  return (
    <div className="min-h-screen bg-background text-slate-100 flex flex-col selection:bg-emerald-500/30 selection:text-emerald-300">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} onOpenPricing={handleOpenPricing} />

      {stripeSuccessMessage && (
        <div className="fixed top-20 right-4 z-50 max-w-md bg-emerald-500 text-slate-950 px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-md flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top duration-300">
          <div className="flex items-center gap-2 text-xs font-bold">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{stripeSuccessMessage}</span>
          </div>
          <button
            onClick={() => setStripeSuccessMessage(null)}
            className="p-1 rounded-lg hover:bg-black/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <main className="flex-1 w-full overflow-x-hidden">
        {activeTab === 'assistant' && <AssistantPage />}
        {activeTab === 'grocery' && <GroceryPage />}
        {activeTab === 'meals' && <MealsPage />}
        {activeTab === 'recipes' && <RecipesPage />}
        {activeTab === 'calendar' && <CalendarPage />}
        {(activeTab === 'settings' || activeTab === 'family') && (
          <SettingsPage onOpenPricing={handleOpenPricing} />
        )}
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
