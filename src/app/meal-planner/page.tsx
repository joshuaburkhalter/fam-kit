'use client';

import React, { useState, useEffect } from 'react';
import { usePWA } from '@/components/pwa/PWAProvider';
import { MealPlanData, RecipeData } from '@/types';
import {
  UtensilsCrossed,
  ChevronLeft,
  ChevronRight,
  Plus,
  Sparkles,
  ShoppingCart,
  Calendar,
  BookOpen,
  X,
  Trash2
} from 'lucide-react';

export default function MealPlannerPage() {
  const { activeMember, apiKey } = usePWA();
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [mealPlans, setMealPlans] = useState<MealPlanData[]>([]);
  const [recipes, setRecipes] = useState<RecipeData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Edit slot modal
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; dayName: string; mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'; existing?: MealPlanData } | null>(null);
  const [slotTitle, setSlotTitle] = useState('');
  const [slotNotes, setSlotNotes] = useState('');
  const [slotRecipeId, setSlotRecipeId] = useState<string>('');

  // AI Brainstorm Modal
  const [showBrainstormModal, setShowBrainstormModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('Plan healthy, kid-friendly dinners for this week with 1 pasta night, 1 seafood night, and quick 30-minute meals.');
  const [isBrainstorming, setIsBrainstorming] = useState(false);

  // Calculate dates for 7-day week (Monday to Sunday)
  const getWeekDates = (offset: number) => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const distanceToMonday = (dayOfWeek + 6) % 7;

    const monday = new Date(today);
    monday.setDate(today.getDate() - distanceToMonday + offset * 7);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push({
        dateStr: d.toISOString().split('T')[0],
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        fullDayName: d.toLocaleDateString('en-US', { weekday: 'long' }),
        formatted: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        isToday: d.toDateString() === today.toDateString(),
      });
    }
    return days;
  };

  const weekDays = getWeekDates(currentWeekOffset);
  const startDate = weekDays[0].dateStr;
  const endDate = weekDays[6].dateStr;

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [mealsRes, recipesRes] = await Promise.all([
        fetch(`/api/meal-planner?startDate=${startDate}&endDate=${endDate}`),
        fetch('/api/recipes'),
      ]);

      if (mealsRes.ok) {
        const data = await mealsRes.json();
        setMealPlans(data);
      }
      if (recipesRes.ok) {
        const data = await recipesRes.json();
        setRecipes(data);
      }
    } catch (err) {
      console.error('Failed to load meal plans:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentWeekOffset]);

  const handleOpenSlot = (date: string, dayName: string, mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack') => {
    const existing = mealPlans.find((m) => m.date === date && m.mealType === mealType);
    setSelectedSlot({ date, dayName, mealType, existing });
    setSlotTitle(existing?.title || '');
    setSlotNotes(existing?.notes || '');
    setSlotRecipeId(existing?.recipeId || '');
  };

  const handleSaveSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot || !slotTitle.trim()) return;

    try {
      const res = await fetch('/api/meal-planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedSlot.date,
          mealType: selectedSlot.mealType,
          title: slotTitle.trim(),
          notes: slotNotes.trim() || undefined,
          recipeId: slotRecipeId || undefined,
        }),
      });

      if (res.ok) {
        const saved = await res.json();
        setMealPlans((prev) => {
          const filtered = prev.filter(
            (m) => !(m.date === selectedSlot.date && m.mealType === selectedSlot.mealType)
          );
          return [...filtered, saved];
        });
        setSelectedSlot(null);
      }
    } catch (err) {
      console.error('Failed to save meal plan slot:', err);
    }
  };

  const handleClearSlot = async (id: string) => {
    setMealPlans((prev) => prev.filter((m) => m.id !== id));
    setSelectedSlot(null);
    try {
      await fetch(`/api/meal-planner?id=${id}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Failed to delete slot:', err);
    }
  };

  const handleExportIngredients = async (recipe: RecipeData) => {
    try {
      let ings = [];
      try {
        ings = JSON.parse(recipe.ingredients);
      } catch {
        ings = [{ item: recipe.ingredients }];
      }

      await fetch('/api/meal-planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'export_ingredients',
          ingredients: ings,
          addedById: activeMember?.id,
        }),
      });
      alert(`Ingredients for "${recipe.title}" added to your Grocery List!`);
    } catch (err) {
      console.error('Export error:', err);
    }
  };

  const handleAiBrainstorm = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsBrainstorming(true);

    try {
      const prompt = `Please plan dinner for each day of the week from ${startDate} to ${endDate}.
Preferences: ${aiPrompt}
Assign one meal to each day with date in YYYY-MM-DD format.`;

      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          customApiKey: apiKey,
          activeMemberId: activeMember?.id,
        }),
      });

      if (res.ok) {
        setShowBrainstormModal(false);
        await fetchData();
      }
    } catch (err) {
      console.error('AI Brainstorm error:', err);
    } finally {
      setIsBrainstorming(false);
    }
  };

  const mealSlots: { type: 'breakfast' | 'lunch' | 'dinner' | 'snack'; label: string; icon: string }[] = [
    { type: 'breakfast', label: 'Breakfast', icon: '🍳' },
    { type: 'lunch', label: 'Lunch', icon: '🥪' },
    { type: 'dinner', label: 'Dinner', icon: '🍲' },
    { type: 'snack', label: 'Snack', icon: '🍎' },
  ];

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-md shadow-amber-500/25">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Weekly Meal Planner
              </h1>
              <p className="text-xs text-slate-400">
                Plan weekly breakfasts, lunches, and dinners, and export ingredients in 1 tap.
              </p>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBrainstormModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-bold shadow-md shadow-emerald-600/30 transition-all hover:scale-105"
          >
            <Sparkles className="w-4 h-4" />
            <span>AI Brainstorm Week</span>
          </button>
        </div>
      </div>

      {/* Week Navigator */}
      <div className="flex items-center justify-between p-3.5 rounded-3xl anylist-card border border-slate-800 shadow-md">
        <button
          onClick={() => setCurrentWeekOffset((prev) => prev - 1)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-slate-900/90 border border-slate-700/80 text-slate-300 hover:text-white text-xs font-bold transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Previous Week</span>
        </button>

        <div className="text-center">
          <div className="text-sm font-extrabold text-slate-100">
            {weekDays[0].formatted} – {weekDays[6].formatted}
          </div>
          {currentWeekOffset === 0 && (
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Current Week</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {currentWeekOffset !== 0 && (
            <button
              onClick={() => setCurrentWeekOffset(0)}
              className="px-3 py-2 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold"
            >
              Today
            </button>
          )}
          <button
            onClick={() => setCurrentWeekOffset((prev) => prev + 1)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-slate-900/90 border border-slate-700/80 text-slate-300 hover:text-white text-xs font-bold transition-colors"
          >
            <span className="hidden sm:inline">Next Week</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 7-Day Grid */}
      {isLoading ? (
        <div className="p-16 text-center text-slate-500 text-sm animate-pulse">
          Loading weekly meal plan...
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3.5">
          {weekDays.map((day) => {
            const dayMeals = mealPlans.filter((m) => m.date === day.dateStr);

            return (
              <div
                key={day.dateStr}
                className={`rounded-3xl border flex flex-col overflow-hidden transition-all shadow-md ${
                  day.isToday
                    ? 'anylist-card border-emerald-500/50 shadow-emerald-950/40 ring-1 ring-emerald-500/30'
                    : 'anylist-card border-slate-800/80'
                }`}
              >
                {/* Day Header */}
                <div
                  className={`p-3 text-center border-b ${
                    day.isToday
                      ? 'bg-emerald-500/20 border-emerald-500/30'
                      : 'bg-slate-950/70 border-slate-800'
                  }`}
                >
                  <div className="font-extrabold text-sm text-slate-100 flex items-center justify-center gap-1.5">
                    <span>{day.fullDayName}</span>
                    {day.isToday && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">{day.formatted}</div>
                </div>

                {/* Slots per day */}
                <div className="p-2 space-y-2 flex-1 flex flex-col justify-between">
                  {mealSlots.map((slot) => {
                    const meal = dayMeals.find((m) => m.mealType === slot.type);

                    return (
                      <div
                        key={slot.type}
                        onClick={() => handleOpenSlot(day.dateStr, day.fullDayName, slot.type)}
                        className={`p-2.5 rounded-2xl border transition-all cursor-pointer group flex flex-col justify-between min-h-[72px] ${
                          meal
                            ? 'bg-slate-900/90 border-slate-700/80 hover:border-emerald-500/60 text-slate-200 shadow-sm'
                            : 'bg-slate-950/40 border-slate-900/70 hover:border-slate-700 hover:bg-slate-900/40 text-slate-500'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-1">
                          <span className="flex items-center gap-1">
                            <span>{slot.icon}</span>
                            <span>{slot.label}</span>
                          </span>
                          {!meal && <Plus className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-emerald-400" />}
                        </div>

                        {meal ? (
                          <div className="space-y-1">
                            <div className="text-xs font-bold text-slate-100 line-clamp-2 group-hover:text-emerald-300 transition-colors">
                              {meal.title}
                            </div>
                            {meal.recipe && (
                              <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
                                <BookOpen className="w-3 h-3" />
                                <span>Recipe Linked</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] italic text-slate-600">Plan meal...</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Meal Slot Modal */}
      {selectedSlot && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-extrabold text-base sm:text-lg text-white capitalize">
                  Plan {selectedSlot.mealType}
                </h3>
                <p className="text-xs text-slate-400">
                  {selectedSlot.dayName} ({selectedSlot.date})
                </p>
              </div>
              <button
                onClick={() => setSelectedSlot(null)}
                className="p-1.5 rounded-2xl text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSlot} className="mt-4 space-y-4">
              {recipes.length > 0 && (
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">
                    Pick from Saved Recipes
                  </label>
                  <select
                    value={slotRecipeId}
                    onChange={(e) => {
                      const recId = e.target.value;
                      setSlotRecipeId(recId);
                      const rec = recipes.find((r) => r.id === recId);
                      if (rec) setSlotTitle(rec.title);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs text-white"
                  >
                    <option value="">-- Choose Recipe or Type Custom Below --</option>
                    {recipes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">
                  Meal / Dish Name
                </label>
                <input
                  type="text"
                  value={slotTitle}
                  onChange={(e) => setSlotTitle(e.target.value)}
                  placeholder="e.g. Creamy Tuscan Garlic Chicken"
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-emerald-500/50"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Notes / Instructions</label>
                <input
                  type="text"
                  value={slotNotes}
                  onChange={(e) => setSlotNotes(e.target.value)}
                  placeholder="e.g. Defrost chicken in morning"
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs text-white"
                />
              </div>

              {slotRecipeId && (
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      const rec = recipes.find((r) => r.id === slotRecipeId);
                      if (rec) handleExportIngredients(rec);
                    }}
                    className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 hover:bg-emerald-500/25 text-emerald-300 text-xs font-bold transition-all"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    <span>Export Recipe Ingredients to Grocery List</span>
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                {selectedSlot.existing ? (
                  <button
                    type="button"
                    onClick={() => handleClearSlot(selectedSlot.existing!.id)}
                    className="text-xs font-semibold text-rose-400 hover:text-rose-300 flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Clear Slot
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedSlot(null)}
                    className="px-4 py-2.5 rounded-2xl text-xs font-bold text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!slotTitle.trim()}
                    className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-extrabold shadow-md shadow-emerald-600/30"
                  >
                    Save Meal
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Brainstorm Modal */}
      {showBrainstormModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-extrabold text-base sm:text-lg text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                AI Weekly Meal Brainstormer
              </h3>
              <button
                onClick={() => setShowBrainstormModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAiBrainstorm} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1.5">
                  Preferences & Dietary Requests
                </label>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3.5 text-xs text-white focus:ring-2 focus:ring-emerald-500/50"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBrainstormModal(false)}
                  disabled={isBrainstorming}
                  className="px-4 py-2.5 rounded-2xl text-xs font-bold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isBrainstorming || !aiPrompt.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 disabled:opacity-40 text-white text-xs font-extrabold shadow-md shadow-emerald-600/30"
                >
                  {isBrainstorming ? (
                    <>
                      <Sparkles className="w-4 h-4 animate-spin text-white" />
                      <span>Planning Meals...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Generate Meal Plan</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
