import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  RefreshCw,
  Loader2,
  Sparkles,
  ExternalLink,
  User,
  Users,
  Search,
  Zap,
  ChevronRight,
  ChevronDown,
  Flame,
  ArrowLeft,
  Link2,
  Pencil,
  ImageIcon,
  Camera,
  Package,
  Barcode,
  AlertTriangle,
  Star,
  Tag,
} from 'lucide-react';
import { compressImageFile } from '../lib/imageCompression';
import {
  format,
  isToday,
  isYesterday,
  parseISO,
} from 'date-fns';
import type { WeeklyMeal, MealLog, Recipe, GroceryItem, InventoryItem, PantryLocation } from '../types';
import { usePWA } from '../context/PWAContext';
import { api } from '../lib/api';
import { CheckSparkle, CelebrationConfetti, triggerHapticCheck } from '../components/CheckSparkle';
import { Drawer } from '../components/ui/Drawer';
import { RecipeScraperModal, extractSharedUrl } from '../components/RecipeScraperModal';
import { EditRecipeModal } from '../components/EditRecipeModal';
import { BarcodeScannerModal } from '../components/inventory/BarcodeScannerModal';
import { VisionScanModal } from '../components/inventory/VisionScanModal';
import { EditInventoryModal } from '../components/inventory/EditInventoryModal';
import { getFreshnessBadge, getLocationMeta } from '../lib/shelfLife';
import { useFabAutoClose } from '../hooks/useFabAutoClose';
import { Toast } from '../components/ui/Toast';

interface MealsDataCache {
  householdId: string;
  meals: WeeklyMeal[];
  mealLogs: MealLog[];
  recipes: Recipe[];
  groceryItems?: GroceryItem[];
  inventoryItems?: InventoryItem[];
}

let mealsDataCache: MealsDataCache | null = null;

function resolveInitialSubTab(): 'recipes' | 'planner' | 'pantry' | 'history' {
  if (typeof window === 'undefined') return 'recipes';
  try {
    const params = new URLSearchParams(window.location.search);
    const pathname = window.location.pathname.toLowerCase();
    if (params.get('subtab') === 'planner' || params.get('view') === 'planner') {
      return 'planner';
    }
    if (params.get('subtab') === 'pantry' || params.get('view') === 'pantry' || params.get('tab') === 'pantry') {
      return 'pantry';
    }
    if (params.get('subtab') === 'history' || params.get('view') === 'history') {
      return 'history';
    }
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
  } catch {}
  return 'recipes';
}

