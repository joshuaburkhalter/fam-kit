import React, { useState, useEffect } from 'react';
import { PWAProvider } from './context/PWAContext';
import { Navbar } from './components/Navbar';
import { MobileNav } from './components/MobileNav';
import { AssistantPage } from './pages/AssistantPage';
import { GroceryPage } from './pages/GroceryPage';
import { MealPlannerPage } from './pages/MealPlannerPage';
import { RecipesPage } from './pages/RecipesPage';
import { CalendarPage } from './pages/CalendarPage';
import { FamilyPage } from './pages/FamilyPage';
import { SettingsPage } from './pages/SettingsPage';

export const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('assistant');

  // Handle URL parameters for PWA share_target (when sharing a recipe link from mobile browser/Instagram/TikTok)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shared = params.get('shared');
    const sharedUrl = params.get('url') || params.get('text');
    if (shared || sharedUrl) {
      setActiveTab('recipes');
    }
  }, []);

  return (
    <div className="min-h-screen bg-background text-slate-100 flex flex-col selection:bg-emerald-500/30 selection:text-emerald-300">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 w-full overflow-x-hidden">
        {activeTab === 'assistant' && <AssistantPage />}
        {activeTab === 'grocery' && <GroceryPage />}
        {activeTab === 'meals' && <MealPlannerPage />}
        {activeTab === 'recipes' && <RecipesPage />}
        {activeTab === 'calendar' && <CalendarPage />}
        {activeTab === 'family' && <FamilyPage />}
        {activeTab === 'settings' && <SettingsPage />}
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
