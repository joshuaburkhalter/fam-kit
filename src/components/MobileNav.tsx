import React from 'react';
import {
  Sparkles,
  ShoppingCart,
  ChefHat,
  Calendar,
} from 'lucide-react';

interface MobileNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: 'grocery', label: 'Lists', icon: ShoppingCart },
    { id: 'meals', label: 'Meals', icon: ChefHat },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 glass-panel border-t border-white/10 px-2 h-[76px] flex items-center pb-safe">
      <div className="w-full flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center py-1 px-2 sm:px-3 rounded-2xl transition-all duration-200 relative ${
                isActive ? 'scale-105' : 'text-slate-400 hover:text-slate-200 opacity-70'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                  isActive
                    ? 'bg-gradient-to-tr from-emerald-400 to-teal-300 text-slate-950 shadow-lg shadow-emerald-500/20'
                    : 'bg-transparent text-slate-400'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
              </div>
              <span
                className={`text-[10px] font-semibold tracking-tight mt-0.5 ${
                  isActive ? 'text-emerald-400' : 'text-slate-400'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
