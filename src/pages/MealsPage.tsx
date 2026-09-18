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
  ArrowLeft,
  Link2,
  Pencil,
  ImageIcon,
} from 'lucide-react';
import {
  format,
  isToday,
  isYesterday,
  parseISO,
} from 'date-fns';
import type { WeeklyMeal, MealLog, Recipe } from '../types';
import { usePWA } from '../context/PWAContext';
import { api } from '../lib/api';
import { CheckSparkle, CelebrationConfetti, triggerHapticCheck } from '../components/CheckSparkle';
import { Drawer } from '../components/ui/Drawer';
import { RecipeScraperModal, extractSharedUrl } from '../components/RecipeScraperModal';
import { EditRecipeModal } from '../components/EditRecipeModal';

interface MealsDataCache {
  householdId: string;
  meals: WeeklyMeal[];
  mealLogs: MealLog[];
  recipes: Recipe[];
}

let mealsDataCache: MealsDataCache | null = null;

function resolveInitialSubTab(): 'planner' | 'recipes' | 'history' {
  if (typeof window === 'undefined') return 'planner';
  try {
    const params = new URLSearchParams(window.location.search);
    const pathname = window.location.pathname.toLowerCase();
    if (
      params.has('shared') ||
      params.has('import') ||
      params.has('recipe') ||
      params.get('subtab') === 'recipes' ||
      params.get('view') === 'recipes' ||
      pathname.startsWith('/recipes')
    ) {
      return 'recipes';
    }
    if (params.get('subtab') === 'history' || params.get('view') === 'history') {
      return 'history';
    }
  } catch {}
  return 'planner';
}

