import React, { useState, useEffect, useRef } from 'react';
import {
  ChefHat,
  Utensils,
  Calendar,
  Plus,
  Trash2,
  Check,
  Clock,
  BookOpen,
  ShoppingCart,
  X,
  History,
  RotateCcw,
  Loader2,
  Sparkles,
  ExternalLink,
  User,
  Users,
  Search,
  Zap,
  ChevronRight,
  Flame,
} from 'lucide-react';
import {
  format,
  isToday,
  isYesterday,
  parseISO,
  subDays,
} from 'date-fns';
import type { WeeklyMeal, MealLog, Recipe } from '../types';
import { usePWA } from '../context/PWAContext';
import { api } from '../lib/api';
import { CheckSparkle, triggerHapticCheck } from '../components/CheckSparkle';
import { Drawer } from '../components/ui/Drawer';

interface MealsDataCache {
  householdId: string;
  meals: WeeklyMeal[];
  mealLogs: MealLog[];
  recipes: Recipe[];
}

let mealsDataCache: MealsDataCache | null = null;

export const MealsPage: React.FC = () => {
  const { household, users, currentUser } = usePWA();
  const householdId = household?.id;
  const isMountedRef = useRef(true);

  const [meals, setMeals] = useState<WeeklyMeal[]>(() => {
    return mealsDataCache && mealsDataCache.householdId === householdId
      ? mealsDataCache.meals
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
    return !(mealsDataCache && mealsDataCache.householdId === householdId);
  });

  // Mobile Segmented Tab: 'shopped' (Recipes on hand to cook) | 'log' (What was made)
  const [activeTab, setActiveTab] = useState<'shopped' | 'log'>('shopped');

  // Modals (Native Mobile Bottom Sheets)
  const [viewingRecipe, setViewingRecipe] = useState<Recipe | null>(null);
  const [isRecipePickerOpen, setIsRecipePickerOpen] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [recipeSearch, setRecipeSearch] = useState('');
  const [checkedIngredients, setCheckedIngredients] = useState<Record<string, boolean>>({});
  const [recipeStepProgress, setRecipeStepProgress] = useState<Record<number, boolean>>({});
  const [justCompletedModalStep, setJustCompletedModalStep] = useState<number | null>(null);

  // Quick Date Picker Modal
  const [quickDateMeal, setQuickDateMeal] = useState<WeeklyMeal | null>(null);
  const [targetDate, setTargetDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Quick picker from log day header
  const [logDayPickerDate, setLogDayPickerDate] = useState<string | null>(null);

  // Manual Log Meal Modal Form
  const [logForm, setLogForm] = useState({
    title: '',
    recipeId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
    cookedByUserId: currentUser?.id || '',
  });

  // Quick custom dish input
  const [quickDishInput, setQuickDishInput] = useState('');
  const [isAddingQuick, setIsAddingQuick] = useState(false);

  // Notification Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<any>(null);

  const showToast = (msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  // Fetch Meals, Logs, and Recipes
  const fetchData = async (forceFresh = false) => {
    if (!householdId) return;
    if (!forceFresh && mealsDataCache && mealsDataCache.householdId === householdId) {
      setMeals(mealsDataCache.meals);
      setMealLogs(mealsDataCache.mealLogs);
      setRecipes(mealsDataCache.recipes);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }

    try {
      const [weeklyRes, logsRes, recRes] = await Promise.all([
        api.getWeeklyMeals(householdId),
        api.getMealLogs(householdId),
        api.getRecipes(householdId),
      ]);

      if (!isMountedRef.current) return;

      // Only unmade meals belong in the active shopped recipes list
      const unmadeMeals = weeklyRes.filter((m) => !m.is_made);
      setMeals(unmadeMeals);
      setMealLogs(logsRes);
      setRecipes(recRes);

      mealsDataCache = {
        householdId,
        meals: unmadeMeals,
        mealLogs: logsRes,
        recipes: recRes,
      };
    } catch (err) {
      console.error('Failed to load meals data', err);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchData();
  }, [householdId]);

  // Map recipeId -> Recipe for fast lookup
  const recipeMap = new Map<string, Recipe>();
  recipes.forEach((r) => recipeMap.set(r.id, r));

  /**
   * CORE ACTION: Mark meal as cooked on a given day.
   * Logs to Daily Cooking Log and removes it from the shopped list!
   */
  const handleMarkMealCooked = async (meal: WeeklyMeal, dateStr: string) => {
    if (!householdId) return;
    try {
      const newLog = await api.logMealMade(householdId, {
        title: meal.title,
        recipe_id: meal.recipe_id,
        date: dateStr,
        notes: meal.notes,
        cooked_by_user_id: currentUser?.id,
        weekly_meal_id: meal.id,
      });

      await api.deleteWeeklyMeal(meal.id);

      setMeals((prev) => prev.filter((m) => m.id !== meal.id));
      setMealLogs((prev) => [newLog, ...prev]);

      if (mealsDataCache && mealsDataCache.householdId === householdId) {
        mealsDataCache.meals = mealsDataCache.meals.filter((m) => m.id !== meal.id);
        mealsDataCache.mealLogs = [newLog, ...mealsDataCache.mealLogs];
      }

      setQuickDateMeal(null);
      setLogDayPickerDate(null);

      const dayLabel = isToday(parseISO(dateStr))
        ? 'Today'
        : isYesterday(parseISO(dateStr))
        ? 'Yesterday'
        : format(parseISO(dateStr), 'MMM d');

      showToast(`🎉 Added "${meal.title}" to ${dayLabel} & removed from shopped list!`);
    } catch (err) {
      console.error('Failed to record cooked meal', err);
      showToast('Error recording meal');
    }
  };

  // Move a logged meal back to the shopped recipes list (Undo action)
  const handleMoveBackToShopped = async (log: MealLog) => {
    if (!householdId) return;
    try {
      const added = await api.addWeeklyMeal(householdId, {
        title: log.title,
        recipe_id: log.recipe_id,
        notes: log.notes,
      });

      await api.deleteMealLog(log.id);

      setMeals((prev) => [added, ...prev]);
      setMealLogs((prev) => prev.filter((l) => l.id !== log.id));

      if (mealsDataCache && mealsDataCache.householdId === householdId) {
        mealsDataCache.meals = [added, ...mealsDataCache.meals];
        mealsDataCache.mealLogs = mealsDataCache.mealLogs.filter((l) => l.id !== log.id);
      }

      showToast(`↩ Returned "${log.title}" to shopped recipes!`);
    } catch (err) {
      console.error('Failed to move meal back', err);
    }
  };

  // Delete from shopped list
  const handleDeleteShoppedMeal = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await api.deleteWeeklyMeal(id);
      setMeals((prev) => prev.filter((m) => m.id !== id));
      if (mealsDataCache && mealsDataCache.householdId === householdId) {
        mealsDataCache.meals = mealsDataCache.meals.filter((m) => m.id !== id);
      }
      showToast('Removed from shopped recipes');
    } catch (err) {
      console.error('Failed to delete meal', err);
    }
  };

  // Delete log entry
  const handleDeleteLog = async (id: string) => {
    try {
      await api.deleteMealLog(id);
      setMealLogs((prev) => prev.filter((l) => l.id !== id));
      if (mealsDataCache && mealsDataCache.householdId === householdId) {
        mealsDataCache.mealLogs = mealsDataCache.mealLogs.filter((l) => l.id !== id);
      }
      showToast('Log entry removed');
    } catch (err) {
      console.error('Failed to delete log', err);
    }
  };

  // Add recipe to shopped list
  const handleAddRecipeToShopped = async (recipe: Recipe) => {
    if (!householdId) return;
    try {
      const added = await api.addWeeklyMeal(householdId, {
        title: recipe.title,
        recipe_id: recipe.id,
      });
      setMeals((prev) => [added, ...prev]);
      if (mealsDataCache && mealsDataCache.householdId === householdId) {
        mealsDataCache.meals = [added, ...mealsDataCache.meals];
      }
      setIsRecipePickerOpen(false);
      showToast(`Added "${recipe.title}" to shopped recipes!`);
    } catch (err) {
      console.error('Failed to add recipe', err);
    }
  };

  // Quick add custom dish
  const handleQuickAddCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!householdId || !quickDishInput.trim()) return;
    setIsAddingQuick(true);
    try {
      const added = await api.addWeeklyMeal(householdId, {
        title: quickDishInput.trim(),
      });
      setMeals((prev) => [added, ...prev]);
      if (mealsDataCache && mealsDataCache.householdId === householdId) {
        mealsDataCache.meals = [added, ...mealsDataCache.meals];
      }
      setQuickDishInput('');
      setIsRecipePickerOpen(false);
      showToast(`Added "${added.title}" to shopped meals!`);
    } catch (err) {
      console.error('Failed to add meal', err);
    } finally {
      setIsAddingQuick(false);
    }
  };

  // Shop Ingredients to Grocery List
  const handleShopIngredients = async (recipe: Recipe, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!householdId) return;
    try {
      for (const ing of recipe.ingredients) {
        await api.addGroceryItem(householdId, {
          name: ing.item,
          quantity: ing.amount,
          unit: ing.unit,
          category: ing.category,
          notes: `For: ${recipe.title}`,
        });
      }
      showToast(`Added ${recipe.ingredients.length} ingredients to Grocery list!`);
    } catch (err) {
      console.error('Failed to add ingredients', err);
      showToast('Error adding ingredients');
    }
  };

  // Submit Manual Log Form
  const handleSubmitManualLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!householdId || !logForm.title.trim()) return;
    try {
      const newLog = await api.logMealMade(householdId, {
        title: logForm.title.trim(),
        recipe_id: logForm.recipeId || undefined,
        date: logForm.date,
        notes: logForm.notes.trim() || undefined,
        cooked_by_user_id: logForm.cookedByUserId || undefined,
      });

      const matchedWeekly = meals.find(
        (m) =>
          (logForm.recipeId && m.recipe_id === logForm.recipeId) ||
          m.title.toLowerCase() === logForm.title.trim().toLowerCase()
      );
      if (matchedWeekly) {
        await api.deleteWeeklyMeal(matchedWeekly.id);
        setMeals((prev) => prev.filter((m) => m.id !== matchedWeekly.id));
      }

      setMealLogs((prev) => [newLog, ...prev]);
      if (mealsDataCache && mealsDataCache.householdId === householdId) {
        mealsDataCache.mealLogs = [newLog, ...mealsDataCache.mealLogs];
      }
      setIsLogModalOpen(false);
      setLogForm({
        title: '',
        recipeId: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        notes: '',
        cookedByUserId: currentUser?.id || '',
      });
      showToast(`Logged "${newLog.title}"!`);
    } catch (err) {
      console.error('Failed to log meal', err);
    }
  };

  // Group Meal Logs by Date
  const groupedLogs: { [dateStr: string]: MealLog[] } = {};
  mealLogs.forEach((log) => {
    const d = log.date || format(new Date(log.created_at || Date.now()), 'yyyy-MM-dd');
    if (!groupedLogs[d]) groupedLogs[d] = [];
    groupedLogs[d].push(log);
  });
  const sortedLogDates = Object.keys(groupedLogs).sort((a, b) => b.localeCompare(a));

  const formatLogDateHeader = (dateStr: string) => {
    try {
      const parsed = parseISO(dateStr);
      if (isToday(parsed)) return 'Today';
      if (isYesterday(parsed)) return 'Yesterday';
      return format(parsed, 'EEEE, MMM d');
    } catch {
      return dateStr;
    }
  };

  const getUserName = (userId?: string) => {
    if (!userId) return null;
    const u = users.find((user) => user.id === userId);
    return u?.name || null;
  };

  // Filter recipes for picker modal
  const filteredRecipes = recipes.filter((r) =>
    r.title.toLowerCase().includes(recipeSearch.toLowerCase()) ||
    r.tags?.some((t) => t.toLowerCase().includes(recipeSearch.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-36 pt-3 px-3 sm:px-6 max-w-3xl mx-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-slate-950 font-bold px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-2 border border-emerald-300 text-xs sm:text-sm animate-in fade-in slide-in-from-top-3 duration-200">
          <Sparkles className="w-4 h-4 fill-slate-950 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Mobile-First Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-md shadow-emerald-500/20 text-slate-950">
              <ChefHat className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                Meals
              </h1>
              <p className="text-[11px] sm:text-xs text-slate-400 font-medium">
                Recipes shopped for & on deck to cook
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsRecipePickerOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-400 font-bold text-xs transition-all active:scale-95 shadow-sm"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add Recipe</span>
          </button>
        </div>

        {/* Mobile Segmented Control (Full Width, Thumb Friendly) */}
        <div className="grid grid-cols-2 p-1 rounded-2xl bg-slate-900 border border-slate-800 shadow-inner">
          <button
            onClick={() => setActiveTab('shopped')}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all active:scale-[0.98] ${
              activeTab === 'shopped'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Shopped Recipes</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === 'shopped'
                  ? 'bg-slate-950/25 text-slate-950'
                  : 'bg-slate-800 text-emerald-400'
              }`}
            >
              {meals.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('log')}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all active:scale-[0.98] ${
              activeTab === 'log'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Cooking Log</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === 'log'
                  ? 'bg-slate-950/25 text-slate-950'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {mealLogs.length}
            </span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-500 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          <p className="text-xs font-medium">Loading your recipes on deck...</p>
        </div>
      ) : activeTab === 'shopped' ? (
        /* ================= TAB 1: SHOPPED RECIPES LIST ================= */
        <div className="space-y-3.5">
          {meals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 bg-slate-900/40 rounded-3xl border border-dashed border-slate-800 text-center">
              <div className="w-16 h-16 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center text-emerald-400/80 mb-3 shadow-inner">
                <Utensils className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-white mb-1">No recipes on deck</h3>
              <p className="text-xs text-slate-400 max-w-xs mb-5 leading-relaxed">
                When you browse your recipes and tap <span className="text-emerald-400 font-semibold">"Add All to Grocery List"</span>, or choose recipes below, they will appear here ready to cook!
              </p>
              <button
                onClick={() => setIsRecipePickerOpen(true)}
                className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-transform"
              >
                <BookOpen className="w-4 h-4 stroke-[2.5]" />
                <span>Pick Recipes to Cook</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {meals.map((meal) => {
                const recipe = meal.recipe_id ? recipeMap.get(meal.recipe_id) : undefined;
                return (
                  <div
                    key={meal.id}
                    onClick={() => recipe && setViewingRecipe(recipe)}
                    className={`group bg-slate-900/90 border border-slate-800/90 rounded-3xl p-3.5 shadow-md active:bg-slate-900 transition-all ${
                      recipe ? 'cursor-pointer hover:border-slate-700' : ''
                    }`}
                  >
                    {/* Top Row: Thumbnail + Title & Metadata */}
                    <div className="flex items-start gap-3">
                      {recipe?.image_url ? (
                        <img
                          src={recipe.image_url}
                          alt={recipe.title}
                          className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border border-slate-800 shrink-0 shadow-sm group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-800 flex items-center justify-center text-emerald-400 shrink-0">
                          <ChefHat className="w-8 h-8 opacity-75" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1.5">
                          <h3 className="text-sm sm:text-base font-bold text-white line-clamp-2 leading-snug group-hover:text-emerald-400 transition-colors">
                            {meal.title}
                          </h3>

                          <button
                            onClick={(e) => handleDeleteShoppedMeal(meal.id, e)}
                            className="text-slate-500 hover:text-rose-400 p-1.5 -mr-1.5 -mt-1 rounded-xl transition-colors shrink-0"
                            title="Remove from list"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Recipe badges */}
                        {recipe ? (
                          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                            {(recipe.cook_time_minutes || recipe.prep_time_minutes) && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-300 bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700/60">
                                <Clock className="w-3 h-3 text-emerald-400" />
                                {(recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0)}m
                              </span>
                            )}
                            {recipe.servings && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-300 bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700/60">
                                <Utensils className="w-3 h-3 text-teal-400" />
                                {recipe.servings} serv
                              </span>
                            )}
                            {recipe.ingredients && (
                              <span className="text-[10px] text-slate-400 font-medium">
                                {recipe.ingredients.length} ingr
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-500 italic mt-0.5 block">
                            Custom dish
                          </span>
                        )}

                        {meal.notes && (
                          <p className="text-[11px] text-slate-400 italic mt-1 line-clamp-1">
                            "{meal.notes}"
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Bottom Action Bar: Thumb Friendly Mobile Actions */}
                    <div className="pt-2.5 mt-2.5 border-t border-slate-800/60 flex items-center justify-between gap-2">
                      {recipe ? (
                        <div className="flex items-center gap-1 text-xs text-emerald-400 font-semibold">
                          <span>View recipe</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">Dish</span>
                      )}

                      <div className="flex items-center gap-1.5">
                        {recipe && (
                          <button
                            onClick={(e) => handleShopIngredients(recipe, e)}
                            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                            title="Add ingredients to grocery list"
                          >
                            <ShoppingCart className="w-4 h-4" />
                          </button>
                        )}

                        {/* Pick Day Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setQuickDateMeal(meal);
                            setTargetDate(format(new Date(), 'yyyy-MM-dd'));
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1 border border-slate-700/60 transition-colors"
                          title="Made on a specific date"
                        >
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span className="hidden sm:inline">Made on...</span>
                        </button>

                        {/* Main One-Tap Made Today Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkMealCooked(meal, format(new Date(), 'yyyy-MM-dd'));
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-emerald-500/20 active:scale-95"
                          title="Mark as cooked today and move to log"
                        >
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Made Today</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ================= TAB 2: DAILY COOKING LOG ================= */
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <History className="w-4 h-4 text-emerald-400" />
                <span>Cooking History ({mealLogs.length})</span>
              </h2>
              <p className="text-[11px] text-slate-400">
                A daily record of what was prepared
              </p>
            </div>
            <button
              onClick={() => setIsLogModalOpen(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 active:scale-95"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>+ Log Meal</span>
            </button>
          </div>

          {/* Quick-add strip if there are shopped meals ready to cook */}
          {meals.length > 0 && (
            <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-2xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                Quick-add from shopped recipes:
              </span>
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {meals.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => handleMarkMealCooked(m, format(new Date(), 'yyyy-MM-dd'))}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 text-slate-200 border border-slate-700/60 text-xs font-semibold shrink-0 transition-colors active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="truncate max-w-[140px]">{m.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {sortedLogDates.length === 0 ? (
            <div className="text-center py-16 px-4 bg-slate-900/40 rounded-3xl border border-dashed border-slate-800">
              <History className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-white">No meals logged yet</p>
              <p className="text-xs text-slate-400 mt-1 mb-4">
                Mark shopped recipes as made to start your cooking log!
              </p>
              <button
                onClick={() => setIsLogModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 font-bold text-xs"
              >
                Log a Meal
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {sortedLogDates.map((dateStr) => {
                const logsForDate = groupedLogs[dateStr];
                return (
                  <div key={dateStr} className="space-y-2.5">
                    {/* Day Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <h3 className="text-xs sm:text-sm font-bold text-white tracking-wide">
                          {formatLogDateHeader(dateStr)}
                        </h3>
                        <span className="text-[10px] text-slate-500 font-medium">
                          ({logsForDate.length})
                        </span>
                      </div>

                      {meals.length > 0 && (
                        <button
                          onClick={() => setLogDayPickerDate(dateStr)}
                          className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20 active:scale-95"
                        >
                          + Add Meal
                        </button>
                      )}
                    </div>

                    {/* Log items for this day */}
                    <div className="space-y-2 pl-3 border-l-2 border-slate-800/80">
                      {logsForDate.map((log) => {
                        const recipe = log.recipe_id ? recipeMap.get(log.recipe_id) : undefined;
                        const chefName = getUserName(log.cooked_by_user_id);

                        return (
                          <div
                            key={log.id}
                            onClick={() => recipe && setViewingRecipe(recipe)}
                            className={`p-3 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-2.5 shadow-sm active:bg-slate-900 ${
                              recipe ? 'cursor-pointer hover:border-slate-700' : ''
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {recipe?.image_url ? (
                                <img
                                  src={recipe.image_url}
                                  alt={recipe.title}
                                  className="w-11 h-11 rounded-xl object-cover border border-slate-800 shrink-0"
                                />
                              ) : (
                                <div className="w-11 h-11 rounded-xl bg-slate-800 border border-slate-700/60 flex items-center justify-center text-emerald-400 shrink-0">
                                  <Utensils className="w-4 h-4" />
                                </div>
                              )}

                              <div className="min-w-0">
                                <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                                  {log.title}
                                </h4>
                                <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                                  {chefName && <span>by {chefName}</span>}
                                  {recipe && (
                                    <span className="text-emerald-400 font-medium">Recipe</span>
                                  )}
                                </div>
                                {log.notes && (
                                  <p className="text-[10px] text-slate-400 italic truncate mt-0.5">
                                    "{log.notes}"
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMoveBackToShopped(log);
                                }}
                                className="p-2 rounded-xl text-slate-400 hover:text-emerald-400 hover:bg-slate-800 active:scale-95 transition-colors"
                                title="Move back to shopped list"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteLog(log.id);
                                }}
                                className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 active:scale-95 transition-colors"
                                title="Delete log"
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

      {/* ================= SLIDE-OUT DRAWER: RECIPE VIEWER ================= */}
      <Drawer
        isOpen={Boolean(viewingRecipe)}
        onClose={() => {
          setViewingRecipe(null);
          setRecipeStepProgress({});
          setJustCompletedModalStep(null);
        }}
        title={viewingRecipe?.title || 'Recipe Details'}
        subtitle={viewingRecipe?.description || 'View recipe and track cooking steps'}
        icon={<ChefHat className="w-5 h-5 text-emerald-400" />}
        contentClassName="p-0 overflow-y-auto"
        footer={
          viewingRecipe ? (
            <div className="w-full flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setViewingRecipe(null);
                  setRecipeStepProgress({});
                  setJustCompletedModalStep(null);
                }}
                className="w-1/3 py-2.5 rounded-xl text-xs font-bold text-slate-400 bg-slate-900 border border-slate-800 hover:text-white transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!householdId) return;
                  const matchedWeekly = meals.find((m) => m.recipe_id === viewingRecipe.id);
                  if (matchedWeekly) {
                    await handleMarkMealCooked(matchedWeekly, format(new Date(), 'yyyy-MM-dd'));
                  } else {
                    await api.logMealMade(householdId, {
                      title: viewingRecipe.title,
                      recipe_id: viewingRecipe.id,
                      date: format(new Date(), 'yyyy-MM-dd'),
                      cooked_by_user_id: currentUser?.id,
                    });
                    await fetchData(true);
                  }
                  setViewingRecipe(null);
                  showToast(`🎉 Logged "${viewingRecipe.title}" as made today!`);
                }}
                className="w-2/3 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 active:scale-95 cursor-pointer"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>Made Today · Add to Log</span>
              </button>
            </div>
          ) : null
        }
      >
        {viewingRecipe && (
          <div>
            {viewingRecipe.image_url && (
              <div className="h-44 sm:h-56 w-full relative">
                <img
                  src={viewingRecipe.image_url}
                  alt={viewingRecipe.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
              </div>
            )}
            <div className="p-4 space-y-4">
              {/* Meta stats */}
              <div className="flex items-center gap-2 text-xs bg-slate-950/70 p-2.5 rounded-2xl border border-slate-800">
                {(viewingRecipe.prep_time_minutes || viewingRecipe.cook_time_minutes) && (
                  <div className="flex items-center gap-1 text-slate-300 font-semibold">
                    <Clock className="w-3.5 h-3.5 text-emerald-400" />
                    <span>
                      {((viewingRecipe.prep_time_minutes || 0) + (viewingRecipe.cook_time_minutes || 0))} min total
                    </span>
                  </div>
                )}
                {viewingRecipe.servings && (
                  <div className="flex items-center gap-1 text-slate-300 font-semibold pl-2 border-l border-slate-800">
                    <Users className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{viewingRecipe.servings} servings</span>
                  </div>
                )}
              </div>

              {/* Ingredients Checklist */}
              {viewingRecipe.ingredients && viewingRecipe.ingredients.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Ingredients ({viewingRecipe.ingredients.length})
                    </h4>
                  </div>
                  <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-3 space-y-2">
                    {viewingRecipe.ingredients.map((ing, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs text-slate-200">
                        <span className="text-emerald-400 font-bold">•</span>
                        <span>
                          {ing.amount ? <strong>{ing.amount} </strong> : null}
                          {ing.unit ? <span>{ing.unit} </span> : null}
                          {ing.item}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Instructions with Interactive Step Check */}
              {viewingRecipe.instructions && viewingRecipe.instructions.length > 0 && (
                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Step-by-Step Instructions
                  </h4>
                  <div className="space-y-2">
                    {viewingRecipe.instructions.map((step, idx) => {
                      const isDone = Boolean(recipeStepProgress[idx]);
                      const isJustDone = justCompletedModalStep === idx;
                      return (
                        <div
                          key={idx}
                          onClick={() => {
                            const next = !isDone;
                            setRecipeStepProgress((prev) => ({
                              ...prev,
                              [idx]: next,
                            }));
                            if (next) {
                              setJustCompletedModalStep(idx);
                              setTimeout(() => setJustCompletedModalStep(null), 1200);
                            }
                          }}
                          className={`p-3 rounded-2xl border transition-all cursor-pointer relative overflow-hidden flex items-start gap-3 ${
                            isDone
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-slate-400'
                              : 'bg-slate-950/50 border-slate-800 hover:border-slate-700 text-slate-200'
                          }`}
                        >
                          {isJustDone && <CheckSparkle trigger={isJustDone} />}
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                              isDone
                                ? 'bg-emerald-500 text-slate-950'
                                : 'bg-slate-900 border border-slate-700 text-slate-400'
                            }`}
                          >
                            {isDone ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : idx + 1}
                          </div>
                          <p
                            className={`text-xs leading-relaxed transition-all ${
                              isDone ? 'line-through text-slate-500' : 'text-slate-200'
                            }`}
                          >
                            {step}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* ================= DRAWER: PICK RECIPES TO COOK ================= */}
      <Drawer
        isOpen={isRecipePickerOpen}
        onClose={() => setIsRecipePickerOpen(false)}
        width="max-w-xl"
        title="Choose Recipes to Shop & Cook"
      >
        <div className="flex flex-col h-full">
          {/* Header & Search */}
          <div className="p-4 border-b border-slate-800 bg-slate-950/50">
            <p className="text-xs text-slate-400 mb-3">
              Select recipes from your box to put on deck
            </p>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search recipes by name or tag..."
                value={recipeSearch}
                onChange={(e) => setRecipeSearch(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Recipe List */}
          <div className="p-4 overflow-y-auto space-y-2 flex-1 overscroll-contain">
            {filteredRecipes.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-xs">
                No recipes found matching "{recipeSearch}"
              </div>
            ) : (
              filteredRecipes.map((r) => {
                const isAlreadyOnDeck = meals.some((m) => m.recipe_id === r.id);
                return (
                  <div
                    key={r.id}
                    className="bg-slate-950/70 border border-slate-800 rounded-2xl p-2.5 flex items-center justify-between gap-2.5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {r.image_url ? (
                        <img
                          src={r.image_url}
                          alt={r.title}
                          className="w-11 h-11 rounded-xl object-cover border border-slate-800 shrink-0"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-emerald-400 shrink-0">
                          <ChefHat className="w-5 h-5 opacity-70" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <h4 className="text-xs sm:text-sm font-bold text-white truncate">{r.title}</h4>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                          {r.cook_time_minutes && <span>{r.cook_time_minutes} min</span>}
                          {r.servings && <span>· {r.servings} serv</span>}
                          <span>· {r.ingredients?.length || 0} ingr</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleAddRecipeToShopped(r)}
                      disabled={isAlreadyOnDeck}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 shrink-0 transition-all active:scale-95 ${
                        isAlreadyOnDeck
                          ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20'
                      }`}
                    >
                      {isAlreadyOnDeck ? (
                        <span>On Deck</span>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Add</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Quick custom dish entry at bottom of sheet */}
          <div className="p-4 bg-slate-950 border-t border-slate-800 pb-safe">
            <form onSubmit={handleQuickAddCustom} className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Or type a custom dish (e.g. Tacos)..."
                value={quickDishInput}
                onChange={(e) => setQuickDishInput(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                disabled={!quickDishInput.trim() || isAddingQuick}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs disabled:opacity-40 shrink-0"
              >
                Add Custom
              </button>
            </form>
          </div>
        </div>
      </Drawer>

      {/* ================= DRAWER: PICK DATE ================= */}
      <Drawer
        isOpen={Boolean(quickDateMeal)}
        onClose={() => setQuickDateMeal(null)}
        width="max-w-md"
        title="Made on Which Day?"
      >
        {quickDateMeal && (
          <div className="p-5 flex flex-col justify-between h-full">
            <div>
              <p className="text-sm font-bold text-emerald-400 mb-1 truncate">{quickDateMeal.title}</p>
              <p className="text-xs text-slate-400 mb-4">
                Select the day this meal was prepared:
              </p>

              {/* Quick buttons */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => setTargetDate(format(new Date(), 'yyyy-MM-dd'))}
                  className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${
                    targetDate === format(new Date(), 'yyyy-MM-dd')
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-900'
                  }`}
                >
                  Today ({format(new Date(), 'MMM d')})
                </button>
                <button
                  type="button"
                  onClick={() => setTargetDate(format(subDays(new Date(), 1), 'yyyy-MM-dd'))}
                  className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${
                    targetDate === format(subDays(new Date(), 1), 'yyyy-MM-dd')
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-900'
                  }`}
                >
                  Yesterday ({format(subDays(new Date(), 1), 'MMM d')})
                </button>
              </div>

              <div className="mb-6">
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  Or pick calendar date:
                </label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <button
              onClick={() => handleMarkMealCooked(quickDateMeal, targetDate)}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-bold text-xs sm:text-sm shadow-md shadow-emerald-500/20 active:scale-95"
            >
              Add to Log & Remove from Shopped List
            </button>
          </div>
        )}
      </Drawer>

      {/* ================= DRAWER: PICK FOR LOG DATE ================= */}
      <Drawer
        isOpen={Boolean(logDayPickerDate)}
        onClose={() => setLogDayPickerDate(null)}
        width="max-w-md"
        title={logDayPickerDate ? `Add to ${isToday(parseISO(logDayPickerDate)) ? 'Today' : format(parseISO(logDayPickerDate), 'MMM d')}` : 'Add to Log'}
      >
        <div className="p-4 flex flex-col h-full">
          <p className="text-xs text-slate-400 mb-3">
            Select a shopped meal to log
          </p>

          <div className="space-y-2 overflow-y-auto flex-1 pr-1">
            {meals.map((meal) => (
              <button
                key={meal.id}
                onClick={() => handleMarkMealCooked(meal, logDayPickerDate!)}
                className="w-full text-left bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-2 hover:bg-slate-900 active:bg-emerald-500/10 active:border-emerald-500/30 transition-colors"
              >
                <span className="font-semibold text-xs text-white truncate">
                  {meal.title}
                </span>
                <Plus className="w-4 h-4 text-emerald-400 shrink-0" />
              </button>
            ))}
            {meals.length === 0 && (
              <div className="text-center py-10 text-slate-500 text-xs">
                No shopped meals available.
              </div>
            )}
          </div>
        </div>
      </Drawer>

      {/* ================= DRAWER: MANUAL LOG MEAL ================= */}
      <Drawer
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        width="max-w-md"
        title="Log a Meal Made"
      >
        <div className="p-5 flex flex-col h-full">
          {/* Quick-Pick from Weekly Meals if any */}
          {meals.length > 0 && (
            <div className="mb-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                Pick from shopped meals:
              </span>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {meals.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() =>
                      setLogForm((prev) => ({
                        ...prev,
                        title: m.title,
                        recipeId: m.recipe_id || '',
                        notes: m.notes || '',
                      }))
                    }
                    className={`px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all ${
                      logForm.title === m.title
                        ? 'bg-emerald-500 text-slate-950 border-transparent font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-900'
                    }`}
                  >
                    {m.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmitManualLog} className="space-y-4 flex-1 flex flex-col justify-between">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Dish Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Homemade Pizza, Chicken Salad..."
                  value={logForm.title}
                  onChange={(e) => setLogForm({ ...logForm, title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Date Cooked
                  </label>
                  <input
                    type="date"
                    value={logForm.date}
                    onChange={(e) => setLogForm({ ...logForm, date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Cooked By
                  </label>
                  <select
                    value={logForm.cookedByUserId}
                    onChange={(e) => setLogForm({ ...logForm, cookedByUserId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">(Household)</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  placeholder="e.g. Delicious with extra pepper..."
                  value={logForm.notes}
                  onChange={(e) => setLogForm({ ...logForm, notes: e.target.value })}
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>
            </div>

            <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsLogModalOpen(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 active:scale-95"
              >
                Save to Log
              </button>
            </div>
          </form>
        </div>
      </Drawer>
    </div>
  );
};

export default MealsPage;
