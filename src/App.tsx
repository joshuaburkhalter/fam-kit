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
import { AuthPage } from './components/AuthPage';
import { usePWA } from './context/PWAContext';
import { Loader2 } from 'lucide-react';

const VALID_TABS = ['assistant', 'grocery', 'meals', 'recipes', 'calendar', 'settings', 'family'];
const LAST_TAB_KEY = 'homebase_last_active_tab';

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

  const setActiveTab = (tab: string) => {
    setActiveTabState(tab);
    try {
      localStorage.setItem(LAST_TAB_KEY, tab);
    } catch {}
  };

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

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-3 text-emerald-400">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="text-xs text-slate-400 font-medium">Loading Homebase...</span>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthPage />;
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
