import React, { useState, useEffect, useRef } from 'react';
import {
  ChefHat,
  Utensils,
  Calendar,
  Plus,
  Trash2,
  Check,
  CheckCircle2,
  Clock,
  BookOpen,
  ShoppingCart,
  ChevronLeft,
  ChevronRight,
  X,
  History,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import {
  format,
  startOfWeek,
  endOfWeek,
  addDays,
  isToday,
  isYesterday,
  parseISO,
} from 'date-fns';
import type { WeeklyMeal, MealLog, Recipe } from '../types';
import { usePWA } from '../context/PWAContext';
import { api } from '../lib/api';
import { useFabAutoClose } from '../hooks/useFabAutoClose';

interface MealsDataCache {
  householdId: string;
  weekStartStr: string;
  weeklyMeals: WeeklyMeal[];
  mealLogs: MealLog[];
  recipes: Recipe[];
}

let mealsDataCache: MealsDataCache | null = null;

export const MealsPage: React.FC = () => {
  const { household, users, currentUser } = usePWA();
  const householdId = household?.id;
  const isMountedRef = useRef(true);

  const [currentWeekDate, setCurrentWeekDate] = useState<Date>(new Date());
  const weekStart = startOfWeek(currentWeekDate, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(currentWeekDate, { weekStartsOn: 1 });
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');

  const [weeklyMeals, setWeeklyMeals] = useState<WeeklyMeal[]>(() => {
    return mealsDataCache && mealsDataCache.householdId === householdId && mealsDataCache.weekStartStr === weekStartStr
      ? mealsDataCache.weeklyMeals
      : [];
  });
  const [mealLogs, setMealLogs] = useState<MealLog[]>(() => {
    return mealsDataCache && mealsDataCache.householdId === householdId
      ? mealsDataCache.mealLogs
      : [];
  });
  const [recipes, setRecipes] = useState<Recipe[]>(() => {
    return mealsDataCache && mealsDataCache.householdId === householdId
      ? mealsDataCache.recipes
      : [];
  });
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    return !(mealsDataCache && mealsDataCache.householdId === householdId && mealsDataCache.weekStartStr === weekStartStr);
  });

  // Tab State: 'week' = This Week's Meals, 'log' = Cooking Log
  const [activeTab, setActiveTab] = useState<'week' | 'log'>('week');

  // Filter for weekly meals: 'all' | 'unmade' | 'made'
  const [weeklyFilter, setWeeklyFilter] = useState<'all' | 'unmade' | 'made'>('all');

  // Modal State for manual Log a Meal
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [logMealTitle, setLogMealTitle] = useState('');
  const [logMealDate, setLogMealDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [logMealRecipeId, setLogMealRecipeId] = useState('');
  const [logMealNotes, setLogMealNotes] = useState('');

  // Recipe Picker Modal for adding a recipe to this week
  const [isRecipePickerOpen, setIsRecipePickerOpen] = useState(false);

  // Quick Add FAB Dock State
  const [isQuickAddExpanded, setIsQuickAddExpanded] = useState(false);
  const [quickInput, setQuickInput] = useState('');

  const dockRef = useFabAutoClose<HTMLDivElement>({
    isOpen: isQuickAddExpanded,
    onClose: () => setIsQuickAddExpanded(false),
    ignore: isRecipePickerOpen || isLogModalOpen,
  });

  // Export Toast
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Date selection for "Log as Made" popover / dropdown per meal
  const [markingMealId, setMarkingMealId] = useState<string | null>(null);
  const [customMadeDate, setCustomMadeDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadData = async (showLoading = false) => {
    if (!householdId) return;
    if (showLoading) {
      setIsLoading(true);
    }
    try {
      const [weekData, logsData, recipesData] = await Promise.all([
        api.getWeeklyMeals(householdId, weekStartStr),
        api.getMealLogs(householdId),
        api.getRecipes(householdId),
      ]);
      if (!isMountedRef.current) return;

      mealsDataCache = {
        householdId,
        weekStartStr,
        weeklyMeals: weekData,
        mealLogs: logsData,
        recipes: recipesData,
      };

      setWeeklyMeals(weekData);
      setMealLogs(logsData);
      setRecipes(recipesData);
    } catch (err) {
      console.error('Failed to load meals data:', err);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!householdId) return;
    const hasCache =
      mealsDataCache &&
      mealsDataCache.householdId === householdId &&
      mealsDataCache.weekStartStr === weekStartStr;
    loadData(!hasCache);
  }, [householdId, weekStartStr]);

  const updateCache = (newMeals?: WeeklyMeal[], newLogs?: MealLog[], newRecipes?: Recipe[]) => {
    if (!householdId) return;
    mealsDataCache = {
      householdId,
      weekStartStr,
      weeklyMeals: newMeals ?? (mealsDataCache?.weeklyMeals || []),
      mealLogs: newLogs ?? (mealsDataCache?.mealLogs || []),
      recipes: newRecipes ?? (mealsDataCache?.recipes || []),
    };
  };

  // Add meal to week
  const handleAddWeeklyMeal = async (title: string, recipeId?: string) => {
    if (!household || !title.trim()) return;
    try {
      const created = await api.addWeeklyMeal(household.id, {
        title: title.trim(),
        recipe_id: recipeId,
        week_start_date: weekStartStr,
      });
      setWeeklyMeals((prev) => {
        const next = [...prev, created];
        updateCache(next);
        return next;
      });
      setQuickInput('');
      setIsQuickAddExpanded(false);
      setIsRecipePickerOpen(false);
    } catch (err) {
      console.error('Failed to add weekly meal:', err);
    }
  };

  const handleQuickAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickInput.trim()) return;
    handleAddWeeklyMeal(quickInput.trim());
  };

  // Delete weekly meal
  const handleDeleteWeeklyMeal = async (id: string) => {
    try {
      setWeeklyMeals((prev) => {
        const next = prev.filter((m) => m.id !== id);
        updateCache(next);
        return next;
      });
      await api.deleteWeeklyMeal(id);
    } catch (err) {
      console.error('Failed to delete meal:', err);
      loadData();
    }
  };

  // Log as Made (from weekly meal)
  const handleMarkAsMade = async (meal: WeeklyMeal, dateToLog?: string) => {
    if (!household) return;
    const finalDate = dateToLog || format(new Date(), 'yyyy-MM-dd');
    try {
      // Create meal log entry & mark weekly meal as made
      const newLog = await api.logMealMade(household.id, {
        title: meal.title,
        recipe_id: meal.recipe_id,
        date: finalDate,
        cooked_by_user_id: currentUser?.id,
        weekly_meal_id: meal.id,
      });

      // Update state locally
      setMealLogs((prev) => {
        const next = [newLog, ...prev];
        updateCache(undefined, next);
        return next;
      });
      setWeeklyMeals((prev) => {
        const next = prev.map((m) =>
          m.id === meal.id ? { ...m, is_made: true, made_date: finalDate } : m
        );
        updateCache(next);
        return next;
      });
      setMarkingMealId(null);
    } catch (err) {
      console.error('Failed to log meal as made:', err);
    }
  };

  // Unmark as Made
  const handleUnmarkAsMade = async (meal: WeeklyMeal) => {
    try {
      await api.updateWeeklyMeal(meal.id, { is_made: false, made_date: undefined });
      setWeeklyMeals((prev) => {
        const next = prev.map((m) =>
          m.id === meal.id ? { ...m, is_made: false, made_date: undefined } : m
        );
        updateCache(next);
        return next;
      });
    } catch (err) {
      console.error('Failed to unmark meal:', err);
    }
  };

  // Manual Log a Meal
  const handleManualLogMeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!household || (!logMealTitle.trim() && !logMealRecipeId)) return;

    let title = logMealTitle.trim();
    if (logMealRecipeId && !title) {
      const rec = recipes.find((r) => r.id === logMealRecipeId);
      if (rec) title = rec.title;
    }

    try {
      const newLog = await api.logMealMade(household.id, {
        title,
        recipe_id: logMealRecipeId || undefined,
        date: logMealDate,
        notes: logMealNotes.trim() || undefined,
        cooked_by_user_id: currentUser?.id,
      });

      setMealLogs((prev) => {
        const next = [newLog, ...prev];
        updateCache(undefined, next);
        return next;
      });
      setLogMealTitle('');
      setLogMealRecipeId('');
      setLogMealNotes('');
      setIsLogModalOpen(false);
    } catch (err) {
      console.error('Failed to manually log meal:', err);
    }
  };

  // Delete log entry
  const handleDeleteLogEntry = async (id: string) => {
    try {
      setMealLogs((prev) => {
        const next = prev.filter((l) => l.id !== id);
        updateCache(undefined, next);
        return next;
      });
      await api.deleteMealLog(id);
    } catch (err) {
      console.error('Failed to delete meal log:', err);
      loadData();
    }
  };

  // Export single recipe ingredients to grocery list
  const handleExportRecipeIngredients = async (recipeId: string) => {
    if (!household) return;
    setIsExporting(true);
    try {
      const recipe = recipes.find((r) => r.id === recipeId);
      if (!recipe) return;
      const res = await api.exportRecipeToGrocery(household.id, recipe);
      setExportSuccess(`Added ${res.addedCount} ingredients for "${recipe.title}" to your Grocery List!`);
      setTimeout(() => setExportSuccess(null), 4000);
    } catch (err: any) {
      console.error('Failed to export ingredients:', err);
      alert('Failed to export ingredients to grocery list.');
    } finally {
      setIsExporting(false);
    }
  };

  // Export all weekly meals to grocery list
  const handleExportAllToGrocery = async () => {
    if (!household || weeklyMeals.length === 0) return;
    setIsExporting(true);
    let totalAdded = 0;
    try {
      for (const meal of weeklyMeals) {
        if (meal.recipe_id) {
          const recipe = recipes.find((r) => r.id === meal.recipe_id);
          if (recipe) {
            const res = await api.exportRecipeToGrocery(household.id, recipe);
            totalAdded += res.addedCount;
          }
        }
      }
      setExportSuccess(`Added ${totalAdded} ingredients to your Grocery List!`);
      setTimeout(() => setExportSuccess(null), 4000);
    } catch (err) {
      console.error('Failed to export all ingredients:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Filtered weekly meals
  const filteredWeeklyMeals = weeklyMeals.filter((m) => {
    if (weeklyFilter === 'unmade') return !m.is_made;
    if (weeklyFilter === 'made') return m.is_made;
    return true;
  });

  const unmadeCount = weeklyMeals.filter((m) => !m.is_made).length;
  const madeCount = weeklyMeals.filter((m) => m.is_made).length;

  // Group meal logs by date
  const groupedLogs = mealLogs.reduce<Record<string, MealLog[]>>((acc, log) => {
    const key = log.date;
    if (!acc[key]) acc[key] = [];
    acc[key].push(log);
    return acc;
  }, {});

  const sortedLogDates = Object.keys(groupedLogs).sort((a, b) => b.localeCompare(a));

  const formatLogDateHeader = (dateStr: string) => {
    try {
      const d = parseISO(dateStr);
      if (isToday(d)) return `Today • ${format(d, 'EEEE, MMM d')}`;
      if (isYesterday(d)) return `Yesterday • ${format(d, 'EEEE, MMM d')}`;
      return format(d, 'EEEE, MMMM d, yyyy');
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-2 sm:p-4 pb-36 md:pb-28 space-y-4">
      {/* Top Banner */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 p-4 rounded-3xl glass-panel border border-white/10">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            Weekly Meals & Cooking Log
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Plan your meals for the week, choose what to make each day, and track what was made
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center flex-wrap gap-2 w-full lg:w-auto justify-between lg:justify-end">
          {/* Week Navigator */}
          <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-2xl border border-white/10">
            <button
              onClick={() => setCurrentWeekDate(addDays(currentWeekDate, -7))}
              className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              title="Previous Week"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-slate-200 px-2 font-mono">
              {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d')}
            </span>
            <button
              onClick={() => setCurrentWeekDate(addDays(currentWeekDate, 7))}
              className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              title="Next Week"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Export to Grocery */}
          {activeTab === 'week' && weeklyMeals.some((m) => m.recipe_id) && (
            <button
              onClick={handleExportAllToGrocery}
              disabled={isExporting}
              className="bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white px-3 py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-all shrink-0"
              title="Add ingredients of all weekly recipes to Grocery list"
            >
              <ShoppingCart className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Add Ingredients to Grocery</span>
            </button>
          )}

          {/* Primary Action Button */}
          {activeTab === 'week' ? (
            <button
              onClick={() => setIsRecipePickerOpen(true)}
              className="bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 px-3.5 py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-500/20 shrink-0"
            >
              <BookOpen className="w-4 h-4" />
              <span>Pick From Recipes</span>
            </button>
          ) : (
            <button
              onClick={() => setIsLogModalOpen(true)}
              className="bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 px-3.5 py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-500/20 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Log a Meal Made</span>
            </button>
          )}
        </div>
      </div>

      {/* Export Toast Banner */}
      {exportSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center gap-2 text-emerald-400 text-xs font-semibold animate-in fade-in">
          <Check className="w-4 h-4" />
          {exportSuccess}
        </div>
      )}

      {/* View Switcher: "This Week's Meals" vs "Cooking Log" */}
      <div className="flex flex-wrap items-center justify-between gap-3 glass-panel p-2 rounded-2xl border border-white/10">
        <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-white/10">
          <button
            onClick={() => setActiveTab('week')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === 'week'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ChefHat className="w-4 h-4" />
            <span>This Week's Meals</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 font-mono">
              {unmadeCount}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('log')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === 'log'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Cooking Log</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 font-mono">
              {mealLogs.length}
            </span>
          </button>
        </div>

        {/* Sub-filter for Week view: All / To Cook / Made */}
        {activeTab === 'week' && weeklyMeals.length > 0 && (
          <div className="flex items-center gap-1 bg-slate-900/70 p-1 rounded-xl border border-white/5">
            <button
              onClick={() => setWeeklyFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                weeklyFilter === 'all'
                  ? 'bg-white/15 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({weeklyMeals.length})
            </button>
            <button
              onClick={() => setWeeklyFilter('unmade')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                weeklyFilter === 'unmade'
                  ? 'bg-white/15 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              To Cook ({unmadeCount})
            </button>
            <button
              onClick={() => setWeeklyFilter('made')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                weeklyFilter === 'made'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Made ({madeCount})
            </button>
          </div>
        )}
      </div>

      {/* TAB 1: THIS WEEK'S MEALS */}
      {activeTab === 'week' && (
        <div className="space-y-3">
          {isLoading && filteredWeeklyMeals.length === 0 ? (
            <div className="py-16 text-center glass-panel rounded-3xl p-8 border border-white/5 space-y-3">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-400 mx-auto" />
              <p className="text-xs text-slate-400">Loading meals for the week...</p>
            </div>
          ) : filteredWeeklyMeals.length === 0 ? (
            <div className="rounded-3xl glass-panel border border-white/10 p-10 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
                <ChefHat className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white">No meals planned for this week yet</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Add meal ideas using the bottom bar, or tap "Pick From Recipes" to choose from your Recipe Box. When you decide to cook a meal, simply tap "Log as Made"!
              </p>
              <div className="pt-2">
                <button
                  onClick={() => setIsRecipePickerOpen(true)}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-500/20"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Browse Recipes to Plan</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredWeeklyMeals.map((meal) => {
                const linkedRecipe = recipes.find((r) => r.id === meal.recipe_id);
                const isMarkingThis = markingMealId === meal.id;

                return (
                  <div
                    key={meal.id}
                    className={`rounded-3xl glass-panel p-4 border transition-all flex flex-col justify-between gap-3 ${
                      meal.is_made
                        ? 'border-emerald-500/30 bg-emerald-950/10'
                        : 'border-white/10 hover:border-white/20'
                    }`}
                  >
                    {/* Top row: Title + Actions */}
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3
                            className={`text-sm font-bold tracking-tight ${
                              meal.is_made ? 'text-emerald-300 line-through' : 'text-white'
                            }`}
                          >
                            {meal.title}
                          </h3>
                          {linkedRecipe && (
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] font-semibold text-pink-400 flex items-center gap-1 bg-pink-500/10 px-2 py-0.5 rounded-md border border-pink-500/20">
                                <BookOpen className="w-2.5 h-2.5" />
                                Recipe Box
                              </span>
                              {(linkedRecipe.cook_time_minutes || linkedRecipe.prep_time_minutes) && (
                                <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                                  <Clock className="w-2.5 h-2.5" />
                                  {(linkedRecipe.prep_time_minutes || 0) + (linkedRecipe.cook_time_minutes || 0)}m
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Delete button */}
                        <button
                          onClick={() => handleDeleteWeeklyMeal(meal.id)}
                          className="p-1.5 rounded-xl text-slate-500 hover:text-red-400 hover:bg-white/5 transition-colors shrink-0"
                          title="Remove from week"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Bottom row: Made Status & Action Button */}
                    <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2 flex-wrap">
                      {meal.is_made ? (
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1 bg-emerald-500/15 px-2.5 py-1 rounded-xl border border-emerald-500/30">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>
                              Made {meal.made_date ? `(${format(parseISO(meal.made_date), 'EEE, MMM d')})` : ''}
                            </span>
                          </span>
                          <button
                            onClick={() => handleUnmarkAsMade(meal)}
                            className="text-[11px] text-slate-400 hover:text-slate-200 underline cursor-pointer"
                          >
                            Unmark
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* 1-Tap Cooked Today */}
                          <button
                            onClick={() => handleMarkAsMade(meal, format(new Date(), 'yyyy-MM-dd'))}
                            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Made Today</span>
                          </button>

                          {/* Choose another day */}
                          <button
                            onClick={() => setMarkingMealId(isMarkingThis ? null : meal.id)}
                            className="text-[11px] text-slate-400 hover:text-white px-2 py-1.5 rounded-xl hover:bg-white/5 transition-colors"
                          >
                            {isMarkingThis ? 'Cancel' : 'Other Day...'}
                          </button>
                        </div>
                      )}

                      {/* Add Recipe Ingredients to Grocery */}
                      {linkedRecipe && (
                        <button
                          onClick={() => handleExportRecipeIngredients(linkedRecipe.id)}
                          disabled={isExporting}
                          className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-emerald-400 transition-colors shrink-0"
                          title="Add recipe ingredients to grocery list"
                        >
                          <ShoppingCart className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Choose custom date sub-panel */}
                    {isMarkingThis && !meal.is_made && (
                      <div className="mt-2 p-2.5 rounded-2xl bg-slate-900/90 border border-white/15 flex items-center gap-2 animate-in fade-in">
                        <span className="text-[11px] text-slate-300 font-medium">Date Made:</span>
                        <input
                          type="date"
                          value={customMadeDate}
                          onChange={(e) => setCustomMadeDate(e.target.value)}
                          className="bg-slate-800 border border-white/10 rounded-xl px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500"
                        />
                        <button
                          onClick={() => handleMarkAsMade(meal, customMadeDate)}
                          className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold px-2.5 py-1 rounded-xl"
                        >
                          Confirm
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: COOKING LOG (What was made which day) */}
      {activeTab === 'log' && (
        <div className="space-y-4">
          {isLoading && sortedLogDates.length === 0 ? (
            <div className="py-16 text-center glass-panel rounded-3xl p-8 border border-white/5 space-y-3">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-400 mx-auto" />
              <p className="text-xs text-slate-400">Loading cooking log...</p>
            </div>
          ) : sortedLogDates.length === 0 ? (
            <div className="rounded-3xl glass-panel border border-white/10 p-10 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto">
                <History className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white">No meals logged yet</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                When you cook a meal from this week's list, tap "Made Today" to record it here. You can also manually log any meal you make!
              </p>
              <div className="pt-2">
                <button
                  onClick={() => setIsLogModalOpen(true)}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-500/20"
                >
                  <Plus className="w-4 h-4" />
                  <span>Log a Meal Made</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedLogDates.map((dateStr) => {
                const logsForDate = groupedLogs[dateStr];
                return (
                  <div key={dateStr} className="space-y-2">
                    {/* Date Section Header */}
                    <div className="flex items-center gap-2 px-1">
                      <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                      <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                        {formatLogDateHeader(dateStr)}
                      </h4>
                      <div className="flex-1 border-t border-white/5" />
                    </div>

                    {/* Meal cards for this date */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {logsForDate.map((log) => {
                        const linkedRecipe = recipes.find((r) => r.id === log.recipe_id);
                        const cookedUser = users.find((u) => u.id === log.cooked_by_user_id);

                        return (
                          <div
                            key={log.id}
                            className="rounded-2xl glass-panel p-3.5 border border-white/10 hover:border-white/20 transition-all flex items-center justify-between gap-3 group"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                                <Utensils className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-white truncate">
                                  {log.title}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {linkedRecipe && (
                                    <span className="text-[10px] text-pink-400 font-medium flex items-center gap-1">
                                      <BookOpen className="w-2.5 h-2.5" /> Recipe
                                    </span>
                                  )}
                                  {cookedUser && (
                                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                      <span
                                        className="w-1.5 h-1.5 rounded-full"
                                        style={{ backgroundColor: cookedUser.avatar_color }}
                                      />
                                      {cookedUser.name}
                                    </span>
                                  )}
                                  {log.notes && (
                                    <span className="text-[10px] text-slate-400 italic truncate max-w-[150px]">
                                      "{log.notes}"
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1 shrink-0">
                              {/* Plan again this week button */}
                              <button
                                onClick={() => handleAddWeeklyMeal(log.title, log.recipe_id)}
                                className="p-1.5 rounded-xl bg-white/5 hover:bg-emerald-500/20 hover:text-emerald-400 text-slate-400 transition-colors"
                                title="Plan again this week"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>

                              {/* Delete log entry */}
                              <button
                                onClick={() => handleDeleteLogEntry(log.id)}
                                className="p-1.5 rounded-xl text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Delete log entry"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: RECIPE PICKER MODAL */}
      {isRecipePickerOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="glass-panel w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-white/10 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Pick From Recipe Box</h3>
                  <p className="text-[11px] text-slate-400">Add a saved family recipe to this week's plan</p>
                </div>
              </div>
              <button
                onClick={() => setIsRecipePickerOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {recipes.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  No recipes found in your Recipe Box. Import recipes or create them in the Recipes tab!
                </div>
              ) : (
                recipes.map((rec) => {
                  const isAlreadyPlanned = weeklyMeals.some((m) => m.recipe_id === rec.id);
                  const totalTime = (rec.prep_time_minutes || 0) + (rec.cook_time_minutes || 0);

                  return (
                    <div
                      key={rec.id}
                      onClick={() => handleAddWeeklyMeal(rec.title, rec.id)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isAlreadyPlanned
                          ? 'border-emerald-500/30 bg-emerald-950/20'
                          : 'border-white/10 hover:border-white/20 bg-slate-900/60 hover:bg-slate-800/80'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {rec.image_url ? (
                          <img
                            src={rec.image_url}
                            alt={rec.title}
                            className="w-10 h-10 rounded-xl object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-pink-500/10 text-pink-400 flex items-center justify-center shrink-0">
                            <ChefHat className="w-5 h-5" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">{rec.title}</div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                            {totalTime > 0 && <span>{totalTime} mins</span>}
                            <span>• {rec.ingredients.length} ingredients</span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {isAlreadyPlanned ? (
                          <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1 bg-emerald-500/20 px-2 py-1 rounded-lg">
                            <Check className="w-3 h-3" /> Planned
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold px-3 py-1.5 rounded-xl shadow-sm"
                          >
                            + Add
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: MANUAL LOG A MEAL MADE */}
      {isLogModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="glass-panel w-full max-w-md rounded-3xl p-6 shadow-2xl border border-white/10 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Utensils className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Log a Meal Made</h3>
                  <p className="text-[11px] text-slate-400">Record what was cooked on which day</p>
                </div>
              </div>
              <button
                onClick={() => setIsLogModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleManualLogMeal} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Date Made
                </label>
                <input
                  type="date"
                  required
                  value={logMealDate}
                  onChange={(e) => setLogMealDate(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {recipes.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Choose from Recipe Box (Optional)
                  </label>
                  <select
                    value={logMealRecipeId}
                    onChange={(e) => {
                      setLogMealRecipeId(e.target.value);
                      if (e.target.value) {
                        const rec = recipes.find((r) => r.id === e.target.value);
                        if (rec) setLogMealTitle(rec.title);
                      }
                    }}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">-- Custom Meal / Takeout / Spontaneous --</option>
                    {recipes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Dish / Meal Name
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Grilled Salmon with Rice, Homemade Tacos, Thai Takeout..."
                  value={logMealTitle}
                  onChange={(e) => setLogMealTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Notes / Who Cooked (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Made by Dad, everyone loved it, extra spicy"
                  value={logMealNotes}
                  onChange={(e) => setLogMealNotes(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsLogModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!logMealTitle.trim() && !logMealRecipeId}
                  className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold px-5 py-2 rounded-xl text-xs shadow-lg shadow-emerald-500/20"
                >
                  Save to Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Animated Expanding Quick Add Dock & FAB */}
      <div className="fixed bottom-[calc(76px+1rem+env(safe-area-inset-bottom,0px))] md:bottom-8 left-0 right-0 z-40 px-4 pointer-events-none">
        <div className="max-w-3xl mx-auto pointer-events-none flex justify-end">
          <div
            ref={dockRef}
            className={`fab-dock-transition pointer-events-auto h-[52px] border shadow-2xl flex items-center overflow-hidden ${
              isQuickAddExpanded
                ? 'w-full rounded-3xl border-white/25 bg-slate-900/95 backdrop-blur-xl shadow-emerald-500/10 px-2'
                : 'w-[52px] rounded-full border-emerald-400/40 bg-gradient-to-r from-emerald-500 to-teal-400 cursor-pointer shadow-xl shadow-emerald-500/30 hover:scale-105 active:scale-95 justify-center'
            }`}
          >
            {!isQuickAddExpanded ? (
              <button
                type="button"
                onClick={() => setIsQuickAddExpanded(true)}
                className="w-full h-full flex items-center justify-center text-slate-950"
                title="Add Meal"
              >
                <Plus className="w-6 h-6 stroke-[2.5]" />
              </button>
            ) : (
              <form onSubmit={handleQuickAddSubmit} className="w-full flex items-center gap-2">
                {/* 1. Far Left: Close Button */}
                <button
                  type="button"
                  onClick={() => setIsQuickAddExpanded(false)}
                  className="p-2 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white shrink-0"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* 2. Secondary Action: Pick from Recipe Box */}
                <button
                  type="button"
                  onClick={() => setIsRecipePickerOpen(true)}
                  className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-pink-400 hover:text-pink-300 shrink-0"
                  title="Pick recipe from Recipe Box"
                >
                  <BookOpen className="w-4 h-4" />
                </button>

                {/* 3. Middle: Input field */}
                <input
                  autoFocus
                  type="text"
                  placeholder="Add meal to this week (e.g. Chicken Parmigiana)..."
                  value={quickInput}
                  onChange={(e) => setQuickInput(e.target.value)}
                  className="flex-1 min-w-0 bg-transparent border-none text-sm text-white placeholder-slate-500 focus:outline-none py-2 px-1"
                />

                {/* 4. Far Right: Only the main action button */}
                <button
                  type="submit"
                  disabled={!quickInput.trim()}
                  className="p-2 sm:px-3.5 sm:py-2 rounded-2xl text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shrink-0 disabled:opacity-40 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 shadow-emerald-500/20"
                  title="Add Meal to Week"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Add</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