export const MealsPage: React.FC = () => {
  const { household, users, currentUser, apiKey } = usePWA();
  const householdId = household?.id;
  const isMountedRef = useRef(true);

  // Sub-views: 'recipes' | 'planner' | 'pantry' | 'history'
  const [activeTab, setActiveTab] = useState<'recipes' | 'planner' | 'pantry' | 'history'>(resolveInitialSubTab);

  // Keep visited tabs mounted with CSS display:none for instant 0ms switching without DOM thrashing
  const [visitedTabs, setVisitedTabs] = useState<Record<string, boolean>>(() => ({
    [resolveInitialSubTab()]: true,
  }));

  const handleTabChange = (tab: 'recipes' | 'planner' | 'pantry' | 'history') => {
    setActiveTab(tab);
    setVisitedTabs((prev) => (prev[tab] ? prev : { ...prev, [tab]: true }));
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    if (tab !== 'recipes') {
      setIsRecipeFabOpen(false);
    }
    setIsPantryAddMenuOpen(false);
  };

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
  const [groceryItems, setGroceryItems] = useState<GroceryItem[]>(() => {
    return mealsDataCache && mealsDataCache.householdId === householdId && mealsDataCache.groceryItems
      ? mealsDataCache.groceryItems
      : [];
  });
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>(() => {
    return mealsDataCache && mealsDataCache.householdId === householdId && mealsDataCache.inventoryItems
      ? mealsDataCache.inventoryItems
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

  // Image regeneration & photo replacement
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [regenerateMode, setRegenerateMode] = useState<'imagen' | 'search' | null>(null);
  const [imageFeedback, setImageFeedback] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [scraperInitialMode, setScraperInitialMode] = useState<'scan' | 'url' | 'text'>('scan');
  const photoFileInputRef = useRef<HTMLInputElement | null>(null);
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

  // Multi-action Recipe FAB
  const [isRecipeFabOpen, setIsRecipeFabOpen] = useState(false);
  const recipeFabRef = useFabAutoClose<HTMLDivElement>({
    isOpen: isRecipeFabOpen,
    onClose: () => setIsRecipeFabOpen(false),
    ignore: isScraperOpen || isEditRecipeModalOpen || Boolean(selectedRecipe),
  });

  // Pantry state & modals
  const [pantryFilter, setPantryFilter] = useState<'all' | 'fridge' | 'freezer' | 'pantry' | 'expiring' | 'staples'>('all');
  const [pantrySearchQuery, setPantrySearchQuery] = useState('');
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [isVisionModalOpen, setIsVisionModalOpen] = useState(false);
  const [isEditInventoryModalOpen, setIsEditInventoryModalOpen] = useState(false);
  const [editingInventoryItem, setEditingInventoryItem] = useState<InventoryItem | null>(null);
  const [isPantryAddMenuOpen, setIsPantryAddMenuOpen] = useState(false);
  const pantryAddDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pantryAddDropdownRef.current && !pantryAddDropdownRef.current.contains(e.target as Node)) {
        setIsPantryAddMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Recipe search & tags
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
  const [toastAction, setToastAction] = useState<{ label: string; onClick: () => void } | undefined>(undefined);
  const toastTimeoutRef = useRef<any>(null);

  // Pantry check-off animation state
  const [crossingOffPantryIds, setCrossingOffPantryIds] = useState<Record<string, boolean>>({});
  const pantryCrossingTimersRef = useRef<Record<string, any>>({});

  // Transient feedback for adding to planner and grocery
  const [justAddedRecipeId, setJustAddedRecipeId] = useState<string | null>(null);
  const justAddedTimeoutRef = useRef<any>(null);
  const [justAddedGroceryId, setJustAddedGroceryId] = useState<string | null>(null);
  const justAddedGroceryTimeoutRef = useRef<any>(null);

  const recipeHistoryPushedRef = useRef(false);
  const cookModeHistoryPushedRef = useRef(false);
  const isNavigatingBackRef = useRef(false);

  const showToast = (msg: string, action?: { label: string; onClick: () => void }) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    setToastAction(action);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
      setToastAction(undefined);
    }, action ? 5000 : 3500);
  };

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      if (justAddedTimeoutRef.current) clearTimeout(justAddedTimeoutRef.current);
      if (justAddedGroceryTimeoutRef.current) clearTimeout(justAddedGroceryTimeoutRef.current);
      Object.values(pantryCrossingTimersRef.current).forEach((t) => clearTimeout(t));
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
        handleTabChange('recipes');
        const cleanPath = window.location.pathname;
        window.history.replaceState({}, '', cleanPath);
      } else if (isShared || params.has('import')) {
        setIsScraperOpen(true);
        handleTabChange('recipes');
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
      if (mealsDataCache.groceryItems) {
        setGroceryItems(mealsDataCache.groceryItems);
      }
      if (mealsDataCache.inventoryItems) {
        setInventoryItems(mealsDataCache.inventoryItems);
      }
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }

    try {
      const [weeklyRes, logsRes, recRes, groceryRes, inventoryRes] = await Promise.all([
        api.getWeeklyMeals(householdId),
        api.getMealLogs(householdId),
        api.getRecipes(householdId),
        api.getGroceryItems(householdId),
        api.getInventory(),
      ]);

      if (!isMountedRef.current) return;

      const unmadeMeals = weeklyRes.filter((m) => !m.is_made);
      setMeals(unmadeMeals);
      setMealLogs(logsRes);
      setRecipes(recRes);
      setGroceryItems(groceryRes);
      setInventoryItems(inventoryRes);

      mealsDataCache = {
        householdId,
        meals: unmadeMeals,
        mealLogs: logsRes,
        recipes: recRes,
        groceryItems: groceryRes,
        inventoryItems: inventoryRes,
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
  const recipeMap = useMemo(() => {
    const map = new Map<string, Recipe>();
    recipes.forEach((r) => map.set(r.id, r));
    return map;
  }, [recipes]);

  // Helper to check if a recipe's ingredients are currently on the grocery list
  const isRecipeInGrocery = (recipeTitle?: string) => {
    if (!recipeTitle) return false;
    const prefix = `for: ${recipeTitle.trim().toLowerCase()}`;
    return groceryItems.some(
      (item) => !item.is_completed && item.notes && item.notes.trim().toLowerCase().startsWith(prefix)
    );
  };

  // Helper to find an active grocery item matching a specific recipe ingredient
  const findGroceryItemForIngredient = (recipeTitle: string, ingredientName: string) => {
    if (!recipeTitle || !ingredientName) return null;
    const normIng = ingredientName.trim().toLowerCase();
    const prefix = `for: ${recipeTitle.trim().toLowerCase()}`;

    // 1. Tagged with note for this recipe, matching ingredient name exactly
    const forThisRecipeExact = groceryItems.find(
      (item) =>
        !item.is_completed &&
        item.notes &&
        item.notes.trim().toLowerCase().startsWith(prefix) &&
        item.name.trim().toLowerCase() === normIng
    );
    if (forThisRecipeExact) return forThisRecipeExact;

    // 2. Tagged with note for this recipe, matching ingredient name partially
    const forThisRecipePartial = groceryItems.find(
      (item) =>
        !item.is_completed &&
        item.notes &&
        item.notes.trim().toLowerCase().startsWith(prefix) &&
        (item.name.trim().toLowerCase().includes(normIng) || normIng.includes(item.name.trim().toLowerCase()))
    );
    if (forThisRecipePartial) return forThisRecipePartial;

    // 3. Fallback: Any active grocery item with exact same ingredient name
    return (
      groceryItems.find(
        (item) => !item.is_completed && item.name.trim().toLowerCase() === normIng
      ) || null
    );
  };

  // Helper to check if a pantry item is currently on the grocery list
  const isPantryItemInGrocery = (item: InventoryItem) => {
    if (!item?.name) return false;
    const clean = item.name.toLowerCase().trim();
    return groceryItems.some(
      (g) => !g.is_completed && g.name.toLowerCase().trim() === clean
    );
  };

  const checkedIngredientsRef = useRef(checkedIngredients);
  useEffect(() => {
    checkedIngredientsRef.current = checkedIngredients;
  }, [checkedIngredients]);

  // Synchronize checked ingredients with grocery list membership
  useEffect(() => {
    if (!selectedRecipe) return;
    const nextChecked: Record<number, boolean> = {};
    selectedRecipe.ingredients.forEach((ing, idx) => {
      if (findGroceryItemForIngredient(selectedRecipe.title, ing.item)) {
        nextChecked[idx] = true;
      }
    });
    setCheckedIngredients(nextChecked);
  }, [selectedRecipe?.id, groceryItems]);

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
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });

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

  // Always ensure window is scrolled to top whenever a recipe is opened
  useEffect(() => {
    if (selectedRecipe) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    }
  }, [selectedRecipe?.id]);

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
   * CORE ACTION: Toggle a recipe in Planner (add or remove from on-deck list)
   */
  const handleToggleRecipePlanner = async (recipe: Recipe, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!householdId) return;

    const existing = meals.find((m) => m.recipe_id === recipe.id);

    if (existing) {
      setJustAddedRecipeId(null);
      // Optimistically remove from planner
      const mealIdToRemove = existing.id;
      const previousMeals = meals;
      setMeals((prev) => prev.filter((m) => m.recipe_id !== recipe.id));
      if (mealsDataCache && mealsDataCache.householdId === householdId) {
        mealsDataCache.meals = mealsDataCache.meals.filter((m) => m.recipe_id !== recipe.id);
      }
      showToast(`Removed "${recipe.title}" from Planner`);

      if (mealIdToRemove.startsWith('temp-')) {
        return;
      }

      try {
        triggerHapticCheck();
        await api.deleteWeeklyMeal(mealIdToRemove);
      } catch (err) {
        console.error('Failed to remove recipe from planner', err);
        setMeals(previousMeals);
        if (mealsDataCache && mealsDataCache.householdId === householdId) {
          mealsDataCache.meals = previousMeals;
        }
        showToast(`Failed to remove "${recipe.title}" from Planner`);
      }
      return;
    }

    // Optimistic temporary meal so the button flips to "In Planner" instantly
    const tempId = `temp-${Date.now()}`;
    const tempMeal: WeeklyMeal = {
      id: tempId,
      household_id: householdId,
      title: recipe.title,
      recipe_id: recipe.id,
      is_made: false,
      week_start_date: new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString(),
    };

    setMeals((prev) => [tempMeal, ...prev]);
    if (mealsDataCache && mealsDataCache.householdId === householdId) {
      mealsDataCache.meals = [tempMeal, ...mealsDataCache.meals];
    }
    setJustAddedRecipeId(recipe.id);
    if (justAddedTimeoutRef.current) clearTimeout(justAddedTimeoutRef.current);
    justAddedTimeoutRef.current = setTimeout(() => {
      setJustAddedRecipeId((prev) => (prev === recipe.id ? null : prev));
    }, 2500);
    showToast(`Added "${recipe.title}" to Planner!`);

    try {
      triggerHapticCheck();
      const added = await api.addWeeklyMeal(householdId, {
        title: recipe.title,
        recipe_id: recipe.id,
      });

      // Replace temp record with server record, unless user removed it while request was in-flight
      setMeals((prev) => {
        const stillPresent = prev.some((m) => m.id === tempId || m.recipe_id === recipe.id);
        if (!stillPresent) {
          api.deleteWeeklyMeal(added.id).catch(console.error);
          return prev;
        }
        return prev.map((m) => (m.id === tempId ? added : m));
      });
      if (mealsDataCache && mealsDataCache.householdId === householdId) {
        mealsDataCache.meals = mealsDataCache.meals.map((m) => (m.id === tempId ? added : m));
      }
    } catch (err) {
      console.error('Failed to add recipe to planner', err);
      // Roll back on failure
      setMeals((prev) => prev.filter((m) => m.id !== tempId));
      if (mealsDataCache && mealsDataCache.householdId === householdId) {
        mealsDataCache.meals = mealsDataCache.meals.filter((m) => m.id !== tempId);
      }
      showToast(`Failed to add "${recipe.title}" to Planner`);
    }
  };

  const handleAddRecipeToPlanner = handleToggleRecipePlanner;

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

  // Helper to cross-reference recipe ingredients with active household pantry inventory
  const getIngredientPantryMatch = (ingItem: string): InventoryItem | undefined => {
    if (!ingItem || !inventoryItems || inventoryItems.length === 0) return undefined;
    const clean = ingItem.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
    const words = clean.split(/\s+/).filter((w) => w.length > 2 && !['cup', 'cups', 'tbsp', 'tsp', 'oz', 'pound', 'pounds', 'gram', 'grams', 'can', 'cans', 'clove', 'cloves', 'slice', 'slices', 'large', 'small', 'medium'].includes(w));

    return inventoryItems.find((inv) => {
      const invClean = inv.name.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
      if (invClean === clean || invClean.includes(clean) || clean.includes(invClean)) return true;
      return words.some((w) => invClean.includes(w) && w.length >= 4);
    });
  };

  // Shop / Remove Ingredients to/from Grocery List
  const handleToggleShopIngredients = async (recipe: Recipe, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!householdId) return;

    const inGrocery = isRecipeInGrocery(recipe.title);
    const prefix = `for: ${recipe.title.trim().toLowerCase()}`;

    if (inGrocery) {
      setJustAddedGroceryId(null);
      // Optimistically remove from grocery items
      const previousItems = groceryItems;
      const updated = groceryItems.filter(
        (item) => !item.notes || !item.notes.trim().toLowerCase().startsWith(prefix)
      );
      setGroceryItems(updated);
      if (mealsDataCache && mealsDataCache.householdId === householdId) {
        mealsDataCache.groceryItems = updated;
      }
      showToast(`Removed "${recipe.title}" ingredients from Grocery list`);

      try {
        triggerHapticCheck();
        await api.removeRecipeFromGrocery(recipe.title, householdId);
      } catch (err) {
        console.error('Failed to remove ingredients', err);
        setGroceryItems(previousItems);
        if (mealsDataCache && mealsDataCache.householdId === householdId) {
          mealsDataCache.groceryItems = previousItems;
        }
        showToast('Error removing ingredients');
      }
      return;
    }

    // Optimistically add ingredients to grocery list immediately
    const previousItems = groceryItems;
    const rawIngredients = recipe.ingredients && recipe.ingredients.length > 0
      ? recipe.ingredients
      : [{ item: recipe.title, amount: '', unit: '', category: 'Other' }];

    const matchedInPantry = rawIngredients.filter((ing) => Boolean(getIngredientPantryMatch(ing.item)));
    const ingredientsToAdd = rawIngredients.filter((ing) => !getIngredientPantryMatch(ing.item));

    if (ingredientsToAdd.length === 0 && matchedInPantry.length > 0) {
      showToast(`All ingredients for "${recipe.title}" are already in your pantry! 🎉`);
      return;
    }

    const optimisticItems: GroceryItem[] = ingredientsToAdd.map((ing, idx) => ({
      id: `temp-g-${Date.now()}-${idx}`,
      household_id: householdId,
      aisle_id: '',
      name: ing.item,
      quantity: ing.amount,
      unit: ing.unit,
      notes: `For: ${recipe.title}`,
      is_completed: false,
      list_type: 'grocery',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    const nextGrocery = [...optimisticItems, ...groceryItems];
    setGroceryItems(nextGrocery);
    if (mealsDataCache && mealsDataCache.householdId === householdId) {
      mealsDataCache.groceryItems = nextGrocery;
    }
    setJustAddedGroceryId(recipe.id);
    if (justAddedGroceryTimeoutRef.current) clearTimeout(justAddedGroceryTimeoutRef.current);
    justAddedGroceryTimeoutRef.current = setTimeout(() => {
      setJustAddedGroceryId((prev) => (prev === recipe.id ? null : prev));
    }, 2500);

    const toastMsg = matchedInPantry.length > 0
      ? `Added ${ingredientsToAdd.length} items to Grocery (skipped ${matchedInPantry.length} already in pantry!)`
      : `Added "${recipe.title}" ingredients to Grocery list!`;
    showToast(toastMsg);
    triggerHapticCheck();

    try {
      await api.addRecipeToGrocery(recipe, householdId, {
        excludeItemNames: matchedInPantry.map((m) => m.item),
      });
      const refreshedItems = await api.getGroceryItems(householdId);
      setGroceryItems(refreshedItems);
      if (mealsDataCache && mealsDataCache.householdId === householdId) {
        mealsDataCache.groceryItems = refreshedItems;
      }
    } catch (err) {
      console.error('Failed to add ingredients', err);
      setGroceryItems(previousItems);
      if (mealsDataCache && mealsDataCache.householdId === householdId) {
        mealsDataCache.groceryItems = previousItems;
      }
      showToast('Error adding ingredients');
    }
  };

  const handleShopIngredients = handleToggleShopIngredients;

  const handleToggleRestockPantryItem = async (item: InventoryItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!householdId) return;

    const inGrocery = isPantryItemInGrocery(item);
    const cleanName = item.name.toLowerCase().trim();

    if (inGrocery) {
      // Optimistically remove from grocery list
      const previousGrocery = groceryItems;
      const updatedGrocery = groceryItems.filter(
        (g) => !(g.name.toLowerCase().trim() === cleanName && !g.is_completed)
      );
      setGroceryItems(updatedGrocery);
      if (mealsDataCache && mealsDataCache.householdId === householdId) {
        mealsDataCache.groceryItems = updatedGrocery;
      }
      triggerHapticCheck();
      showToast(`Removed "${item.name}" from your Grocery List`);

      try {
        await api.unrestockInventoryItemFromGrocery(item.id);
        const refreshed = await api.getGroceryItems(householdId);
        setGroceryItems(refreshed);
        if (mealsDataCache && mealsDataCache.householdId === householdId) {
          mealsDataCache.groceryItems = refreshed;
        }
      } catch (err) {
        console.error('Failed to remove restocked item from grocery', err);
        setGroceryItems(previousGrocery);
        if (mealsDataCache && mealsDataCache.householdId === householdId) {
          mealsDataCache.groceryItems = previousGrocery;
        }
        showToast(`Failed to remove "${item.name}" from grocery list`);
      }
      return;
    }

    // Otherwise, add to grocery list
    const previousGrocery = groceryItems;
    const optimisticGroceryItem: GroceryItem = {
      id: `temp-restock-${Date.now()}`,
      household_id: householdId,
      aisle_id: '',
      name: item.name,
      quantity: item.quantity || '1',
      unit: item.unit || '',
      notes: 'From Pantry Restock',
      is_completed: false,
      list_type: 'grocery',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const nextGrocery = [optimisticGroceryItem, ...groceryItems];
    setGroceryItems(nextGrocery);
    if (mealsDataCache && mealsDataCache.householdId === householdId) {
      mealsDataCache.groceryItems = nextGrocery;
    }
    triggerHapticCheck();
    showToast(`Added "${item.name}" to your Grocery List!`);

    try {
      await api.restockInventoryItemToGrocery(item.id);
      const refreshed = await api.getGroceryItems(householdId);
      setGroceryItems(refreshed);
      if (mealsDataCache && mealsDataCache.householdId === householdId) {
        mealsDataCache.groceryItems = refreshed;
      }
    } catch (err) {
      console.error('Failed to add restocked item to grocery', err);
      setGroceryItems(previousGrocery);
      if (mealsDataCache && mealsDataCache.householdId === householdId) {
        mealsDataCache.groceryItems = previousGrocery;
      }
      showToast(`Failed to add "${item.name}" to grocery list`);
    }
  };

  const handleRestockPantryItem = handleToggleRestockPantryItem;

  // Check off / consume pantry item with haptic check, animation, and undo toast
  const handleCheckOffPantryItem = (item: InventoryItem) => {
    if (!householdId) return;
    const itemId = item.id;
    if (crossingOffPantryIds[itemId]) return;

    triggerHapticCheck();
    setCrossingOffPantryIds((prev) => ({ ...prev, [itemId]: true }));

    pantryCrossingTimersRef.current[itemId] = setTimeout(async () => {
      delete pantryCrossingTimersRef.current[itemId];
      setCrossingOffPantryIds((prev) => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });

      // Optimistically remove from state
      const previousItems = inventoryItems;
      setInventoryItems((prev) => {
        const updated = prev.filter((i) => i.id !== itemId);
        if (mealsDataCache && mealsDataCache.householdId === householdId) {
          mealsDataCache.inventoryItems = updated;
        }
        return updated;
      });

      // Show toast with Undo action
      showToast(`Used up "${item.name}"`, {
        label: 'Undo',
        onClick: async () => {
          try {
            const restored = await api.addInventoryItem({
              name: item.name,
              category: item.category,
              location: item.location,
              quantity: item.quantity,
              unit: item.unit,
              expiresAt: item.expiresAt,
              isStock: item.isStock,
              restockCadenceDays: item.restockCadenceDays,
            });
            setInventoryItems((prev) => {
              const updated = [restored, ...prev.filter((i) => i.id !== restored.id)];
              if (mealsDataCache && mealsDataCache.householdId === householdId) {
                mealsDataCache.inventoryItems = updated;
              }
              return updated;
            });
            showToast(`Restored "${item.name}"`);
          } catch (err) {
            console.error('Failed to restore inventory item', err);
            try {
              const refreshed = await api.getInventory();
              setInventoryItems(refreshed);
              if (mealsDataCache && mealsDataCache.householdId === householdId) {
                mealsDataCache.inventoryItems = refreshed;
              }
            } catch {}
          }
        },
      });

      try {
        await api.deleteInventoryItem(itemId);
      } catch (err) {
        console.error('Failed to delete checked off inventory item', err);
        setInventoryItems(previousItems);
        if (mealsDataCache && mealsDataCache.householdId === householdId) {
          mealsDataCache.inventoryItems = previousItems;
        }
        showToast(`Failed to remove "${item.name}"`);
      }
    }, 380);
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

      // If this recipe is currently in the Planner, automatically mark it as cooked today and complete it in Planner!
      const matchingMeal = meals.find(
        (m) =>
          m.recipe_id === selectedRecipe.id ||
          (m.title && m.title.trim().toLowerCase() === selectedRecipe.title.trim().toLowerCase())
      );
      if (matchingMeal) {
        handleMarkMealCooked(matchingMeal, format(new Date(), 'yyyy-MM-dd'));
      }
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

  const handleToggleIngredient = async (index: number) => {
    if (!selectedRecipe || !householdId) return;
    const ing = selectedRecipe.ingredients[index];
    if (!ing || !ing.item) return;

    const currentlyChecked = Boolean(checkedIngredients[index]);
    const isNowChecked = !currentlyChecked;

    // Optimistically update checked state
    setCheckedIngredients((prev) => ({
      ...prev,
      [index]: isNowChecked,
    }));

    if (isNowChecked) {
      triggerHapticCheck();
      setJustCheckedIngredient(index);

      // Optimistically add to grocery items
      const tempId = `temp-g-${Date.now()}-${index}`;
      const optimisticItem: GroceryItem = {
        id: tempId,
        household_id: householdId,
        aisle_id: '',
        name: ing.item,
        quantity: ing.amount || '',
        unit: ing.unit || '',
        notes: `For: ${selectedRecipe.title}`,
        is_completed: false,
        list_type: 'grocery',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const nextGrocery = [optimisticItem, ...groceryItems];
      setGroceryItems(nextGrocery);
      if (mealsDataCache && mealsDataCache.householdId === householdId) {
        mealsDataCache.groceryItems = nextGrocery;
      }
      showToast(`Added "${ing.item}" to Grocery list`);

      try {
        const created = await api.addGroceryItem(householdId, {
          name: ing.item,
          quantity: ing.amount,
          unit: ing.unit,
          category: ing.category,
          notes: `For: ${selectedRecipe.title}`,
        });

        // If the user unchecked it while the request was in-flight, delete it immediately
        if (!checkedIngredientsRef.current[index]) {
          await api.deleteGroceryItem(created.id);
          return;
        }

        setGroceryItems((prev) =>
          prev.map((item) => (item.id === tempId ? created : item))
        );
        if (mealsDataCache && mealsDataCache.householdId === householdId) {
          mealsDataCache.groceryItems = mealsDataCache.groceryItems?.map((item) =>
            item.id === tempId ? created : item
          );
        }
      } catch (err) {
        console.error('Failed to add ingredient to grocery', err);
        setGroceryItems((prev) => prev.filter((item) => item.id !== tempId));
        setCheckedIngredients((prev) => ({ ...prev, [index]: false }));
        showToast(`Failed to add "${ing.item}"`);
      }
    } else {
      // Find matching item in grocery list to delete
      const match = findGroceryItemForIngredient(selectedRecipe.title, ing.item);
      if (match) {
        const previousGrocery = groceryItems;
        const nextGrocery = groceryItems.filter((item) => item.id !== match.id);
        setGroceryItems(nextGrocery);
        if (mealsDataCache && mealsDataCache.householdId === householdId) {
          mealsDataCache.groceryItems = nextGrocery;
        }
        showToast(`Removed "${ing.item}" from Grocery list`);

        try {
          await api.deleteGroceryItem(match.id);
        } catch (err) {
          console.error('Failed to remove grocery item', err);
          setGroceryItems(previousGrocery);
          setCheckedIngredients((prev) => ({ ...prev, [index]: true }));
          showToast(`Failed to remove "${ing.item}"`);
        }
      }
    }
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

  const handleTakeOrReplacePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedRecipe) return;
    setIsUploadingPhoto(true);
    try {
      const compressed = await compressImageFile(file, { maxWidth: 1280, maxHeight: 1280, quality: 0.82 });
      const updated = await api.updateRecipe(selectedRecipe.id, { image_url: compressed.dataUrl });
      setSelectedRecipe(updated);
      setRecipes((prev) => {
        const next = prev.map((r) => (r.id === updated.id ? updated : r));
        if (mealsDataCache && mealsDataCache.householdId === householdId) {
          mealsDataCache.recipes = next;
        }
        return next;
      });
      setImageFeedback('Photo updated!');
      setTimeout(() => setImageFeedback(null), 3000);
    } catch (err: any) {
      console.error('Failed to update photo:', err);
      alert('Failed to update photo: ' + (err.message || 'Unknown error'));
    } finally {
      setIsUploadingPhoto(false);
      if (e.target) e.target.value = '';
    }
  };

  const isAiRecipe = (recipe?: { tags?: string[] } | null): boolean => {
    if (!recipe || !recipe.tags) return false;
    return recipe.tags.some((t) => {
      const clean = t.toLowerCase().trim().replace(/^#/, '');
      return clean === 'ai';
    });
  };

  // Recipe filtering for Recipe Box (memoized)
  const filteredRecipes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const tagQuery = selectedTag ? selectedTag.toLowerCase().trim().replace(/^#+/, '') : null;

    return recipes.filter((r) => {
      const matchesSearch =
        !q ||
        r.title.toLowerCase().includes(q) ||
        r.tags?.some((t) => t.toLowerCase().includes(q));

      const matchesTag =
        !tagQuery ||
        (tagQuery === 'ai'
          ? isAiRecipe(r)
          : r.tags?.some((t) => t.toLowerCase().trim().replace(/^#+/, '') === tagQuery));

      return matchesSearch && matchesTag;
    });
  }, [recipes, searchQuery, selectedTag]);

  // Case-insensitive deduplicated tags list (no matching duplicates)
  const allUniqueTags = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const r of recipes) {
      for (const t of r.tags || []) {
        const clean = t.trim().replace(/^#+/, '').trim();
        if (!clean) continue;
        const lower = clean.toLowerCase();
        if (lower === 'ai') continue;
        if (!seen.has(lower)) {
          seen.add(lower);
          result.push(clean);
        }
      }
    }
    return result;
  }, [recipes]);

  const hasAiRecipes = useMemo(() => recipes.some((r) => isAiRecipe(r)), [recipes]);

  // Group Meal Logs by date for History (memoized)
  const { groupedLogs, sortedDates } = useMemo(() => {
    const logs = mealLogs.reduce<Record<string, MealLog[]>>((acc, log) => {
      const d = log.date || 'Unknown Date';
      if (!acc[d]) acc[d] = [];
      acc[d].push(log);
      return acc;
    }, {});
    const dates = Object.keys(logs).sort((a, b) => b.localeCompare(a));
    return { groupedLogs: logs, sortedDates: dates };
  }, [mealLogs]);

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
      <Toast
        message={toastMessage}
        onClose={() => {
          setToastMessage(null);
          setToastAction(undefined);
        }}
        action={toastAction}
      />

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
                  referrerPolicy="no-referrer"
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
                  ✓ {imageFeedback}
                </span>
              )}
              <input
                ref={photoFileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleTakeOrReplacePhoto}
              />
              <button
                type="button"
                disabled={isUploadingPhoto || Boolean(regeneratingId)}
                onClick={() => photoFileInputRef.current?.click()}
                className="px-2.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 border border-emerald-400/50 text-[11px] font-bold flex items-center gap-1.5 backdrop-blur-md shadow-md shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
                title="Take a photo with your camera or select from your gallery"
              >
                {isUploadingPhoto ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-950" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-3.5 h-3.5" />
                    <span>{selectedRecipe.image_url ? 'Replace' : 'Add Photo'}</span>
                  </>
                )}
              </button>
              <button
                disabled={Boolean(regeneratingId) || isUploadingPhoto}
                onClick={() => handleRegenerateImage(selectedRecipe.id, { mode: 'search' })}
                className="px-2.5 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-850 text-slate-300 hover:text-white border border-white/20 text-[11px] font-semibold flex items-center gap-1.5 backdrop-blur-md transition-all cursor-pointer"
                title="Reload photograph for this dish"
              >
                {regeneratingId === selectedRecipe.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <span>Reload</span>
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

              {/* Stats & Add to Planner row */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-400 mt-4 pt-4 border-t border-white/10">
                <div className="flex flex-wrap items-center gap-3 sm:gap-4">
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

                {/* Add to Planner / In Planner Button on the right side at the bottom */}
                <div className="flex justify-end w-full sm:w-auto shrink-0 ml-auto">
                  {(() => {
                    const inPlanner = meals.some((m) => m.recipe_id === selectedRecipe.id);
                    const isJustAdded = justAddedRecipeId === selectedRecipe.id;
                    return (
                      <button
                        type="button"
                        onClick={(e) => handleToggleRecipePlanner(selectedRecipe, e)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 shrink-0 cursor-pointer shadow-sm ${
                          inPlanner
                            ? 'text-slate-950 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 shadow-md shadow-emerald-500/20'
                            : 'text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-white/15 hover:border-emerald-500/40'
                        }`}
                        title={inPlanner ? 'In Planner (click to remove)' : 'Add to Planner'}
                      >
                        {inPlanner ? (
                          <>
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>{isJustAdded ? 'Added to Planner!' : 'In Planner'}</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>Add to Planner</span>
                          </>
                        )}
                      </button>
                    );
                  })()}
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
              {(() => {
                const inGrocery = isRecipeInGrocery(selectedRecipe.title);
                const isJustAddedGrocery = justAddedGroceryId === selectedRecipe.id;
                return (
                  <button
                    onClick={(e) => handleToggleShopIngredients(selectedRecipe, e)}
                    className={`text-xs font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-sm active:scale-95 ${
                      inGrocery
                        ? 'text-emerald-400 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30'
                        : 'text-slate-950 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 shadow-emerald-500/20'
                    }`}
                    title={inGrocery ? 'In Grocery (click to remove)' : 'Add ingredients to Grocery List'}
                  >
                    {inGrocery ? (
                      <>
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>{isJustAddedGrocery ? 'Added to Grocery!' : 'In Grocery'}</span>
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Add to Grocery</span>
                      </>
                    )}
                  </button>
                );
              })()}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {selectedRecipe.ingredients.map((ing, idx) => {
                const isChecked = Boolean(checkedIngredients[idx]);
                const pantryMatch = getIngredientPantryMatch(ing.item);
                return (
                  <div
                    key={idx}
                    onClick={() => handleToggleIngredient(idx)}
                    className={`p-2.5 rounded-2xl border transition-all cursor-pointer flex items-center gap-2.5 ${
                      isChecked
                        ? 'bg-emerald-500/15 border-emerald-500/35 text-white shadow-xs'
                        : 'bg-slate-900/60 border-white/5 hover:border-white/10 text-slate-200'
                    }`}
                    title={isChecked ? 'On Grocery list (click to remove)' : 'Click to add to Grocery list'}
                  >
                    <div
                      className={`w-5 h-5 rounded-lg flex items-center justify-center text-xs transition-all shrink-0 ${
                        isChecked
                          ? 'bg-emerald-500 text-slate-950 font-black shadow-xs'
                          : 'bg-slate-800 border border-slate-700 text-transparent'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                    <span className="text-xs leading-tight flex-1">
                      {ing.amount && <strong className="font-semibold text-emerald-400 mr-1">{ing.amount} {ing.unit || ''}</strong>}
                      <span className={isChecked ? 'text-white font-medium' : 'text-slate-300'}>{ing.item}</span>
                    </span>
                    {isChecked ? (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 shrink-0 font-bold"
                        title="Item is on your Grocery list"
                      >
                        <ShoppingCart className="w-2.5 h-2.5" />
                        <span>In Grocery</span>
                      </span>
                    ) : (
                      pantryMatch && (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800/80 text-emerald-400 border border-emerald-500/20 flex items-center gap-1 shrink-0 font-medium"
                          title={`In pantry: ${pantryMatch.name} (${pantryMatch.quantity || 'Available'})`}
                        >
                          <span>✓ In Pantry</span>
                        </span>
                      )
                    )}
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

          {/* Bottom Recipe Actions Bar: Back on left, Add to Planner on right */}
          <div className="flex items-center justify-between p-3.5 sm:p-4 glass-panel rounded-3xl border border-white/10 gap-3">
            <button
              onClick={handleCloseRecipe}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-900/90 hover:bg-slate-850 px-3.5 py-2 rounded-xl border border-white/10 transition-colors shrink-0 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>

            {(() => {
              const inPlanner = meals.some((m) => m.recipe_id === selectedRecipe.id);
              const isJustAdded = justAddedRecipeId === selectedRecipe.id;
              return (
                <button
                  type="button"
                  onClick={(e) => handleToggleRecipePlanner(selectedRecipe, e)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 shrink-0 cursor-pointer shadow-sm ${
                    inPlanner
                      ? 'text-slate-950 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 shadow-md shadow-emerald-500/20'
                      : 'text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-white/15 hover:border-emerald-500/40'
                  }`}
                  title={inPlanner ? 'In Planner (click to remove)' : 'Add to Planner'}
                >
                  {inPlanner ? (
                    <>
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>{isJustAdded ? 'Added to Planner!' : 'In Planner'}</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Add to Planner</span>
                    </>
                  )}
                </button>
              );
            })()}
          </div>
        </div>
      ) : (
        /* ================= MAIN MEALS VIEW (TABS) ================= */
        <div className="space-y-4">
          {/* Header Bar: Title */}
          <div className="flex items-center justify-between">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 shadow-md shadow-emerald-500/20">
                <ChefHat className="w-5 h-5 stroke-[2.5]" />
              </div>
              Meals
            </h1>

            {/* Top Right Action Button for active subtab */}
            {activeTab === 'recipes' && (
              <button
                type="button"
                onClick={() => {
                  setScraperInitialMode('url');
                  setIsScraperOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 text-xs font-bold transition-all shadow-md shadow-emerald-500/20 active:scale-95 cursor-pointer"
                title="Add recipe"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Add Recipe</span>
              </button>
            )}

            {activeTab === 'pantry' && (
              <div className="relative" ref={pantryAddDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsPantryAddMenuOpen(!isPantryAddMenuOpen)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 text-xs font-bold transition-all shadow-md shadow-emerald-500/20 active:scale-95 cursor-pointer"
                  title="Add to Pantry"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>Add Item</span>
                  <ChevronDown className={`w-3.5 h-3.5 stroke-[2.5] transition-transform duration-200 ${isPantryAddMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {isPantryAddMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-slate-900/95 backdrop-blur-xl border border-white/15 rounded-2xl p-1.5 shadow-2xl shadow-slate-950/80 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsPantryAddMenuOpen(false);
                        setIsBarcodeModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:text-white hover:bg-white/10 transition-colors text-left cursor-pointer"
                    >
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                        <Barcode className="w-4 h-4" />
                      </div>
                      <span className="font-bold text-white">Scan Barcode</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsPantryAddMenuOpen(false);
                        setIsVisionModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:text-white hover:bg-white/10 transition-colors text-left cursor-pointer"
                    >
                      <div className="w-7 h-7 rounded-lg bg-purple-500/15 text-purple-400 flex items-center justify-center shrink-0">
                        <Camera className="w-4 h-4" />
                      </div>
                      <span className="font-bold text-white">AI Photo Scan</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'planner' && (
              <button
                type="button"
                onClick={() => setIsRecipePickerOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 text-xs font-bold transition-all shadow-md shadow-emerald-500/20 active:scale-95 cursor-pointer"
                title="Add meal to planner"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Add Meal</span>
              </button>
            )}

            {activeTab === 'history' && (
              <button
                type="button"
                onClick={() => setIsLogModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 text-xs font-bold transition-all shadow-md shadow-emerald-500/20 active:scale-95 cursor-pointer"
                title="Log a cooked meal"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Log Meal</span>
              </button>
            )}
          </div>

          {/* Full-width compact segmented sub-navigation: Recipes -> Planner -> Pantry -> History */}
          <div className="w-full flex items-center p-1 bg-slate-900/80 rounded-xl border border-white/10 shadow-md">
            <button
              onClick={() => handleTabChange('recipes')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors duration-150 cursor-pointer ${
                activeTab === 'recipes'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Recipes</span>
            </button>

            <button
              onClick={() => handleTabChange('planner')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors duration-150 cursor-pointer ${
                activeTab === 'planner'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Utensils className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Planner</span>
            </button>

            <button
              onClick={() => handleTabChange('pantry')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors duration-150 cursor-pointer ${
                activeTab === 'pantry'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Package className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Pantry</span>
            </button>

            <button
              onClick={() => handleTabChange('history')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors duration-150 cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <History className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">History</span>
            </button>
          </div>

          {/* ================= 1. RECIPES TAB ================= */}
          {visitedTabs['recipes'] && (
            <div className={activeTab === 'recipes' ? 'space-y-4' : 'hidden'}>
              {/* Tag Filters */}
              <div
                className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {searchQuery && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold whitespace-nowrap">
                    <span>"{searchQuery}"</span>
                    <button
                      onClick={() => setSearchQuery('')}
                      className="p-0.5 hover:text-white cursor-pointer"
                      title="Clear search"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
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
                  .slice(0, 15)
                  .map((tag) => {
                    const isSelected =
                      selectedTag !== null &&
                      selectedTag.toLowerCase().trim().replace(/^#+/, '') ===
                        tag.toLowerCase().trim().replace(/^#+/, '');
                    return (
                      <button
                        key={tag.toLowerCase()}
                        onClick={() => setSelectedTag(isSelected ? null : tag)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                            : 'bg-slate-900/80 hover:bg-slate-850 text-slate-300 border border-white/5'
                        }`}
                      >
                        #{tag}
                      </button>
                    );
                  })}
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
                              referrerPolicy="no-referrer"
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
                            <button
                              type="button"
                              onClick={(e) => handleToggleRecipePlanner(recipe, e)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all shadow-sm active:scale-95 cursor-pointer ${
                                isAlreadyInPlanner
                                  ? 'text-slate-950 bg-emerald-500 hover:bg-emerald-400 shadow-md shadow-emerald-500/20'
                                  : 'text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-white/15 hover:border-emerald-500/40'
                              }`}
                              title={isAlreadyInPlanner ? 'In Planner (click to remove)' : 'Add to Planner'}
                            >
                              {isAlreadyInPlanner ? (
                                <>
                                  <Check className="w-3 h-3 stroke-[2.5]" />
                                  <span>{justAddedRecipeId === recipe.id ? 'Added!' : 'In Planner'}</span>
                                </>
                              ) : (
                                <>
                                  <Plus className="w-3 h-3 stroke-[2.5]" />
                                  <span>Add to Planner</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ================= 2. PLANNER TAB ================= */}
          {visitedTabs['planner'] && (
            <div className={activeTab === 'planner' ? 'space-y-4' : 'hidden'}>
              {isLoading ? (
                <div className="py-12 text-center text-xs text-slate-400">Loading planner...</div>
              ) : meals.length === 0 ? (
                <div className="py-16 text-center glass-panel rounded-3xl p-8 border border-white/5 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
                    <Utensils className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-white">No meals on deck</h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Add recipes or dishes using the Quick Add button below to put them on deck and ready to shop for!
                  </p>
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
                              referrerPolicy="no-referrer"
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
                                {(() => {
                                  const inGrocery = isRecipeInGrocery(linkedRecipe.title);
                                  const isJustAddedGrocery = justAddedGroceryId === linkedRecipe.id;
                                  return (
                                    <button
                                      onClick={(e) => handleToggleShopIngredients(linkedRecipe, e)}
                                      className={`px-2.5 py-1.5 rounded-xl font-semibold text-[11px] flex items-center gap-1 transition-all cursor-pointer ${
                                        inGrocery
                                          ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30'
                                          : 'bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 hover:text-pink-300 border border-pink-500/20'
                                      }`}
                                      title={inGrocery ? 'In Grocery (click to remove)' : 'Add ingredients to grocery list'}
                                    >
                                      {inGrocery ? (
                                        <>
                                          <Check className="w-3 h-3 stroke-[2.5]" />
                                          <span>{isJustAddedGrocery ? 'Added!' : 'Shopped'}</span>
                                        </>
                                      ) : (
                                        <>
                                          <ShoppingCart className="w-3 h-3" />
                                          <span>Shop</span>
                                        </>
                                      )}
                                    </button>
                                  );
                                })()}
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

          {/* ================= 2b. PANTRY TAB ================= */}
          {visitedTabs['pantry'] && (
            <div className={activeTab === 'pantry' ? 'space-y-3' : 'hidden'}>
              {/* Search Bar for Pantry */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search pantry items..."
                  value={pantrySearchQuery}
                  onChange={(e) => setPantrySearchQuery(e.target.value)}
                  className="w-full bg-slate-900/80 border border-white/10 rounded-2xl pl-10 pr-9 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
                />
                {pantrySearchQuery && (
                  <button
                    type="button"
                    onClick={() => setPantrySearchQuery('')}
                    className="p-1 text-slate-400 hover:text-white absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Location & Status Filter Chips */}
              <div
                className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {(() => {
                  const expiringCount = inventoryItems.filter(
                    (i) => i.freshness === 'expiring_soon' || i.freshness === 'expired'
                  ).length;
                  const staplesCount = inventoryItems.filter((i) => i.isStock).length;

                  const chips = [
                    { id: 'all' as const, label: 'All Items', icon: null, count: inventoryItems.length },
                    { id: 'staples' as const, label: 'Staples', icon: '⭐', count: staplesCount },
                    { id: 'fridge' as const, label: 'Fridge', icon: '🧊', count: inventoryItems.filter((i) => i.location === 'fridge').length },
                    { id: 'freezer' as const, label: 'Freezer', icon: '❄️', count: inventoryItems.filter((i) => i.location === 'freezer').length },
                    { id: 'pantry' as const, label: 'Pantry', icon: '🥫', count: inventoryItems.filter((i) => i.location === 'pantry').length },
                    ...(expiringCount > 0
                      ? [{ id: 'expiring' as const, label: 'Expiring', icon: '⚠️', count: expiringCount }]
                      : []),
                  ];

                  return chips.map((chip) => {
                    const isSelected = pantryFilter === chip.id;
                    return (
                      <button
                        key={chip.id}
                        onClick={() => setPantryFilter(chip.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                            : 'bg-slate-900/80 text-slate-400 hover:text-white hover:bg-slate-800 border border-white/5'
                        }`}
                      >
                        {chip.icon && <span>{chip.icon}</span>}
                        <span>{chip.label}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                            isSelected ? 'bg-slate-950/20 text-slate-950 font-black' : 'bg-white/5 text-slate-400'
                          }`}
                        >
                          {chip.count}
                        </span>
                      </button>
                    );
                  });
                })()}
              </div>

              {/* Inventory Items Grid */}
              {isLoading ? (
                <div className="py-12 text-center text-xs text-slate-400">Loading pantry inventory...</div>
              ) : (() => {
                const query = pantrySearchQuery.toLowerCase().trim();
                const filteredItems = inventoryItems.filter((item) => {
                  if (
                    query &&
                    !item.name.toLowerCase().includes(query) &&
                    !(item.category && item.category.toLowerCase().includes(query))
                  ) {
                    return false;
                  }
                  if (pantryFilter === 'all') return true;
                  if (pantryFilter === 'fridge' || pantryFilter === 'freezer' || pantryFilter === 'pantry') {
                    return item.location === pantryFilter;
                  }
                  if (pantryFilter === 'expiring') {
                    return item.freshness === 'expiring_soon' || item.freshness === 'expired';
                  }
                  if (pantryFilter === 'staples') {
                    return item.isStock;
                  }
                  return true;
                });

                if (filteredItems.length === 0) {
                  return (
                    <div className="py-16 text-center glass-panel rounded-3xl p-8 border border-white/5 space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
                        <Package className="w-6 h-6" />
                      </div>
                      <h3 className="text-base font-bold text-white">
                        {inventoryItems.length === 0 ? 'Your pantry is empty' : 'No matching items'}
                      </h3>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto">
                        {inventoryItems.length === 0
                          ? 'Scan barcodes, snap photos of your fridge/receipt, or add items to track freshness and prevent duplicate buying!'
                          : 'Try changing your search keywords or active filter.'}
                      </p>
                      {inventoryItems.length === 0 && (
                        <div className="flex items-center justify-center gap-2 pt-2">
                          <button
                            onClick={() => setIsBarcodeModalOpen(true)}
                            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2 rounded-2xl text-xs font-bold inline-flex items-center gap-1.5 transition-all shadow-md shadow-emerald-500/20 cursor-pointer"
                          >
                            <Barcode className="w-4 h-4 stroke-[2.5]" />
                            <span>Scan Barcode</span>
                          </button>
                          <button
                            onClick={() => setIsVisionModalOpen(true)}
                            className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-2xl text-xs font-bold inline-flex items-center gap-1.5 transition-all shadow-md shadow-purple-600/20 cursor-pointer"
                          >
                            <Camera className="w-4 h-4" />
                            <span>AI Photo Scan</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {filteredItems.map((item) => {
                      const locMeta = getLocationMeta(item.location);
                      const badge = getFreshnessBadge(item.freshness, item.daysUntilExpiry);
                      const isCrossing = Boolean(crossingOffPantryIds[item.id]);

                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            setEditingInventoryItem(item);
                            setIsEditInventoryModalOpen(true);
                          }}
                          className={`glass-panel rounded-2xl border border-white/10 px-3.5 py-2.5 flex items-center gap-3 hover:border-emerald-500/30 transition-all shadow-md group cursor-pointer ${
                            isCrossing ? 'animate-row-crossing opacity-60' : ''
                          }`}
                        >
                          {/* Checkbox */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCheckOffPantryItem(item);
                            }}
                            className={`relative w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                              isCrossing
                                ? 'border-emerald-500 bg-emerald-500 text-slate-950 shadow-sm shadow-emerald-500/30 animate-check-pop'
                                : 'border-white/20 bg-slate-900/80 hover:border-emerald-500 text-transparent'
                            }`}
                            title="Mark as used / finished"
                          >
                            <CheckSparkle trigger={isCrossing} />
                            {isCrossing && (
                              <Check className="w-3.5 h-3.5 text-slate-950 font-bold stroke-[3]" />
                            )}
                          </button>

                          {/* Card Content */}
                          <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5">
                            {/* Line 1: Location icon + Item name + Staple Star & Freshness Badge */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                <span className="text-sm shrink-0" title={locMeta.label}>{locMeta.icon}</span>
                                <h4 className={`text-sm font-bold transition-colors truncate ${
                                  isCrossing ? 'line-through text-slate-400' : 'text-white group-hover:text-emerald-300'
                                }`}>
                                  {item.name}
                                </h4>
                                {item.isStock && (
                                  <span title="Pantry Staple">
                                    <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400 shrink-0" />
                                  </span>
                                )}
                              </div>

                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badge.bgColor} ${badge.color} ${badge.borderColor} flex items-center gap-1 shrink-0 whitespace-nowrap`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${badge.dotColor}`} />
                                <span>{badge.label}</span>
                              </span>
                            </div>

                            {/* Line 2: Category · Quantity · Cadence & Restock button */}
                            <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
                              <div className="flex items-center gap-1.5 min-w-0 truncate">
                                <span className="text-slate-300 truncate">{item.category || 'Pantry'}</span>
                                {item.quantity && (
                                  <>
                                    <span className="text-slate-600">·</span>
                                    <span className="text-emerald-400 font-semibold truncate">{item.quantity}</span>
                                  </>
                                )}
                                {item.isStock && item.restockCadenceDays && (
                                  <>
                                    <span className="text-slate-600">·</span>
                                    <span className="text-yellow-400/90 text-[10px] truncate">every {item.restockCadenceDays}d</span>
                                  </>
                                )}
                              </div>

                              {(() => {
                                const inGrocery = isPantryItemInGrocery(item);
                                return (
                                  <button
                                    type="button"
                                    onClick={(e) => handleToggleRestockPantryItem(item, e)}
                                    className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold flex items-center gap-1 shrink-0 whitespace-nowrap transition-all cursor-pointer ${
                                      inGrocery
                                        ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-sm shadow-emerald-500/20'
                                        : 'bg-white/5 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-400 border border-white/10 hover:border-emerald-500/30'
                                    }`}
                                    title={inGrocery ? 'In Grocery List (click to remove)' : 'Add to Grocery List'}
                                  >
                                    {inGrocery ? (
                                      <Check className="w-3 h-3 stroke-[3]" />
                                    ) : (
                                      <ShoppingCart className="w-3 h-3 text-emerald-400" />
                                    )}
                                    <span>{inGrocery ? 'In List' : 'Restock'}</span>
                                  </button>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ================= 3. HISTORY TAB ================= */}
          {visitedTabs['history'] && (
            <div className={activeTab === 'history' ? 'space-y-4' : 'hidden'}>
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
                                      referrerPolicy="no-referrer"
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

      {/* ================= FLOATING ACTION BUTTONS (FAB) ================= */}
      {!selectedRecipe && (
        <div className="fixed bottom-[calc(76px+1rem+env(safe-area-inset-bottom,0px))] md:bottom-8 left-0 right-0 z-40 px-4 pointer-events-none">
          <div className="max-w-4xl mx-auto pointer-events-none flex justify-end">
            {activeTab === 'planner' && (
              <button
                type="button"
                onClick={() => setIsRecipePickerOpen(true)}
                className="pointer-events-auto w-[50px] h-[50px] rounded-full border border-emerald-400/40 bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 cursor-pointer shadow-xl shadow-emerald-500/30 hover:scale-105 active:scale-95 flex items-center justify-center transition-transform"
                title="Quick Add Meal to Planner"
              >
                <Plus className="w-6 h-6 stroke-[2.5]" />
              </button>
            )}

            {activeTab === 'recipes' && (
              <div
                ref={recipeFabRef}
                className={`fab-dock-transition pointer-events-auto h-[50px] border shadow-2xl flex items-center overflow-hidden ${
                  isRecipeFabOpen
                    ? 'w-full rounded-3xl border-white/25 bg-slate-900/95 backdrop-blur-xl shadow-emerald-500/10 px-2.5'
                    : 'w-[50px] rounded-full border-emerald-400/40 bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 cursor-pointer shadow-xl shadow-emerald-500/30 hover:scale-105 active:scale-95 justify-center'
                }`}
              >
                {!isRecipeFabOpen ? (
                  <button
                    type="button"
                    onClick={() => setIsRecipeFabOpen(true)}
                    className="w-full h-full flex items-center justify-center text-slate-950 cursor-pointer"
                    title="Search & Actions"
                  >
                    <Search className="w-5 h-5 stroke-[2.2]" />
                  </button>
                ) : (
                  <div className="w-full flex items-center gap-2 animate-in fade-in duration-200">
                    {/* Far left: Close button */}
                    <button
                      type="button"
                      onClick={() => setIsRecipeFabOpen(false)}
                      className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                      title="Close"
                    >
                      <X className="w-4 h-4" />
                    </button>

                    {/* Secondary action 1 on the left: Create Recipe */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsRecipeFabOpen(false);
                        setEditingRecipe(null);
                        setIsEditRecipeModalOpen(true);
                      }}
                      className="h-8 px-2 sm:px-2.5 rounded-xl bg-white/5 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-400 border border-white/10 hover:border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
                      title="Create recipe from scratch"
                    >
                      <Pencil className="w-3.5 h-3.5 text-emerald-400 stroke-[2.2]" />
                      <span className="hidden sm:inline">Create</span>
                    </button>

                    {/* Secondary action 2 on the left: Add Recipe */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsRecipeFabOpen(false);
                        setScraperInitialMode('url');
                        setIsScraperOpen(true);
                      }}
                      className="h-8 px-2 sm:px-2.5 rounded-xl bg-white/5 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-400 border border-white/10 hover:border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
                      title="Add recipe (import from web link or scan)"
                    >
                      <Plus className="w-3.5 h-3.5 text-emerald-400 stroke-[2.5]" />
                      <span className="hidden sm:inline">Add</span>
                    </button>

                    {/* Form wrapping middle search input and right search button */}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        (document.activeElement as HTMLElement)?.blur();
                      }}
                      className="flex-1 min-w-0 flex items-center gap-2"
                    >
                      {/* Middle: Search text input */}
                      <div className="flex-1 min-w-0 flex items-center relative">
                        <input
                          type="text"
                          placeholder="Search recipes..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full bg-transparent border-none text-xs text-white placeholder-slate-500 focus:outline-none py-1.5 px-1"
                        />
                        {searchQuery && (
                          <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="p-1 text-slate-400 hover:text-white shrink-0 cursor-pointer"
                            title="Clear search"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Far right: Main action button (Search) */}
                      <button
                        type="submit"
                        className="h-8 px-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-emerald-500/20 shrink-0 active:scale-95 cursor-pointer"
                        title="Search recipes"
                      >
                        <Search className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span className="hidden sm:inline">Search</span>
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )}



            {activeTab === 'history' && (
              <button
                type="button"
                onClick={() => setIsLogModalOpen(true)}
                className="pointer-events-auto w-[50px] h-[50px] rounded-full border border-emerald-400/40 bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 cursor-pointer shadow-xl shadow-emerald-500/30 hover:scale-105 active:scale-95 flex items-center justify-center transition-transform"
                title="Log a Cooked Meal"
              >
                <Plus className="w-6 h-6 stroke-[2.5]" />
              </button>
            )}
          </div>
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
                          referrerPolicy="no-referrer"
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
                      onClick={(e) => handleToggleRecipePlanner(r, e)}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 shrink-0 transition-all active:scale-95 cursor-pointer ${
                        isAlreadyInPlanner
                          ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20'
                          : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/15 hover:border-emerald-500/40'
                      }`}
                      title={isAlreadyInPlanner ? 'In Planner (click to remove)' : 'Add to Planner'}
                    >
                      {isAlreadyInPlanner ? (
                        <>
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>{justAddedRecipeId === r.id ? 'Added!' : 'In Planner'}</span>
                        </>
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
          initialMode={scraperInitialMode}
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

      {/* ================= MODAL: BARCODE SCANNER ================= */}
      <BarcodeScannerModal
        isOpen={isBarcodeModalOpen}
        onClose={() => setIsBarcodeModalOpen(false)}
        onItemAdded={(newItem) => {
          setInventoryItems((prev) => {
            const existingIdx = prev.findIndex((i) => i.id === newItem.id);
            if (existingIdx >= 0) {
              const updated = [...prev];
              updated[existingIdx] = newItem;
              return updated;
            }
            return [newItem, ...prev];
          });
          if (mealsDataCache && mealsDataCache.householdId === householdId) {
            const cachedList = mealsDataCache.inventoryItems || [];
            const cachedIdx = cachedList.findIndex((i: any) => i.id === newItem.id);
            if (cachedIdx >= 0) {
              cachedList[cachedIdx] = newItem;
            } else {
              mealsDataCache.inventoryItems = [newItem, ...cachedList];
            }
          }
          if (newItem.isDuplicate) {
            showToast(`Updated "${newItem.name}" quantity to ${newItem.quantity || '2'}`);
          } else {
            showToast(`Added "${newItem.name}" to your pantry!`);
          }
        }}
      />

      {/* ================= MODAL: VISION PHOTO SCAN ================= */}
      <VisionScanModal
        isOpen={isVisionModalOpen}
        onClose={() => setIsVisionModalOpen(false)}
        onItemsAdded={async () => {
          const refreshed = await api.getInventory();
          setInventoryItems(refreshed);
          if (mealsDataCache && mealsDataCache.householdId === householdId) {
            mealsDataCache.inventoryItems = refreshed;
          }
          showToast('Added scanned items to your pantry!');
        }}
      />

      {/* ================= MODAL: EDIT / ADD INVENTORY ITEM ================= */}
      <EditInventoryModal
        isOpen={isEditInventoryModalOpen}
        item={editingInventoryItem}
        isInGrocery={editingInventoryItem ? isPantryItemInGrocery(editingInventoryItem) : false}
        onToggleRestock={handleToggleRestockPantryItem}
        onClose={() => {
          setIsEditInventoryModalOpen(false);
          setEditingInventoryItem(null);
        }}
        onSaved={(savedItem) => {
          setInventoryItems((prev) => {
            const exists = prev.some((i) => i.id === savedItem.id);
            const next = exists ? prev.map((i) => (i.id === savedItem.id ? savedItem : i)) : [savedItem, ...prev];
            if (mealsDataCache && mealsDataCache.householdId === householdId) {
              mealsDataCache.inventoryItems = next;
            }
            return next;
          });
          showToast(`Saved "${savedItem.name}" to pantry!`);
        }}
        onDeleted={(deletedId) => {
          setInventoryItems((prev) => {
            const next = prev.filter((i) => i.id !== deletedId);
            if (mealsDataCache && mealsDataCache.householdId === householdId) {
              mealsDataCache.inventoryItems = next;
            }
            return next;
          });
          showToast('Removed item from pantry');
        }}
      />
    </div>
  );
};
