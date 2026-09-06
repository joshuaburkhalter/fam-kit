'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sparkles,
  ShoppingCart,
  UtensilsCrossed,
  BookOpen,
  Calendar,
  Users
} from 'lucide-react';

export default function MobileNav() {
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: 'Assistant', icon: Sparkles },
    { href: '/grocery', label: 'Grocery', icon: ShoppingCart },
    { href: '/meal-planner', label: 'Meals', icon: UtensilsCrossed },
    { href: '/recipes', label: 'Recipes', icon: BookOpen },
    { href: '/calendar', label: 'Calendar', icon: Calendar },
    { href: '/family', label: 'Family', icon: Users },
  ];

  return (
    <div className="md:hidden fixed bottom-3 left-3 right-3 z-40">
      <nav className="glass-dock rounded-3xl p-1.5 flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-2 px-2.5 rounded-2xl transition-all duration-200 ${
                isActive
                  ? 'text-emerald-400 font-bold bg-emerald-500/15 shadow-inner scale-105'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-emerald-400 animate-pulse' : 'text-slate-400'}`} />
              <span className="text-[10px] tracking-tight mt-0.5">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
