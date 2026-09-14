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
  Search,
  Zap,
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

  // Tab State: 'shopped' = Weekly Meals / Shopped, 'log' = Daily Cooking Log
  const [activeTab, setActiveTab] = useState<'shopped' | 'log'>('shopped');

  // Modals
  const [viewingRecipe, setViewingRecipe] = useState<Recipe | null>(null);
  const [isRecipePickerOpen, setIsRecipePickerOpen] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [recipeSearch, setRecipeSearch] = useState('');
  const [checkedIngredients, setCheckedIngredients] = useState<Record<string, boolean>>({});

  // Quick Date Picker Modal for adding a meal to a specific day
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

  // Quick custom dish input for On-Deck list
  const [quickDishInput, setQuickDishInput] = useState('');
  const [isAddingQuick, setIsAddingQuick] = useState(false);

  // Notification / Toast
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

      // Only unmade weekly meals belong in the weekly list
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
   * CORE ACTION: Quick add a weekly meal to a specific day.
   * This adds it to the Daily Cooking Log for that date and removes it from the weekly meals list!
   */
  const handleQuickAddToDay = async (meal: WeeklyMeal, dateStr: string) => {
    if (!householdId) return;
    try {
      // 1. Log the meal for the given date
      const newLog = await api.logMealMade(householdId, {
        title: meal.title,
        recipe_id: meal.recipe_id,
        date: dateStr,
        notes: meal.notes,
        cooked_by_user_id: currentUser?.id,
        weekly_meal_id: meal.id,
      });

      // 2. Explicitly remove from weekly_meals
      await api.deleteWeeklyMeal(meal.id);

      // 3. Update local state: remove from weekly meals, add to logs
      setMeals((prev) => prev.filter((m) => m.id !== meal.id));
      setMealLogs((prev) => [newLog, ...prev]);

      if (mealsDataCache && mealsDataCache.householdId === householdId) {
        mealsDataCache.meals = mealsDataCache.meals.filter((m) => m.id !== meal.id);
        mealsDataCache.mealLogs = [newLog, ...mealsDataCache.mealLogs];
      }

      // Close any open modals
      setQuickDateMeal(null);
      setLogDayPickerDate(null);

      const dayLabel = isToday(parseISO(dateStr))
        ? 'Today'
        : isYesterday(parseISO(dateStr))
        ? 'Yesterday'
        : format(parseISO(dateStr), 'MMM d');

      showToast(`Added "${meal.title}" to ${dayLabel} & removed from weekly meals!`);
    } catch (err) {
      console.error('Failed to add meal to day', err);
      showToast('Error adding meal to day');
    }
  };

  // Move a logged meal back to the weekly meals list (Undo action)
  const handleMoveBackToWeekly = async (log: MealLog) => {
    if (!householdId) return;
    try {
      // 1. Re-add to weekly meals
      const added = await api.addWeeklyMeal(householdId, {
        title: log.title,
        recipe_id: log.recipe_id,
        notes: log.notes,
      });

      // 2. Delete the log entry
      await api.deleteMealLog(log.id);

      // 3. Update state
      setMeals((prev) => [added, ...prev]);
      setMealLogs((prev) => prev.filter((l) => l.id !== log.id));

      if (mealsDataCache && mealsDataCache.householdId === householdId) {
        mealsDataCache.meals = [added, ...mealsDataCache.meals];
        mealsDataCache.mealLogs = mealsDataCache.mealLogs.filter((l) => l.id !== log.id);
      }

      showToast(`Moved "${log.title}" back to weekly meals!`);
    } catch (err) {
      console.error('Failed to move meal back', err);
    }
  };

  // Handle Delete Weekly Meal
  const handleDeleteMeal = async (id: string) => {
    try {
      await api.deleteWeeklyMeal(id);
      setMeals((prev) => prev.filter((m) => m.id !== id));
      if (mealsDataCache && mealsDataCache.householdId === householdId) {
        mealsDataCache.meals = mealsDataCache.meals.filter((m) => m.id !== id);
      }
      showToast('Removed from weekly meals');
    } catch (err) {
      console.error('Failed to delete meal', err);
    }
  };

  // Handle Delete Log Entry
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

  // Add Recipe to Weekly list
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
      showToast(`Added "${recipe.title}" to weekly meals!`);
    } catch (err) {
      console.error('Failed to add recipe', err);
    }
  };

  // Quick Add Custom Dish
  const handleQuickAddDish = async (e: React.FormEvent) => {
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
      showToast(`Added "${added.title}" to weekly meals!`);
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
          category: ing.category || 'Pantry',
        });
      }
      showToast(`Added ${recipe.ingredients.length} ingredients to Grocery list!`);
    } catch (err) {
      console.error('Failed to add ingredients', err);
      showToast('Error adding ingredients to groceries');
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

      // If this title matched an unmade weekly meal, remove it
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
      return format(parsed, 'EEEE, MMMM d, yyyy');
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
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-36 pt-4 px-4 sm:px-6 max-w-5xl mx-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-emerald-500/90 text-white font-medium px-4 py-2.5 rounded-2xl shadow-xl shadow-emerald-500/20 backdrop-blur-md flex items-center gap-2 border border-emerald-400/30 text-sm animate-in fade-in slide-in-from-top-4 duration-200">
          <Sparkles className="w-4 h-4 text-emerald-100 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-slate-950">
              <ChefHat className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                Meals & Cooking
              </h1>
              <p className="text-xs sm:text-sm text-slate-400">
                Shopped weekly meals & daily cooking log
              </p>
            </div>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="flex bg-slate-900/90 p-1 rounded-2xl border border-slate-800/80 shadow-inner shrink-0 self-start md:self-auto">
          <button
            onClick={() => setActiveTab('shopped')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'shopped'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Weekly Meals</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === 'shopped'
                  ? 'bg-slate-950/20 text-slate-950'
                  : 'bg-slate-800 text-emerald-400'
              }`}
            >
              {meals.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('log')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'log'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Daily Cooking Log</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === 'log'
                  ? 'bg-slate-950/20 text-slate-950'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {mealLogs.length}
            </span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          <p className="text-sm">Loading meals and recipes...</p>
        </div>
      ) : activeTab === 'shopped' ? (
        /* ================= TAB 1: WEEKLY MEALS / SHOPPED ================= */
        <div className="space-y-6">
          {/* Top Quick Actions Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-3xl border border-slate-800/80 backdrop-blur-sm">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                  Weekly Meals on Hand ({meals.length})
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Quick-add any meal to today or another day to move it into your cooking log
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsRecipePickerOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-semibold text-xs transition-all shadow-sm shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>+ Pick from Saved Recipes</span>
              </button>
            </div>
          </div>

          {/* Weekly Meals Cards */}
          {meals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 bg-slate-900/30 rounded-3xl border border-dashed border-slate-800 text-center">
              <div className="w-14 h-14 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mb-3 shadow-inner">
                <Utensils className="w-7 h-7 text-emerald-500/50" />
              </div>
              <h3 className="text-base font-semibold text-white mb-1">No meals in your weekly list</h3>
              <p className="text-xs sm:text-sm text-slate-400 max-w-md mb-5">
                When you browse recipes and tap <span className="text-emerald-400 font-medium">"Add All to Grocery List"</span>, or choose recipes below, they appear here ready to cook!
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <button
                  onClick={() => setIsRecipePickerOpen(true)}
                  className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Choose from Saved Recipes</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {meals.map((meal) => {
                const recipe = meal.recipe_id ? recipeMap.get(meal.recipe_id) : undefined;
                return (
                  <div
                    key={meal.id}
                    className="bg-slate-900/80 border border-slate-800/90 rounded-3xl p-4 transition-all duration-200 shadow-lg hover:border-slate-700/80 flex flex-col justify-between"
                  >
                    <div>
                      {/* Card Header & Thumbnail */}
                      <div className="flex items-start gap-3.5 mb-3">
                        {recipe?.image_url ? (
                          <img
                            src={recipe.image_url}
                            alt={recipe.title}
                            className="w-16 h-16 rounded-2xl object-cover border border-slate-800 shrink-0 shadow-md"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-800 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
                            <ChefHat className="w-7 h-7 opacity-80" />
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-base font-bold text-white line-clamp-2">
                              {meal.title}
                            </h3>
                            <button
                              onClick={() => handleDeleteMeal(meal.id)}
                              className="text-slate-600 hover:text-rose-400 p-1.5 rounded-xl hover:bg-rose-500/10 transition-colors shrink-0"
                              title="Remove from weekly meals"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Recipe metadata badges */}
                          {recipe && (
                            <div className="flex flex-wrap items-center gap-2 mt-1.5">
                              {(recipe.cook_time_minutes || recipe.prep_time_minutes) && (
                                <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-lg border border-slate-700/50">
                                  <Clock className="w-3 h-3 text-emerald-400" />
                                  {(recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0)}m
                                </span>
                              )}
                              {recipe.servings && (
                                <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-lg border border-slate-700/50">
                                  <Utensils className="w-3 h-3 text-teal-400" />
                                  {recipe.servings} serv
                                </span>
                              )}
                              {recipe.ingredients && (
                                <span className="text-[11px] text-slate-500">
                                  {recipe.ingredients.length} ingr
                                </span>
                              )}
                            </div>
                          )}

                          {meal.notes && (
                            <p className="text-xs text-slate-400 italic mt-1 line-clamp-1">
                              "{meal.notes}"
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action Area */}
                    <div className="pt-3 mt-2 border-t border-slate-800/60 flex items-center justify-between gap-2">
                      {/* View Recipe Button (Only if user wants to view details) */}
                      {recipe ? (
                        <button
                          onClick={() => setViewingRecipe(recipe)}
                          className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-medium py-1 px-2 rounded-lg hover:bg-emerald-500/10 transition-colors"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>View Recipe</span>
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500">Custom meal</span>
                      )}

                      {/* Quick Add Actions */}
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
                          onClick={() => {
                            setQuickDateMeal(meal);
                            setTargetDate(format(new Date(), 'yyyy-MM-dd'));
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 font-medium text-xs flex items-center gap-1 transition-all"
                          title="Quick add to a specific day"
                        >
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span className="hidden sm:inline">Pick Day</span>
                        </button>

                        {/* Quick Add to Today (1-Click!) */}
                        <button
                          onClick={() => handleQuickAddToDay(meal, format(new Date(), 'yyyy-MM-dd'))}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-emerald-500/20"
                          title="Quick add to Today and remove from weekly list"
                        >
                          <Zap className="w-3.5 h-3.5 fill-slate-950" />
                          <span>Add to Today</span>
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
        <div className="space-y-6">
          {/* Top Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-3xl border border-slate-800/80 backdrop-blur-sm">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <History className="w-4 h-4 text-emerald-400" />
                Cooking History ({mealLogs.length} Meals Logged)
              </h2>
              <p className="text-xs text-slate-400">
                A day-by-day record of what was made by your household
              </p>
            </div>
            <button
              onClick={() => setIsLogModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-bold text-xs sm:text-sm transition-all shadow-md shadow-emerald-500/20 shrink-0 self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>+ Log a Meal</span>
            </button>
          </div>

          {/* Quick Add Strip: Weekly Meals on Deck */}
          {meals.length > 0 && (
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-teal-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Quick Add to Today from Weekly Meals ({meals.length})
                  </h3>
                </div>
                <span className="text-[11px] text-slate-500">1-tap moves dish to log</span>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                {meals.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => handleQuickAddToDay(m, format(new Date(), 'yyyy-MM-dd'))}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-emerald-500 hover:text-slate-950 border border-slate-700/80 text-xs font-semibold text-slate-200 shrink-0 transition-all group"
                  >
                    <Plus className="w-3.5 h-3.5 text-emerald-400 group-hover:text-slate-950" />
                    <span className="truncate max-w-[160px]">{m.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Daily Groups */}
          {sortedLogDates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 bg-slate-900/30 rounded-3xl border border-dashed border-slate-800 text-center">
              <div className="w-14 h-14 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mb-3 shadow-inner">
                <History className="w-7 h-7 text-emerald-500/50" />
              </div>
              <h3 className="text-base font-semibold text-white mb-1">No meals logged yet</h3>
              <p className="text-xs sm:text-sm text-slate-400 max-w-md mb-5">
                When you make dishes or quick-add weekly meals, your daily cooking log will appear here chronologically!
              </p>
              <button
                onClick={() => setIsLogModalOpen(true)}
                className="px-4 py-2 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs sm:text-sm flex items-center gap-2 transition-colors border border-slate-700"
              >
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>Log Your First Meal</span>
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {sortedLogDates.map((dateStr) => {
                const logsForDate = groupedLogs[dateStr];
                return (
                  <div key={dateStr} className="space-y-3">
                    {/* Date Header */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                        <h3 className="text-sm sm:text-base font-bold text-white tracking-wide">
                          {formatLogDateHeader(dateStr)}
                        </h3>
                        <span className="text-xs text-slate-500 font-medium">
                          ({logsForDate.length} {logsForDate.length === 1 ? 'dish' : 'dishes'})
                        </span>
                      </div>

                      {/* Quick Add to THIS specific day */}
                      {meals.length > 0 && (
                        <button
                          onClick={() => setLogDayPickerDate(dateStr)}
                          className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1 rounded-xl transition-colors border border-emerald-500/20"
                        >
                          <Plus className="w-3 h-3" />
                          <span>+ Add to {isToday(parseISO(dateStr)) ? 'Today' : isYesterday(parseISO(dateStr)) ? 'Yesterday' : format(parseISO(dateStr), 'MMM d')}</span>
                        </button>
                      )}
                    </div>

                    {/* Meal items for this date */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-4 border-l-2 border-slate-800/70 ml-1">
                      {logsForDate.map((log) => {
                        const recipe = log.recipe_id ? recipeMap.get(log.recipe_id) : undefined;
                        const chefName = getUserName(log.cooked_by_user_id);

                        return (
                          <div
                            key={log.id}
                            className="bg-slate-900/70 border border-slate-800 rounded-2xl p-3.5 flex items-start justify-between gap-3 shadow-md"
                          >
                            <div className="flex items-start gap-3 min-w-0">
                              {recipe?.image_url ? (
                                <img
                                  src={recipe.image_url}
                                  alt={recipe.title}
                                  className="w-12 h-12 rounded-xl object-cover border border-slate-800 shrink-0 shadow-sm"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-emerald-400 shrink-0">
                                  <Utensils className="w-5 h-5" />
                                </div>
                              )}

                              <div className="min-w-0">
                                <h4 className="text-sm font-bold text-white truncate">
                                  {log.title}
                                </h4>

                                {recipe && (
                                  <button
                                    onClick={() => setViewingRecipe(recipe)}
                                    className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 font-medium mt-0.5"
                                  >
                                    <BookOpen className="w-3 h-3" />
                                    <span>View Recipe</span>
                                  </button>
                                )}

                                {chefName && (
                                  <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-1">
                                    <User className="w-3 h-3 text-slate-500" />
                                    <span>Made by {chefName}</span>
                                  </p>
                                )}

                                {log.notes && (
                                  <p className="text-xs text-slate-400 italic mt-1">
                                    "{log.notes}"
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {/* Move back to weekly meals button */}
                              <button
                                onClick={() => handleMoveBackToWeekly(log)}
                                className="p-1.5 rounded-xl text-slate-500 hover:text-teal-300 hover:bg-teal-500/10 transition-colors"
                                title="Move back to Weekly Meals"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteLog(log.id)}
                                className="p-1.5 rounded-xl text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
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

      {/* ================= MODAL: QUICK ADD TO A SPECIFIC DAY ================= */}
      {quickDateMeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm shadow-2xl p-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-400" />
                <span>Add to Day</span>
              </h3>
              <button
                onClick={() => setQuickDateMeal(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm font-semibold text-white mb-1">{quickDateMeal.title}</p>
            <p className="text-xs text-slate-400 mb-4">
              Choose which day this meal was made. It will be added to that day's cooking log and removed from the weekly meals list.
            </p>

            {/* Quick date presets */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                onClick={() => setTargetDate(format(new Date(), 'yyyy-MM-dd'))}
                className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                  targetDate === format(new Date(), 'yyyy-MM-dd')
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                Today ({format(new Date(), 'MMM d')})
              </button>
              <button
                onClick={() => setTargetDate(format(subDays(new Date(), 1), 'yyyy-MM-dd'))}
                className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                  targetDate === format(subDays(new Date(), 1), 'yyyy-MM-dd')
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                Yesterday ({format(subDays(new Date(), 1), 'MMM d')})
              </button>
            </div>

            <div className="mb-5">
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Or choose custom date:
              </label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500/60"
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setQuickDateMeal(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => handleQuickAddToDay(quickDateMeal, targetDate)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20"
              >
                Add & Remove from Weekly
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: PICK WEEKLY MEAL FOR SPECIFIC LOG DATE ================= */}
      {logDayPickerDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl p-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Utensils className="w-4 h-4 text-emerald-400" />
                  <span>Add to {isToday(parseISO(logDayPickerDate)) ? 'Today' : format(parseISO(logDayPickerDate), 'MMM d')}</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Select a weekly meal to log for this day
                </p>
              </div>
              <button
                onClick={() => setLogDayPickerDate(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {meals.map((meal) => (
                <button
                  key={meal.id}
                  onClick={() => handleQuickAddToDay(meal, logDayPickerDate)}
                  className="w-full text-left bg-slate-950/70 hover:bg-emerald-500/10 border border-slate-800 hover:border-emerald-500/40 rounded-2xl p-3 flex items-center justify-between gap-2 transition-all group"
                >
                  <span className="font-semibold text-xs sm:text-sm text-white group-hover:text-emerald-400 truncate">
                    {meal.title}
                  </span>
                  <Plus className="w-4 h-4 text-emerald-400 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: RECIPE VIEWER ================= */}
      {viewingRecipe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="relative">
              {viewingRecipe.image_url ? (
                <div className="h-48 sm:h-64 w-full relative">
                  <img
                    src={viewingRecipe.image_url}
                    alt={viewingRecipe.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent" />
                </div>
              ) : (
                <div className="h-28 bg-gradient-to-r from-emerald-600 to-teal-700 flex items-center justify-center">
                  <ChefHat className="w-12 h-12 text-white/30" />
                </div>
              )}

              <button
                onClick={() => setViewingRecipe(null)}
                className="absolute top-3 right-3 p-2 rounded-full bg-slate-950/60 hover:bg-slate-950 text-white backdrop-blur-md transition-colors border border-white/10"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="absolute bottom-3 left-4 right-4">
                <h2 className="text-xl sm:text-2xl font-extrabold text-white drop-shadow-md">
                  {viewingRecipe.title}
                </h2>
                {viewingRecipe.description && (
                  <p className="text-xs sm:text-sm text-slate-300 drop-shadow line-clamp-2 mt-0.5">
                    {viewingRecipe.description}
                  </p>
                )}
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
              {/* Meta stats bar */}
              <div className="flex flex-wrap items-center gap-3 text-xs bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
                {viewingRecipe.prep_time_minutes && (
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <Clock className="w-4 h-4 text-emerald-400" />
                    <span>Prep: {viewingRecipe.prep_time_minutes}m</span>
                  </div>
                )}
                {viewingRecipe.cook_time_minutes && (
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <Utensils className="w-4 h-4 text-teal-400" />
                    <span>Cook: {viewingRecipe.cook_time_minutes}m</span>
                  </div>
                )}
                {viewingRecipe.servings && (
                  <div className="text-slate-300">
                    Serves: <span className="font-bold text-white">{viewingRecipe.servings}</span>
                  </div>
                )}
                {viewingRecipe.source_url && (
                  <a
                    href={viewingRecipe.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    <span>Original Recipe</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              {/* Ingredients Checklist */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-emerald-400" />
                    <span>Ingredients Checklist ({viewingRecipe.ingredients.length})</span>
                  </h3>
                  <button
                    onClick={(e) => handleShopIngredients(viewingRecipe, e)}
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add to Grocery List</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {viewingRecipe.ingredients.map((ing, idx) => {
                    const key = `${viewingRecipe.id}-${idx}`;
                    const isChecked = Boolean(checkedIngredients[key]);
                    return (
                      <label
                        key={idx}
                        className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-slate-950/40 border-slate-800/50 text-slate-500 line-through'
                            : 'bg-slate-950/80 border-slate-800 text-slate-200 hover:border-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) =>
                            setCheckedIngredients((prev) => ({
                              ...prev,
                              [key]: e.target.checked,
                            }))
                          }
                          className="rounded text-emerald-500 focus:ring-0 bg-slate-900 border-slate-700"
                        />
                        <span className="font-semibold text-emerald-400/90">
                          {ing.amount} {ing.unit}
                        </span>
                        <span className="truncate">{ing.item}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Step-by-Step Instructions */}
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-teal-400" />
                  <span>Instructions ({viewingRecipe.instructions.length} steps)</span>
                </h3>

                <div className="space-y-3">
                  {viewingRecipe.instructions.map((step, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 bg-slate-950/40 border border-slate-800/80 rounded-2xl p-3.5 text-xs sm:text-sm text-slate-300 leading-relaxed"
                    >
                      <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0 border border-emerald-500/30">
                        {idx + 1}
                      </span>
                      <p className="flex-1 pt-0.5">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between gap-3">
              <button
                onClick={() => setViewingRecipe(null)}
                className="px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold text-slate-400 hover:text-white transition-colors"
              >
                Close
              </button>

              <button
                onClick={async () => {
                  if (!householdId) return;
                  const matchedWeekly = meals.find((m) => m.recipe_id === viewingRecipe.id);
                  if (matchedWeekly) {
                    await handleQuickAddToDay(matchedWeekly, format(new Date(), 'yyyy-MM-dd'));
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
                  showToast(`Added "${viewingRecipe.title}" to cooking log!`);
                }}
                className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
              >
                <Check className="w-4 h-4" />
                <span>Made Today · Add to Log</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: PICK FROM SAVED RECIPES ================= */}
      {isRecipePickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-emerald-400" />
                  <span>Pick from Saved Recipes</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Select a recipe to add to your weekly meals
                </p>
              </div>
              <button
                onClick={() => setIsRecipePickerOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Input */}
            <div className="p-4 border-b border-slate-800 bg-slate-950/40">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search recipes by title or tag..."
                  value={recipeSearch}
                  onChange={(e) => setRecipeSearch(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
                />
              </div>
            </div>

            {/* Recipe List */}
            <div className="p-4 overflow-y-auto space-y-2.5 flex-1">
              {filteredRecipes.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-xs sm:text-sm">
                  No recipes found matching "{recipeSearch}"
                </div>
              ) : (
                filteredRecipes.map((r) => {
                  const isAlreadyInWeekly = meals.some((m) => m.recipe_id === r.id);
                  return (
                    <div
                      key={r.id}
                      className="bg-slate-950/60 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-3 flex items-center justify-between gap-3 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {r.image_url ? (
                          <img
                            src={r.image_url}
                            alt={r.title}
                            className="w-12 h-12 rounded-xl object-cover border border-slate-800 shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-emerald-400 shrink-0">
                            <ChefHat className="w-5 h-5 opacity-70" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-white truncate">{r.title}</h4>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                            {r.cook_time_minutes && (
                              <span>{r.cook_time_minutes} min</span>
                            )}
                            {r.servings && <span>· {r.servings} serv</span>}
                            <span>· {r.ingredients?.length || 0} ingr</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleAddRecipeToShopped(r)}
                        disabled={isAlreadyInWeekly}
                        className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 shrink-0 transition-all ${
                          isAlreadyInWeekly
                            ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20'
                        }`}
                      >
                        {isAlreadyInWeekly ? (
                          <span>In Weekly</span>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: MANUAL LOG A MEAL ================= */}
      {isLogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Utensils className="w-4 h-4 text-emerald-400" />
                <span>Log a Meal Made</span>
              </h3>
              <button
                onClick={() => setIsLogModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick-Pick from Weekly Meals if any */}
            {meals.length > 0 && (
              <div className="p-4 bg-slate-950/50 border-b border-slate-800">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Or pick from weekly meals (removes on save):
                </label>
                <div className="flex flex-wrap gap-1.5">
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
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      {m.title}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmitManualLog} className="p-4 sm:p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Meal / Dish Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Spaghetti Bolognese, Chicken Salad..."
                  value={logForm.title}
                  onChange={(e) => setLogForm({ ...logForm, title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Date Cooked
                  </label>
                  <input
                    type="date"
                    value={logForm.date}
                    onChange={(e) => setLogForm({ ...logForm, date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500/60"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Cooked By
                  </label>
                  <select
                    value={logForm.cookedByUserId}
                    onChange={(e) => setLogForm({ ...logForm, cookedByUserId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500/60"
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
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Notes / Rating (Optional)
                </label>
                <textarea
                  placeholder="e.g. Everyone loved the spice level, make again next week!"
                  value={logForm.notes}
                  onChange={(e) => setLogForm({ ...logForm, notes: e.target.value })}
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsLogModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-bold text-xs sm:text-sm shadow-md shadow-emerald-500/20"
                >
                  Save Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= FIXED QUICK INPUT DOCK ================= */}
      <div className="fixed bottom-20 left-0 right-0 z-40 px-4 pointer-events-none">
        <div className="max-w-md mx-auto pointer-events-auto">
          <form
            onSubmit={handleQuickAddDish}
            className="flex items-center gap-2 bg-slate-900/90 border border-slate-800/90 rounded-3xl p-1.5 pl-3 shadow-2xl backdrop-blur-md"
          >
            <Plus className="w-4 h-4 text-emerald-400 shrink-0" />
            <input
              type="text"
              placeholder="Quick add dish to weekly meals..."
              value={quickDishInput}
              onChange={(e) => setQuickDishInput(e.target.value)}
              className="flex-1 min-w-0 bg-transparent text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!quickDishInput.trim() || isAddingQuick}
              className="px-3.5 py-1.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-bold text-xs transition-all shrink-0"
            >
              {isAddingQuick ? 'Adding...' : 'Add'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
export default MealsPage;
