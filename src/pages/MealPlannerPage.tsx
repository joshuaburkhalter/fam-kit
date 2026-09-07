import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  Plus,
  Trash2,
  ChefHat,
  Sparkles,
  ShoppingCart,
  Check,
  ChevronLeft,
  ChevronRight,
  BookOpen,
} from 'lucide-react';
import {
  format,
  addDays,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
} from 'date-fns';
import type { MealPlan, Recipe } from '../types';
import { usePWA } from '../context/PWAContext';
import { api } from '../lib/api';

export const MealPlannerPage: React.FC = () => {
  const { household } = usePWA();
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [selectedMealType, setSelectedMealType] = useState<string>('dinner');
  const [mealTitle, setMealTitle] = useState('');
  const [selectedRecipeId, setSelectedRecipeId] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const daysInWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const loadData = async () => {
    if (!household) return;
    setIsLoading(true);
    try {
      const [meals, recipeList] = await Promise.all([
        api.getMealPlans(
          household.id,
          format(weekStart, 'yyyy-MM-dd'),
          format(weekEnd, 'yyyy-MM-dd')
        ),
        api.getRecipes(household.id),
      ]);
      setMealPlans(meals);
      setRecipes(recipeList);
    } catch (err) {
      console.error('Failed to load meal planner:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [household, currentDate]);

  const handleAddMeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!household || (!mealTitle.trim() && !selectedRecipeId)) return;

    let finalTitle = mealTitle.trim();
    if (selectedRecipeId && !finalTitle) {
      const rec = recipes.find((r) => r.id === selectedRecipeId);
      if (rec) finalTitle = rec.title;
    }

    try {
      const newPlan = await api.createMealPlan(household.id, {
        date: selectedDate,
        meal_type: selectedMealType,
        title: finalTitle,
        recipe_id: selectedRecipeId || undefined,
      });

      setMealPlans((prev) => [...prev, newPlan]);
      setMealTitle('');
      setSelectedRecipeId('');
      setIsAddModalOpen(false);
    } catch (err) {
      console.error('Failed to add meal plan:', err);
    }
  };

  const handleDeleteMeal = async (id: string) => {
    try {
      setMealPlans((prev) => prev.filter((m) => m.id !== id));
      await api.deleteMealPlan(id);
    } catch (err) {
      console.error('Failed to delete meal plan:', err);
      loadData();
    }
  };

  const handleExportToGrocery = async () => {
    if (!household) return;
    setIsExporting(true);
    setExportSuccess(null);
    try {
      const res = await api.exportMealPlanToGrocery(
        household.id,
        format(weekStart, 'yyyy-MM-dd'),
        format(weekEnd, 'yyyy-MM-dd')
      );
      setExportSuccess(`Added ${res.itemsAdded} ingredients to your Grocery List!`);
      setTimeout(() => setExportSuccess(null), 4000);
    } catch (err: any) {
      console.error('Export failed:', err);
      alert(err.message || 'Failed to export ingredients');
    } finally {
      setIsExporting(false);
    }
  };

  const mealTypes = [
    { id: 'breakfast', label: 'Breakfast', emoji: '🍳' },
    { id: 'lunch', label: 'Lunch', emoji: '🥪' },
    { id: 'dinner', label: 'Dinner', emoji: '🍲' },
    { id: 'snack', label: 'Snack / Treat', emoji: '🍎' },
  ];

  return (
    <div className="max-w-6xl mx-auto p-2 sm:p-4 pb-24 md:pb-12 space-y-4">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-3xl glass-panel border border-white/10">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            Weekly Meal Planner
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Plan breakfast, lunch, and dinner, then export ingredients with 1 tap
          </p>
        </div>

        {/* Action Buttons & Week navigation */}
        <div className="flex items-center flex-wrap gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-2xl border border-white/10">
            <button
              onClick={() => setCurrentDate(addDays(currentDate, -7))}
              className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-slate-200 px-2 font-mono">
              {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
            </span>
            <button
              onClick={() => setCurrentDate(addDays(currentDate, 7))}
              className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={handleExportToGrocery}
            disabled={isExporting}
            className="bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 px-3.5 py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-500/20"
          >
            <ShoppingCart className="w-4 h-4" />
            {isExporting ? 'Exporting...' : 'Add Ingredients to Grocery List'}
          </button>
        </div>
      </div>

      {exportSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center gap-2 text-emerald-400 text-xs font-semibold animate-in fade-in">
          <Check className="w-4 h-4" />
          {exportSuccess}
        </div>
      )}

      {/* 7-Day Meal Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {daysInWeek.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const isToday = isSameDay(day, new Date());
          const dayMeals = mealPlans.filter((m) => m.date === dateStr);

          return (
            <div
              key={dateStr}
              className={`rounded-3xl glass-panel p-3 border flex flex-col min-h-[300px] transition-all ${
                isToday
                  ? 'border-emerald-500/40 ring-1 ring-emerald-500/20 shadow-lg shadow-emerald-500/5'
                  : 'border-white/10'
              }`}
            >
              {/* Day Header */}
              <div className="flex items-center justify-between pb-2 border-b border-white/5 mb-2">
                <div>
                  <div
                    className={`text-xs font-bold ${
                      isToday ? 'text-emerald-400' : 'text-slate-200'
                    }`}
                  >
                    {format(day, 'EEEE')}
                  </div>
                  <div className="text-[11px] font-mono text-slate-500">
                    {format(day, 'MMM d')}
                  </div>
                </div>

                <button
                  onClick={() => {
                    setSelectedDate(dateStr);
                    setIsAddModalOpen(true);
                  }}
                  className="p-1 rounded-xl bg-white/5 hover:bg-emerald-500/20 hover:text-emerald-400 text-slate-400 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Meal Cards for this Day */}
              <div className="flex-1 space-y-2">
                {dayMeals.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-[11px] text-slate-600 italic">
                    No meals scheduled
                  </div>
                ) : (
                  dayMeals.map((meal) => (
                    <div
                      key={meal.id}
                      className="p-2.5 rounded-2xl bg-slate-900/80 border border-white/5 hover:border-white/15 transition-all group"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] uppercase font-bold text-amber-400">
                          {meal.meal_type}
                        </span>
                        <button
                          onClick={() => handleDeleteMeal(meal.id)}
                          className="p-0.5 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="text-xs font-bold text-slate-100 mt-0.5 leading-snug">
                        {meal.title}
                      </div>
                      {meal.recipe_id && (
                        <div className="text-[10px] text-pink-400 flex items-center gap-1 mt-1 font-medium">
                          <BookOpen className="w-3 h-3" />
                          Recipe Linked
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Meal Plan Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="glass-panel w-full max-w-md rounded-3xl p-6 shadow-2xl border border-white/10 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <ChefHat className="w-5 h-5 text-emerald-400" />
              Plan Meal for {format(new Date(selectedDate + 'T00:00:00'), 'EEEE, MMM d')}
            </h3>

            <form onSubmit={handleAddMeal} className="space-y-3">
              {/* Meal Type selector */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Meal Slot
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {mealTypes.map((mt) => (
                    <button
                      type="button"
                      key={mt.id}
                      onClick={() => setSelectedMealType(mt.id)}
                      className={`p-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border ${
                        selectedMealType === mt.id
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-sm'
                          : 'bg-slate-900 border-white/5 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span>{mt.emoji}</span>
                      <span>{mt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Link from Recipe Box */}
              {recipes.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Choose from Recipe Box (Optional)
                  </label>
                  <select
                    value={selectedRecipeId}
                    onChange={(e) => {
                      setSelectedRecipeId(e.target.value);
                      if (e.target.value) {
                        const rec = recipes.find((r) => r.id === e.target.value);
                        if (rec) setMealTitle(rec.title);
                      }
                    }}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">-- Custom Meal / Not in Recipe Box --</option>
                    {recipes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Meal Name */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Meal Title / Dish
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Homemade Margherita Pizza, Taco Tuesday..."
                  value={mealTitle}
                  onChange={(e) => setMealTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!mealTitle.trim() && !selectedRecipeId}
                  className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold px-5 py-2 rounded-xl text-xs shadow-lg shadow-emerald-500/20"
                >
                  Save Meal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