export const MealsPage: React.FC = () => {
  const { household, users, currentUser, apiKey } = usePWA();
  const householdId = household?.id;
  const isMountedRef = useRef(true);

  // Sub-views: 'planner' (On deck & ready to shop) | 'recipes' (Recipe Box) | 'history' (Cooked log)
  const [activeTab, setActiveTab] = useState<'planner' | 'recipes' | 'history'>(resolveInitialSubTab);

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

  // Selected recipe detail / Cook Mode
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [isCookMode, setIsCookMode] = useState(false);
  const [checkedIngredients, setCheckedIngredients] = useState<Record<number, boolean>>({});
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({});
  const [justCompletedStep, setJustCompletedStep] = useState<number | null>(null);
  const [justCheckedIngredient, setJustCheckedIngredient] = useState<number | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  // Image regeneration
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [regenerateMode, setRegenerateMode] = useState<'imagen' | 'search' | null>(null);
  const [imageFeedback, setImageFeedback] = useState<string | null>(null);
  const seenImageUrlsRef = useRef<Record<string, string[]>>({});

  // Modals & Drawers
  const [isScraperOpen, setIsScraperOpen] = useState(false);
  const [scraperInitialUrl, setScraperInitialUrl] = useState('');
  const [scraperAutoImport, setScraperAutoImport] = useState(false);
  const [isEditRecipeModalOpen, setIsEditRecipeModalOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [isRecipePickerOpen, setIsRecipePickerOpen] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [recipeSearch, setRecipeSearch] = useState('');

  // Recipe Box search & tags
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Quick Date Picker Modal
  const [quickDateMeal, setQuickDateMeal] = useState<WeeklyMeal | null>(null);
  const [targetDate, setTargetDate] = useState(format(new Date(), 'yyyy-MM-dd'));
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

  const recipeHistoryPushedRef = useRef(false);
  const cookModeHistoryPushedRef = useRef(false);
  const isNavigatingBackRef = useRef(false);

  const showToast = (msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  // Check URL parameters for Web Share Target PWA sharing
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkShareParams = () => {
      const params = new URLSearchParams(window.location.search);
      const sharedUrl = extractSharedUrl(params);
      const isShared = params.get('shared') === 'true' || params.has('shared');

      if (sharedUrl) {
        setScraperInitialUrl(sharedUrl);
        setScraperAutoImport(true);
        setIsScraperOpen(true);
        setActiveTab('recipes');
        const cleanPath = window.location.pathname;
        window.history.replaceState({}, '', cleanPath);
      } else if (isShared || params.has('import')) {
        setIsScraperOpen(true);
        setActiveTab('recipes');
        const cleanPath = window.location.pathname;
        window.history.replaceState({}, '', cleanPath);
      }
    };

    checkShareParams();
    window.addEventListener('popstate', checkShareParams);
    return () => window.removeEventListener('popstate', checkShareParams);
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

  // Check URL parameter for initial recipe selection
  useEffect(() => {
    if (recipes.length > 0 && !selectedRecipe && typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const recipeId = params.get('recipe');
      if (recipeId) {
        const found = recipes.find((r) => r.id === recipeId);
        if (found) {
          setSelectedRecipe(found);
          recipeHistoryPushedRef.current = true;
        }
      }
    }
  }, [recipes]);

  // Popstate listener for mobile phone back button / swipe back gesture
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (isNavigatingBackRef.current) {
        isNavigatingBackRef.current = false;
        return;
      }

      if (e.state?.type === 'drawer' || e.state?.type === 'admin_modal') {
        return;
      }

      if (cookModeHistoryPushedRef.current && e.state?.type !== 'cook_mode') {
        cookModeHistoryPushedRef.current = false;
        setIsCookMode(false);
        return;
      }

      if (recipeHistoryPushedRef.current && e.state?.type !== 'recipe_detail' && e.state?.type !== 'cook_mode') {
        recipeHistoryPushedRef.current = false;
        cookModeHistoryPushedRef.current = false;
        setSelectedRecipe(null);
        setIsCookMode(false);
        setCheckedIngredients({});
        setCompletedSteps({});
        return;
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleSelectRecipe = (recipe: Recipe) => {
    setSelectedRecipe(recipe);
    setIsCookMode(false);
    setCheckedIngredients({});
    setCompletedSteps({});

    if (typeof window !== 'undefined') {
      recipeHistoryPushedRef.current = true;
      const url = new URL(window.location.href);
      url.searchParams.set('recipe', recipe.id);
      window.history.pushState(
        { type: 'recipe_detail', recipeId: recipe.id, tab: 'meals' },
        '',
        url.pathname + (url.search ? url.search : '')
      );
    }
  };

  const handleToggleCookMode = (enable?: boolean) => {
    const nextMode = typeof enable === 'boolean' ? enable : !isCookMode;
    if (nextMode) {
      setIsCookMode(true);
      if (typeof window !== 'undefined') {
        cookModeHistoryPushedRef.current = true;
        window.history.pushState(
          { type: 'cook_mode', recipeId: selectedRecipe?.id, tab: 'meals' },
          '',
          window.location.href
        );
      }
    } else {
      setIsCookMode(false);
      if (cookModeHistoryPushedRef.current) {
        cookModeHistoryPushedRef.current = false;
        isNavigatingBackRef.current = true;
        window.history.back();
      }
    }
  };

  const handleCloseRecipe = () => {
    const hadCookMode = cookModeHistoryPushedRef.current;
    const hadRecipeDetail = recipeHistoryPushedRef.current;

    cookModeHistoryPushedRef.current = false;
    recipeHistoryPushedRef.current = false;
    setSelectedRecipe(null);
    setIsCookMode(false);
    setCheckedIngredients({});
    setCompletedSteps({});

    if (typeof window !== 'undefined') {
      if (hadCookMode && hadRecipeDetail) {
        isNavigatingBackRef.current = true;
        window.history.go(-2);
      } else if (hadRecipeDetail) {
        isNavigatingBackRef.current = true;
        window.history.back();
      }
    }
  };

  /**
   * CORE ACTION: Add a recipe to Planner (puts on deck ready to shop and cook)
   */
  const handleAddRecipeToPlanner = async (recipe: Recipe, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!householdId) return;

    // If already in planner, notify user
    const existing = meals.find((m) => m.recipe_id === recipe.id);
    if (existing) {
      showToast(`"${recipe.title}" is already on deck in your Planner!`);
      return;
    }

    try {
      triggerHapticCheck();
      const added = await api.addWeeklyMeal(householdId, {
        title: recipe.title,
        recipe_id: recipe.id,
      });

      setMeals((prev) => [added, ...prev]);
      if (mealsDataCache && mealsDataCache.householdId === householdId) {
        mealsDataCache.meals = [added, ...mealsDataCache.meals];
      }
      setIsRecipePickerOpen(false);
      showToast(`✓ Added "${recipe.title}" to Planner! On deck & ready to shop.`);
    } catch (err) {
      console.error('Failed to add recipe to planner', err);
      showToast('Error adding recipe to planner');
    }
  };

  /**
   * CORE ACTION: Mark meal as cooked on a given day.
   * Logs to History and removes it from the Planner on deck list!
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

      showToast(`🎉 Added "${meal.title}" to ${dayLabel} & removed from Planner!`);
    } catch (err) {
      console.error('Failed to record cooked meal', err);
      showToast('Error recording meal');
    }
  };

  // Move a logged meal back to the planner (Undo action)
  const handleMoveBackToPlanner = async (log: MealLog) => {
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

      showToast(`↩ Returned "${log.title}" to Planner!`);
    } catch (err) {
      console.error('Failed to move meal back', err);
    }
  };

  // Delete from Planner list
  const handleDeletePlannerMeal = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await api.deleteWeeklyMeal(id);
      setMeals((prev) => prev.filter((m) => m.id !== id));
      if (mealsDataCache && mealsDataCache.householdId === householdId) {
        mealsDataCache.meals = mealsDataCache.meals.filter((m) => m.id !== id);
      }
      showToast('Removed from Planner');
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

  // Quick add custom dish (e.g. "Takeout Pizza" or "Leftovers")
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
      showToast(`Added "${added.title}" to Planner!`);
    } catch (err) {
      console.error('Failed to add meal', err);
    } finally {
      setIsAddingQuick(false);
    }
  };

  // Shop Ingredients to Grocery List
  const handleShopIngredients = async (recipe: Recipe, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!householdId) return;
    try {
      const res = await api.addRecipeToGrocery(recipe, householdId);
      const msg = (res as any).skippedStaplesCount > 0
        ? `Added ${res.addedCount} ingredients (filtered ${(res as any).skippedStaplesCount} pantry staples: water, salt, etc.)!`
        : `Added ${res.addedCount} ingredients to Grocery list!`;
      showToast(msg);
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
      showToast('Error saving meal log');
    }
  };

  // Delete recipe
  const handleDeleteRecipe = async (id: string, title: string) => {
    if (confirm(`Are you sure you want to delete "${title}"?`)) {
      try {
        await api.deleteRecipe(id);
        handleCloseRecipe();
        setRecipes((prev) => prev.filter((r) => r.id !== id));
        if (mealsDataCache && mealsDataCache.householdId === householdId) {
          mealsDataCache.recipes = mealsDataCache.recipes.filter((r) => r.id !== id);
        }
        showToast(`Deleted "${title}"`);
      } catch (err) {
        console.error('Failed to delete recipe:', err);
      }
    }
  };

  // Toggle step completion in Cook Mode / Recipe detail
  const handleToggleStep = (index: number) => {
    if (!selectedRecipe) return;
    const isNowCompleted = !completedSteps[index];

    if (isNowCompleted) {
      triggerHapticCheck();
      setJustCompletedStep(index);
    }

    const nextSteps = {
      ...completedSteps,
      [index]: isNowCompleted,
    };
    setCompletedSteps(nextSteps);

    const isAllDone =
      selectedRecipe.instructions.length > 0 &&
      selectedRecipe.instructions.every((_, idx) => nextSteps[idx]);

    if (isAllDone && isNowCompleted) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 4500);
    }

    if (isNowCompleted) {
      let nextIndex = index + 1;
      while (nextIndex < selectedRecipe.instructions.length && nextSteps[nextIndex]) {
        nextIndex++;
      }
      if (nextIndex >= selectedRecipe.instructions.length && index + 1 < selectedRecipe.instructions.length) {
        nextIndex = index + 1;
      }
      if (nextIndex < selectedRecipe.instructions.length) {
        setTimeout(() => {
          const nextEl = document.getElementById(`recipe-step-${nextIndex}`);
          if (nextEl) {
            nextEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 130);
      }
    }
  };

  const handleToggleIngredient = (index: number) => {
    const isNowChecked = !checkedIngredients[index];
    if (isNowChecked) {
      triggerHapticCheck();
      setJustCheckedIngredient(index);
    }
    setCheckedIngredients((prev) => ({
      ...prev,
      [index]: isNowChecked,
    }));
  };

  const handleResetProgress = () => {
    setCheckedIngredients({});
    setCompletedSteps({});
    setJustCompletedStep(null);
    setJustCheckedIngredient(null);
    setShowConfetti(false);
  };

  // Image regeneration
  const handleRegenerateImage = async (recipeId: string, options: { mode?: 'imagen' | 'search'; customUrl?: string }) => {
    setRegeneratingId(recipeId);
    setRegenerateMode(options.mode || 'search');
    setImageFeedback(null);

    if (!seenImageUrlsRef.current[recipeId]) {
      seenImageUrlsRef.current[recipeId] = [];
    }
    if (selectedRecipe?.image_url && !seenImageUrlsRef.current[recipeId].includes(selectedRecipe.image_url)) {
      seenImageUrlsRef.current[recipeId].push(selectedRecipe.image_url);
    }

    try {
      const res = await api.regenerateRecipeImage(recipeId, {
        mode: options.mode || 'search',
        customUrl: options.customUrl,
        currentImageUrl: selectedRecipe?.image_url,
        seenImageUrls: seenImageUrlsRef.current[recipeId],
        apiKey: apiKey || undefined,
      });
      if (res.success && res.imageUrl) {
        if (!seenImageUrlsRef.current[recipeId].includes(res.imageUrl)) {
          seenImageUrlsRef.current[recipeId].push(res.imageUrl);
        }
        setSelectedRecipe((prev) => (prev && prev.id === recipeId ? { ...prev, image_url: res.imageUrl } : prev));
        setRecipes((prev) =>
          prev.map((r) => (r.id === recipeId ? { ...r, image_url: res.imageUrl } : r))
        );
        setImageFeedback(options.customUrl ? 'Photo URL updated!' : options.mode === 'imagen' ? 'Generated with Imagen!' : 'Found new photo!');
        setTimeout(() => setImageFeedback(null), 3500);
      }
    } catch (err: any) {
      console.error('Failed to regenerate image:', err);
      const isVertexError = err.message?.includes('not found') || err.message?.includes('predict') || err.message?.includes('Imagen');
      if (isVertexError) {
        alert('Google AI Studio standard API keys do not currently support Imagen image generation. Finding a real high-res photograph instead...');
        handleRegenerateImage(recipeId, { mode: 'search' });
      } else {
        alert(err.message || 'Failed to update image.');
      }
    } finally {
      setRegeneratingId(null);
      setRegenerateMode(null);
    }
  };

  const isAiRecipe = (recipe?: { tags?: string[] } | null): boolean => {
    if (!recipe || !recipe.tags) return false;
    return recipe.tags.some((t) => {
      const clean = t.toLowerCase().trim().replace(/^#/, '');
      return clean === 'ai';
    });
  };

  // Recipe filtering for Recipe Box
  const filteredRecipes = recipes.filter((r) => {
    const matchesSearch =
      !searchQuery.trim() ||
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.tags?.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesTag =
      !selectedTag ||
      (selectedTag === 'ai'
        ? isAiRecipe(r)
        : r.tags?.some((t) => t.toLowerCase().trim().replace(/^#/, '') === selectedTag.toLowerCase().trim().replace(/^#/, '')));

    return matchesSearch && matchesTag;
  });

  const allUniqueTags = Array.from(
    new Set(
      recipes.flatMap((r) => r.tags || []).map((t) => t.trim().replace(/^#/, ''))
    )
  ).filter(Boolean);

  const hasAiRecipes = recipes.some((r) => isAiRecipe(r));

  // Group Meal Logs by date for History
  const groupedLogs = mealLogs.reduce<Record<string, MealLog[]>>((acc, log) => {
    const d = log.date || 'Unknown Date';
    if (!acc[d]) acc[d] = [];
    acc[d].push(log);
    return acc;
  }, {});
  const sortedDates = Object.keys(groupedLogs).sort((a, b) => b.localeCompare(a));

  const hasProgress =
    Object.values(checkedIngredients).some(Boolean) ||
    Object.values(completedSteps).some(Boolean);

  const allStepsCompleted =
    !!selectedRecipe &&
    selectedRecipe.instructions.length > 0 &&
    selectedRecipe.instructions.every((_, idx) => completedSteps[idx]);

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 pt-3 pb-36 md:pb-28 space-y-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 border border-emerald-500/40 text-emerald-300 text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-2xl shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200 pointer-events-none flex items-center gap-2 max-w-[90vw] text-center">
          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ================= IF RECIPE DETAIL IS OPEN ================= */}
      {selectedRecipe ? (
        <div className="space-y-4 animate-in fade-in duration-150 relative">
          <CelebrationConfetti active={showConfetti || allStepsCompleted} />

          {/* Top Bar with Back & Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 glass-panel p-3 rounded-2xl border border-white/10">
            <button
              onClick={handleCloseRecipe}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-900/90 hover:bg-slate-850 px-3 py-2 rounded-xl border border-white/10 transition-colors shrink-0 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>

            <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">
              {/* Add to Planner / In Planner Button */}
              {meals.some((m) => m.recipe_id === selectedRecipe.id) ? (
                <span className="px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 shrink-0">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>In Planner</span>
                </span>
              ) : (
                <button
                  onClick={(e) => handleAddRecipeToPlanner(selectedRecipe, e)}
                  className="px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all text-slate-950 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 shadow-md shadow-emerald-500/20 active:scale-95 shrink-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Add to Planner</span>
                </button>
              )}

              {/* Cook Mode Button */}
              <button
                onClick={() => handleToggleCookMode()}
                className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
                  isCookMode
                    ? 'bg-amber-500 text-slate-950 font-bold ring-2 ring-amber-400 shadow-md shadow-amber-500/20'
                    : 'bg-slate-850 hover:bg-slate-800 text-slate-200 border border-white/10'
                }`}
                title={isCookMode ? 'Exit Cook Mode' : 'Start Step-by-Step Cook Mode'}
              >
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">{isCookMode ? 'Exit Cook Mode' : 'Cook Mode'}</span>
                <span className="sm:hidden">{isCookMode ? 'Exit' : 'Cook'}</span>
              </button>

              {/* Shop Ingredients Button */}
              <button
                onClick={(e) => handleShopIngredients(selectedRecipe, e)}
                className="px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all text-slate-200 hover:text-white bg-slate-850 hover:bg-slate-800 border border-white/10 shrink-0 cursor-pointer"
                title="Add ingredients to grocery list"
              >
                <ShoppingCart className="w-3.5 h-3.5 text-pink-400" />
                <span className="hidden sm:inline">Shop Ingredients</span>
              </button>

              {hasProgress && (
                <button
                  onClick={handleResetProgress}
                  className="px-2.5 sm:px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all text-slate-300 hover:text-white bg-slate-850 hover:bg-slate-800 border border-white/10 shrink-0 animate-in fade-in cursor-pointer"
                  title="Uncheck all ingredients and instructions"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Reset</span>
                </button>
              )}

              {/* Edit Recipe Button */}
              <button
                onClick={() => {
                  setEditingRecipe(selectedRecipe);
                  setIsEditRecipeModalOpen(true);
                }}
                className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-850 hover:bg-slate-800 border border-white/10 transition-colors shrink-0 cursor-pointer"
                title="Edit recipe details"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>

              {/* Delete Recipe Button */}
              <button
                onClick={() => handleDeleteRecipe(selectedRecipe.id, selectedRecipe.title)}
                className="p-2 rounded-xl text-slate-400 hover:text-rose-400 bg-slate-850 hover:bg-slate-800 border border-white/10 transition-colors shrink-0 cursor-pointer"
                title="Delete recipe"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Recipe Hero Banner */}
          <div className="relative rounded-3xl overflow-hidden glass-panel border border-white/10 shadow-2xl">
            {selectedRecipe.image_url ? (
              <div className="relative h-64 sm:h-80 w-full overflow-hidden bg-slate-900">
                <img
                  src={selectedRecipe.image_url}
                  alt={selectedRecipe.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
              </div>
            ) : (
              <div className="h-44 sm:h-52 w-full bg-gradient-to-br from-slate-900 to-slate-950 flex items-center justify-center border-b border-white/5">
                <ChefHat className="w-16 h-16 text-slate-700 stroke-1" />
              </div>
            )}

            {/* Photo regeneration feedback & action */}
            <div className="absolute top-3 right-3 flex items-center gap-2">
              {imageFeedback && (
                <span className="text-[11px] font-bold bg-emerald-500 text-slate-950 px-2.5 py-1 rounded-xl shadow-lg animate-in fade-in">
                  {imageFeedback}
                </span>
              )}
              <button
                disabled={Boolean(regeneratingId)}
                onClick={() => handleRegenerateImage(selectedRecipe.id, { mode: 'search' })}
                className="px-2.5 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-850 text-slate-300 hover:text-white border border-white/20 text-[11px] font-semibold flex items-center gap-1.5 backdrop-blur-md transition-all cursor-pointer"
                title="Find a new photograph for this dish"
              >
                {regeneratingId === selectedRecipe.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                ) : (
                  <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <span>Change Photo</span>
              </button>
            </div>

            {/* Title & Metadata */}
            <div className="p-5 sm:p-7 relative -mt-16 sm:-mt-20">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {isAiRecipe(selectedRecipe) && (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-emerald-400" />
                    AI Assistant Recipe
                  </span>
                )}
                {selectedRecipe.tags?.map((t, idx) => (
                  <span
                    key={idx}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white/5 text-slate-400 border border-white/10"
                  >
                    #{t.trim().replace(/^#/, '')}
                  </span>
                ))}
              </div>

              <h2 className="text-xl sm:text-3xl font-black text-white tracking-tight">
                {selectedRecipe.title}
              </h2>

              {selectedRecipe.description && (
                <p className="text-xs sm:text-sm text-slate-300 mt-2 max-w-2xl leading-relaxed">
                  {selectedRecipe.description}
                </p>
              )}

              {/* Stats row */}
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 mt-4 pt-4 border-t border-white/10">
                {selectedRecipe.prep_time_minutes ? (
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-pink-400" />
                    <span>Prep: {selectedRecipe.prep_time_minutes}m</span>
                  </div>
                ) : null}
                {selectedRecipe.cook_time_minutes ? (
                  <div className="flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-amber-400" />
                    <span>Cook: {selectedRecipe.cook_time_minutes}m</span>
                  </div>
                ) : null}
                {selectedRecipe.servings ? (
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-teal-400" />
                    <span>{selectedRecipe.servings} servings</span>
                  </div>
                ) : null}
                <div className="flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{selectedRecipe.ingredients.length} ingredients</span>
                </div>
              </div>
            </div>
          </div>

          {/* Ingredients Section */}
          <div className="glass-panel p-5 rounded-3xl border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wider text-xs">
                <span>Ingredients</span>
                <span className="text-[11px] font-mono text-slate-400 font-normal">
                  ({Object.values(checkedIngredients).filter(Boolean).length}/{selectedRecipe.ingredients.length})
                </span>
              </h3>
              <button
                onClick={(e) => handleShopIngredients(selectedRecipe, e)}
                className="text-xs font-bold text-pink-400 hover:text-pink-300 flex items-center gap-1 bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/20 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>Shop Ingredients</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {selectedRecipe.ingredients.map((ing, idx) => {
                const isChecked = Boolean(checkedIngredients[idx]);
                return (
                  <div
                    key={idx}
                    onClick={() => handleToggleIngredient(idx)}
                    className={`p-2.5 rounded-2xl border transition-all cursor-pointer flex items-center gap-2.5 ${
                      isChecked
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-slate-500'
                        : 'bg-slate-900/60 border-white/5 hover:border-white/10 text-slate-200'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-lg flex items-center justify-center text-xs transition-colors shrink-0 ${
                        isChecked
                          ? 'bg-emerald-500 text-slate-950 font-bold'
                          : 'bg-slate-800 border border-slate-700 text-transparent'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                    <span className={`text-xs leading-tight flex-1 ${isChecked ? 'line-through text-slate-500' : ''}`}>
                      {ing.amount && <strong className="font-semibold text-emerald-400 mr-1">{ing.amount} {ing.unit || ''}</strong>}
                      {ing.item}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step-by-Step Instructions Section */}
          <div className="glass-panel p-5 rounded-3xl border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wider text-xs">
                <span>Instructions</span>
                <span className="text-[11px] font-mono text-slate-400 font-normal">
                  ({Object.values(completedSteps).filter(Boolean).length}/{selectedRecipe.instructions.length})
                </span>
              </h3>
              {allStepsCompleted && (
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> All steps completed!
                </span>
              )}
            </div>

            <div className="space-y-2.5 pt-1">
              {selectedRecipe.instructions.map((step, idx) => {
                const isDone = Boolean(completedSteps[idx]);
                const isJustDone = justCompletedStep === idx;
                return (
                  <div
                    id={`recipe-step-${idx}`}
                    key={idx}
                    onClick={() => handleToggleStep(idx)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden flex items-start gap-3 ${
                      isDone
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-slate-400'
                        : isCookMode
                        ? 'bg-slate-900 border-amber-500/30 text-slate-100 shadow-md'
                        : 'bg-slate-900/60 border-white/5 hover:border-white/10 text-slate-200'
                    }`}
                  >
                    {isJustDone && <CheckSparkle trigger={isJustDone} />}
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                        isDone
                          ? 'bg-emerald-500 text-slate-950'
                          : isCookMode
                          ? 'bg-amber-500 text-slate-950 font-bold'
                          : 'bg-slate-800 border border-slate-700 text-slate-400'
                      }`}
                    >
                      {isDone ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : idx + 1}
                    </div>
                    <p
                      className={`text-xs leading-relaxed transition-all ${
                        isCookMode ? 'text-sm font-medium' : ''
                      } ${isDone ? 'line-through text-slate-500' : 'text-slate-200'}`}
                    >
                      {step}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* ================= MAIN MEALS VIEW (TABS) ================= */
        <div className="space-y-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 shadow-md shadow-emerald-500/20">
                  <ChefHat className="w-5 h-5 stroke-[2.5]" />
                </div>
                Meals
              </h1>
            </div>

            {/* Contextual actions based on active sub-tab */}
            <div className="flex items-center gap-2">
              {activeTab === 'planner' && (
                <>
                  <button
                    onClick={() => setActiveTab('recipes')}
                    className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/10 px-3.5 py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <BookOpen className="w-4 h-4 text-emerald-400" />
                    <span>Browse Recipe Box</span>
                  </button>
                  <button
                    onClick={() => setIsRecipePickerOpen(true)}
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-3.5 py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-emerald-500/20 active:scale-95 cursor-pointer"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    <span>Quick Add</span>
                  </button>
                </>
              )}
              {activeTab === 'recipes' && (
                <>
                  <button
                    onClick={() => setIsScraperOpen(true)}
                    className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/10 px-3.5 py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Link2 className="w-4 h-4 text-emerald-400" />
                    <span>Import Web</span>
                  </button>
                  <button
                    onClick={() => {
                      setEditingRecipe(null);
                      setIsEditRecipeModalOpen(true);
                    }}
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-3.5 py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-emerald-500/20 active:scale-95 cursor-pointer"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    <span>New Recipe</span>
                  </button>
                </>
              )}
              {activeTab === 'history' && (
                <button
                  onClick={() => setIsLogModalOpen(true)}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-3.5 py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-emerald-500/20 active:scale-95 cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>Log Meal</span>
                </button>
              )}
            </div>
          </div>

          {/* 3-Tab Segmented Selector */}
          <div className="flex items-center gap-1 p-1 bg-slate-900/80 rounded-2xl border border-white/10 max-w-md">
            <button
              onClick={() => setActiveTab('planner')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'planner'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Utensils className="w-3.5 h-3.5" />
              <span>Planner</span>
              {meals.length > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                    activeTab === 'planner' ? 'bg-slate-950/25 text-slate-950' : 'bg-emerald-500/20 text-emerald-400'
                  }`}
                >
                  {meals.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('recipes')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'recipes'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Recipe Box</span>
              {recipes.length > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                    activeTab === 'recipes' ? 'bg-slate-950/25 text-slate-950' : 'bg-emerald-500/20 text-emerald-400'
                  }`}
                >
                  {recipes.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>History</span>
              {mealLogs.length > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                    activeTab === 'history' ? 'bg-slate-950/25 text-slate-950' : 'bg-emerald-500/20 text-emerald-400'
                  }`}
                >
                  {mealLogs.length}
                </span>
              )}
            </button>
          </div>

          {/* ================= 1. PLANNER TAB ================= */}
          {activeTab === 'planner' && (
            <div className="space-y-4">
              {isLoading ? (
                <div className="py-12 text-center text-xs text-slate-400">Loading planner...</div>
              ) : meals.length === 0 ? (
                <div className="py-16 text-center glass-panel rounded-3xl p-8 border border-white/5 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
                    <Utensils className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-white">No meals on deck</h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Add recipes from your Recipe Box to put them on deck and ready to shop for!
                  </p>
                  <div className="pt-2 flex items-center justify-center gap-2">
                    <button
                      onClick={() => setActiveTab('recipes')}
                      className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2 rounded-2xl text-xs font-bold inline-flex items-center gap-2 transition-all shadow-md shadow-emerald-500/20 cursor-pointer"
                    >
                      <BookOpen className="w-4 h-4" />
                      <span>Browse Recipe Box</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {meals.map((meal) => {
                    const linkedRecipe = meal.recipe_id ? recipeMap.get(meal.recipe_id) : undefined;
                    return (
                      <div
                        key={meal.id}
                        className="glass-panel rounded-2xl border border-white/10 p-3.5 flex flex-col justify-between gap-3 hover:border-emerald-500/30 transition-all shadow-lg group"
                      >
                        <div className="flex items-start gap-3">
                          {/* Recipe Thumbnail */}
                          {linkedRecipe?.image_url ? (
                            <img
                              src={linkedRecipe.image_url}
                              alt={meal.title}
                              onClick={() => handleSelectRecipe(linkedRecipe)}
                              className="w-14 h-14 rounded-xl object-cover border border-white/10 shrink-0 cursor-pointer hover:opacity-90"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-center text-emerald-400 shrink-0">
                              <ChefHat className="w-6 h-6 opacity-75" />
                            </div>
                          )}

                          {/* Meal Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-1">
                              <h3
                                onClick={() => linkedRecipe && handleSelectRecipe(linkedRecipe)}
                                className={`text-sm font-bold text-white truncate ${
                                  linkedRecipe ? 'cursor-pointer hover:text-emerald-300' : ''
                                }`}
                              >
                                {meal.title}
                              </h3>
                              <button
                                onClick={(e) => handleDeletePlannerMeal(meal.id, e)}
                                className="text-slate-500 hover:text-rose-400 p-1 -mr-1 transition-colors cursor-pointer"
                                title="Remove from Planner"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {meal.notes && (
                              <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{meal.notes}</p>
                            )}

                            {linkedRecipe && (
                              <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1">
                                {linkedRecipe.cook_time_minutes && (
                                  <span className="flex items-center gap-0.5">
                                    <Clock className="w-3 h-3 text-pink-400" />
                                    {linkedRecipe.cook_time_minutes}m
                                  </span>
                                )}
                                <span>· {linkedRecipe.ingredients?.length || 0} ingredients</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Card Action Buttons */}
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/5 text-xs">
                          <div className="flex items-center gap-1.5">
                            {linkedRecipe && (
                              <>
                                <button
                                  onClick={(e) => handleShopIngredients(linkedRecipe, e)}
                                  className="px-2.5 py-1.5 rounded-xl bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 hover:text-pink-300 font-semibold text-[11px] border border-pink-500/20 flex items-center gap-1 transition-all cursor-pointer"
                                  title="Add ingredients to grocery list"
                                >
                                  <ShoppingCart className="w-3 h-3" />
                                  <span>Shop</span>
                                </button>
                                <button
                                  onClick={() => handleSelectRecipe(linkedRecipe)}
                                  className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 font-semibold text-[11px] border border-white/10 flex items-center gap-1 transition-all cursor-pointer"
                                >
                                  <Flame className="w-3 h-3 text-amber-400" />
                                  <span>Cook</span>
                                </button>
                              </>
                            )}
                          </div>

                          {/* Mark as Cooked */}
                          <button
                            onClick={() => {
                              setQuickDateMeal(meal);
                              setTargetDate(format(new Date(), 'yyyy-MM-dd'));
                            }}
                            className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[11px] flex items-center gap-1 shadow-sm transition-all active:scale-95 cursor-pointer ml-auto"
                          >
                            <Check className="w-3 h-3 stroke-[3]" />
                            <span>Mark Cooked</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Quick dish input at bottom of Planner */}
              <div className="glass-panel p-4 rounded-3xl border border-white/10">
                <h4 className="text-xs font-bold text-slate-300 mb-2 uppercase tracking-wider">
                  Quick Add Dish to Planner
                </h4>
                <form onSubmit={handleQuickAddCustom} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Grandma's Lasagna, Takeout Thai, Leftover BBQ..."
                    value={quickDishInput}
                    onChange={(e) => setQuickDishInput(e.target.value)}
                    className="flex-1 bg-slate-900 border border-white/10 rounded-2xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="submit"
                    disabled={isAddingQuick || !quickDishInput.trim()}
                    className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 px-4 py-2 rounded-2xl text-xs font-bold shrink-0 transition-all shadow-md shadow-emerald-500/20 flex items-center gap-1 cursor-pointer"
                  >
                    {isAddingQuick ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 stroke-[2.5]" />}
                    <span>Add</span>
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* ================= 2. RECIPE BOX TAB ================= */}
          {activeTab === 'recipes' && (
            <div className="space-y-4">
              {/* Search Bar & Tag Filters */}
              <div className="space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search recipes by title or tag (e.g. Chicken, Pasta, Soup)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-900/90 border border-white/10 rounded-2xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="p-1.5 text-slate-400 hover:text-white absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Tag Filters */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  <button
                    onClick={() => setSelectedTag(null)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                      selectedTag === null
                        ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                        : 'bg-slate-900/80 text-slate-400 hover:text-white border border-white/5'
                    }`}
                  >
                    All ({recipes.length})
                  </button>

                  {hasAiRecipes && (
                    <button
                      onClick={() => setSelectedTag(selectedTag === 'ai' ? null : 'ai')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1 transition-all cursor-pointer ${
                        selectedTag === 'ai'
                          ? 'bg-gradient-to-tr from-emerald-400 to-teal-300 text-slate-950 shadow-md shadow-emerald-500/20'
                          : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/20'
                      }`}
                    >
                      <Sparkles className="w-3 h-3 text-emerald-400" />
                      <span>AI Recipes</span>
                    </button>
                  )}

                  {allUniqueTags
                    .filter((t) => t.toLowerCase() !== 'ai')
                    .slice(0, 12)
                    .map((tag) => (
                      <button
                        key={tag}
                        onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                          selectedTag === tag
                            ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                            : 'bg-slate-900/80 hover:bg-slate-850 text-slate-300 border border-white/5'
                        }`}
                      >
                        #{tag}
                      </button>
                    ))}
                </div>
              </div>

              {/* Recipe Cards Grid */}
              {isLoading ? (
                <div className="py-12 text-center text-xs text-slate-400">Loading recipes...</div>
              ) : filteredRecipes.length === 0 ? (
                <div className="py-16 text-center glass-panel rounded-3xl p-8 border border-white/5 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
                    <ChefHat className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-white">No recipes found</h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    {searchQuery
                      ? `No recipes match "${searchQuery}".`
                      : 'Import your first recipe by pasting a link from any cooking site or asking the AI Assistant!'}
                  </p>
                  <div className="pt-2">
                    <button
                      onClick={() => setIsScraperOpen(true)}
                      className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2 rounded-2xl text-xs font-bold inline-flex items-center gap-2 transition-all shadow-md shadow-emerald-500/20 cursor-pointer"
                    >
                      <Link2 className="w-4 h-4" />
                      <span>Import Recipe from Web</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {filteredRecipes.map((recipe) => {
                    const isAlreadyInPlanner = meals.some((m) => m.recipe_id === recipe.id);
                    return (
                      <div
                        key={recipe.id}
                        onClick={() => handleSelectRecipe(recipe)}
                        className="glass-panel rounded-3xl border border-white/10 hover:border-emerald-500/40 overflow-hidden cursor-pointer transition-all hover:scale-[1.01] shadow-lg flex flex-col group"
                      >
                        {/* Thumbnail with AI badge */}
                        <div className="relative w-full h-44 overflow-hidden border-b border-white/10 bg-slate-900">
                          {recipe.image_url ? (
                            <img
                              src={recipe.image_url}
                              alt={recipe.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-600">
                              <ChefHat className="w-10 h-10" />
                            </div>
                          )}

                          {isAiRecipe(recipe) && (
                            <div
                              className="absolute bottom-2.5 right-2.5 z-10 w-7 h-7 rounded-xl bg-gradient-to-tr from-emerald-400 to-teal-300 flex items-center justify-center text-zinc-950 shadow-lg shadow-emerald-950/50 border border-white/30"
                              title="Created by AI Assistant"
                            >
                              <Sparkles className="w-4 h-4 stroke-[2.2]" />
                            </div>
                          )}
                        </div>

                        <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                          <div>
                            <h3 className="text-sm font-bold text-white line-clamp-1 group-hover:text-emerald-300 transition-colors">
                              {recipe.title}
                            </h3>
                            {recipe.description && (
                              <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                                {recipe.description}
                              </p>
                            )}

                            {recipe.tags && recipe.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {recipe.tags.slice(0, 3).map((t, idx) => {
                                  const cleanTag = t.trim().replace(/^#/, '');
                                  const isAi = cleanTag.toLowerCase() === 'ai';
                                  return (
                                    <span
                                      key={idx}
                                      className={`text-[10px] px-2 py-0.5 rounded-md border flex items-center gap-0.5 ${
                                        isAi
                                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 font-semibold'
                                          : 'bg-white/5 text-slate-400 border-white/5'
                                      }`}
                                    >
                                      {isAi && <Sparkles className="w-2.5 h-2.5 text-emerald-400" />}
                                      #{cleanTag}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* Footer with "+ Add to Planner" / "✓ In Planner" */}
                          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-white/5">
                            <div className="flex items-center gap-3">
                              {((recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0) > 0) ? (
                                <span className="flex items-center gap-1 font-mono">
                                  <Clock className="w-3 h-3 text-pink-400" />
                                  {(recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0)}m
                                </span>
                              ) : null}
                              <span>{recipe.ingredients.length} items</span>
                            </div>

                            {/* Front of Card Planner Button */}
                            {isAlreadyInPlanner ? (
                              <span className="inline-flex items-center gap-1 text-emerald-400 font-bold bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 rounded-xl text-[11px]">
                                <Check className="w-3 h-3 stroke-[2.5]" />
                                <span>In Planner</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => handleAddRecipeToPlanner(recipe, e)}
                                className="inline-flex items-center gap-1 text-emerald-400 hover:text-white bg-emerald-500/10 hover:bg-emerald-500 border border-emerald-500/30 hover:border-emerald-500 px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
                              >
                                <Plus className="w-3 h-3 stroke-[2.5]" />
                                <span>Add to Planner</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ================= 3. HISTORY TAB ================= */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              {isLoading ? (
                <div className="py-12 text-center text-xs text-slate-400">Loading history...</div>
              ) : mealLogs.length === 0 ? (
                <div className="py-16 text-center glass-panel rounded-3xl p-8 border border-white/5 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
                    <History className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-white">No cooking history yet</h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    As you mark meals cooked in your Planner, your history will automatically record here!
                  </p>
                  <div className="pt-2">
                    <button
                      onClick={() => setIsLogModalOpen(true)}
                      className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2 rounded-2xl text-xs font-bold inline-flex items-center gap-2 transition-all shadow-md shadow-emerald-500/20 cursor-pointer"
                    >
                      <Plus className="w-4 h-4 stroke-[2.5]" />
                      <span>Log a Cooked Meal</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {sortedDates.map((dateStr) => {
                    const logsForDate = groupedLogs[dateStr] || [];
                    const parsed = parseISO(dateStr);
                    const dayLabel = isToday(parsed)
                      ? 'Today'
                      : isYesterday(parsed)
                      ? 'Yesterday'
                      : format(parsed, 'EEEE, MMMM d, yyyy');

                    return (
                      <div key={dateStr} className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-400 px-1">
                          <span className="flex items-center gap-1.5 text-emerald-400">
                            <Calendar className="w-3.5 h-3.5" />
                            {dayLabel}
                          </span>
                          <span className="text-[11px] font-normal text-slate-500">
                            {logsForDate.length} {logsForDate.length === 1 ? 'meal' : 'meals'}
                          </span>
                        </div>

                        <div className="space-y-2">
                          {logsForDate.map((log) => {
                            const cookUser = users.find((u) => u.id === log.cooked_by_user_id);
                            const linkedRecipe = log.recipe_id ? recipeMap.get(log.recipe_id) : undefined;
                            return (
                              <div
                                key={log.id}
                                className="glass-panel p-3.5 rounded-2xl border border-white/10 flex items-center justify-between gap-3 hover:border-white/20 transition-all shadow-md"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  {linkedRecipe?.image_url ? (
                                    <img
                                      src={linkedRecipe.image_url}
                                      alt={log.title}
                                      onClick={() => handleSelectRecipe(linkedRecipe)}
                                      className="w-10 h-10 rounded-xl object-cover border border-white/10 shrink-0 cursor-pointer hover:opacity-90"
                                    />
                                  ) : (
                                    <div className="w-10 h-10 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-center text-emerald-400 shrink-0">
                                      <ChefHat className="w-5 h-5 opacity-70" />
                                    </div>
                                  )}

                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <h4
                                        onClick={() => linkedRecipe && handleSelectRecipe(linkedRecipe)}
                                        className={`text-xs sm:text-sm font-bold text-white truncate ${
                                          linkedRecipe ? 'cursor-pointer hover:text-emerald-300' : ''
                                        }`}
                                      >
                                        {log.title}
                                      </h4>
                                      {linkedRecipe && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400 border border-white/5 hidden sm:inline">
                                          Recipe
                                        </span>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                                      {cookUser && (
                                        <span className="flex items-center gap-1 text-slate-300">
                                          <span
                                            className="w-2 h-2 rounded-full inline-block"
                                            style={{ backgroundColor: cookUser.avatar_color || '#10b981' }}
                                          />
                                          {cookUser.name}
                                        </span>
                                      )}
                                      {log.notes && <span className="truncate italic">"{log.notes}"</span>}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    onClick={() => handleMoveBackToPlanner(log)}
                                    className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-emerald-400 text-xs font-semibold border border-white/10 flex items-center gap-1 transition-all cursor-pointer"
                                    title="Move back to Planner on deck list"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                    <span className="hidden sm:inline">Return to Planner</span>
                                  </button>
                                  <button
                                    onClick={() => handleDeleteLog(log.id)}
                                    className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
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
        </div>
      )}

      {/* ================= DRAWER: QUICK DATE PICKER MODAL ================= */}
      <Drawer
        isOpen={Boolean(quickDateMeal)}
        onClose={() => setQuickDateMeal(null)}
        width="max-w-md"
        title="Mark as Cooked"
        subtitle={`When did you make "${quickDateMeal?.title}"?`}
      >
        {quickDateMeal && (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleMarkMealCooked(quickDateMeal, format(new Date(), 'yyyy-MM-dd'))}
                className="p-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex flex-col items-center gap-1 transition-all shadow-md shadow-emerald-500/20 cursor-pointer"
              >
                <Check className="w-5 h-5 stroke-[3]" />
                <span>Cooked Today</span>
              </button>
              <button
                onClick={() => {
                  const yesterday = new Date();
                  yesterday.setDate(yesterday.getDate() - 1);
                  handleMarkMealCooked(quickDateMeal, format(yesterday, 'yyyy-MM-dd'));
                }}
                className="p-3 rounded-2xl bg-slate-900 hover:bg-slate-850 text-slate-200 border border-white/10 font-bold text-xs flex flex-col items-center gap-1 transition-all cursor-pointer"
              >
                <Clock className="w-5 h-5 text-amber-400" />
                <span>Cooked Yesterday</span>
              </button>
            </div>

            <div className="pt-2 border-t border-white/10 space-y-2">
              <label className="text-xs font-semibold text-slate-400">Or pick a specific date:</label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
                <button
                  onClick={() => handleMarkMealCooked(quickDateMeal, targetDate)}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all cursor-pointer"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* ================= DRAWER: QUICK PICK RECIPE MODAL ================= */}
      <Drawer
        isOpen={isRecipePickerOpen}
        onClose={() => setIsRecipePickerOpen(false)}
        width="max-w-xl"
        title="Add to Planner"
        subtitle="Select recipes from your box to put on deck ready to shop for"
      >
        <div className="flex flex-col h-full">
          <div className="p-4 border-b border-slate-800 bg-slate-950/50">
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

          <div className="p-4 overflow-y-auto space-y-2 flex-1 overscroll-contain">
            {recipes
              .filter(
                (r) =>
                  !recipeSearch.trim() ||
                  r.title.toLowerCase().includes(recipeSearch.toLowerCase()) ||
                  r.tags?.some((t) => t.toLowerCase().includes(recipeSearch.toLowerCase()))
              )
              .map((r) => {
                const isAlreadyInPlanner = meals.some((m) => m.recipe_id === r.id);
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
                          {r.cook_time_minutes && <span>{r.cook_time_minutes}m cook</span>}
                          <span>· {r.ingredients?.length || 0} ingr</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={(e) => handleAddRecipeToPlanner(r, e)}
                      disabled={isAlreadyInPlanner}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 shrink-0 transition-all active:scale-95 cursor-pointer ${
                        isAlreadyInPlanner
                          ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20'
                      }`}
                    >
                      {isAlreadyInPlanner ? (
                        <span>In Planner</span>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Add</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
          </div>

          <div className="p-4 bg-slate-950 border-t border-slate-800 pb-safe">
            <form onSubmit={handleQuickAddCustom} className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Or type a custom dish title..."
                value={quickDishInput}
                onChange={(e) => setQuickDishInput(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                disabled={isAddingQuick || !quickDishInput.trim()}
                className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-500/20 cursor-pointer"
              >
                Add
              </button>
            </form>
          </div>
        </div>
      </Drawer>

      {/* ================= DRAWER: MANUAL LOG MEAL MODAL ================= */}
      <Drawer
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        width="max-w-md"
        title="Log a Cooked Meal"
        subtitle="Record what you cooked into your history"
      >
        <form onSubmit={handleSubmitManualLog} className="p-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">Dish Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Chicken Alfredo, Grilled Salmon..."
              value={logForm.title}
              onChange={(e) => setLogForm((prev) => ({ ...prev, title: e.target.value }))}
              className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">Date Cooked *</label>
            <input
              type="date"
              required
              value={logForm.date}
              onChange={(e) => setLogForm((prev) => ({ ...prev, date: e.target.value }))}
              className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">Who Cooked?</label>
            <select
              value={logForm.cookedByUserId}
              onChange={(e) => setLogForm((prev) => ({ ...prev, cookedByUserId: e.target.value }))}
              className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="">Select family member</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">Notes / Highlights</label>
            <textarea
              rows={2}
              placeholder="Any modifications or ratings..."
              value={logForm.notes}
              onChange={(e) => setLogForm((prev) => ({ ...prev, notes: e.target.value }))}
              className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsLogModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 text-xs font-semibold transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
            >
              Save to History
            </button>
          </div>
        </form>
      </Drawer>

      {/* ================= MODAL: RECIPE SCRAPER ================= */}
      {householdId && (
        <RecipeScraperModal
          isOpen={isScraperOpen}
          onClose={() => {
            setIsScraperOpen(false);
            setScraperInitialUrl('');
            setScraperAutoImport(false);
          }}
          householdId={householdId}
          initialUrl={scraperInitialUrl}
          autoImport={scraperAutoImport}
          onRecipeImported={(newRec) => {
            setRecipes((prev) => {
              const exists = prev.some((r) => r.id === newRec.id);
              const updated = exists ? prev.map((r) => (r.id === newRec.id ? newRec : r)) : [newRec, ...prev];
              if (mealsDataCache && mealsDataCache.householdId === householdId) {
                mealsDataCache.recipes = updated;
              }
              return updated;
            });
            handleSelectRecipe(newRec);
            setIsScraperOpen(false);
            setScraperInitialUrl('');
            setScraperAutoImport(false);
          }}
        />
      )}

      {/* ================= MODAL: EDIT RECIPE ================= */}
      {isEditRecipeModalOpen && (
        <EditRecipeModal
          isOpen={isEditRecipeModalOpen}
          onClose={() => {
            setIsEditRecipeModalOpen(false);
            setEditingRecipe(null);
          }}
          recipe={
            editingRecipe || {
              id: '',
              household_id: householdId || '',
              title: '',
              ingredients: [],
              instructions: [],
              tags: [],
              created_at: new Date().toISOString(),
            }
          }
          onSave={(updated) => {
            if (selectedRecipe && selectedRecipe.id === updated.id) {
              setSelectedRecipe(updated);
            }
            setRecipes((prev) => {
              const exists = prev.some((r) => r.id === updated.id);
              const next = exists ? prev.map((r) => (r.id === updated.id ? updated : r)) : [updated, ...prev];
              if (mealsDataCache && mealsDataCache.householdId === householdId) {
                mealsDataCache.recipes = next;
              }
              return next;
            });
            setIsEditRecipeModalOpen(false);
            setEditingRecipe(null);
          }}
        />
      )}
    </div>
  );
};
