import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Link2,
  Search,
  Clock,
  Users,
  ShoppingCart,
  ChefHat,
  Trash2,
  ExternalLink,
  Check,
  Flame,
  ArrowLeft,
  RotateCcw,
  X,
  Sparkles,
  Loader2,
  ImageIcon,
  BookOpen,
  Pencil,
} from 'lucide-react';
import type { Recipe } from '../types';
import { usePWA } from '../context/PWAContext';
import { api } from '../lib/api';
import { RecipeScraperModal, extractSharedUrl } from '../components/RecipeScraperModal';
import { EditRecipeModal } from '../components/EditRecipeModal';
import { useFabAutoClose } from '../hooks/useFabAutoClose';
import { CheckSparkle, CelebrationConfetti, triggerHapticCheck } from '../components/CheckSparkle';

export const RecipesPage: React.FC = () => {
  const { household, apiKey } = usePWA();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [isScraperOpen, setIsScraperOpen] = useState(false);
  const [scraperInitialUrl, setScraperInitialUrl] = useState('');
  const [scraperAutoImport, setScraperAutoImport] = useState(false);
  const [isEditRecipeModalOpen, setIsEditRecipeModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

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
        const cleanPath = window.location.pathname;
        window.history.replaceState({}, '', cleanPath);
      } else if (isShared || params.has('import')) {
        setIsScraperOpen(true);
        const cleanPath = window.location.pathname;
        window.history.replaceState({}, '', cleanPath);
      }
    };

    checkShareParams();

    window.addEventListener('popstate', checkShareParams);
    return () => window.removeEventListener('popstate', checkShareParams);
  }, []);

  const dockRef = useFabAutoClose<HTMLDivElement>({
    isOpen: isSearchExpanded,
    onClose: () => setIsSearchExpanded(false),
    ignore: isScraperOpen || Boolean(selectedRecipe),
  });
  const [isCookMode, setIsCookMode] = useState(false);
  const [checkedIngredients, setCheckedIngredients] = useState<Record<number, boolean>>({});
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({});
  const [justCompletedStep, setJustCompletedStep] = useState<number | null>(null);
  const [justCheckedIngredient, setJustCheckedIngredient] = useState<number | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [addedGroceryFeedback, setAddedGroceryFeedback] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [regenerateMode, setRegenerateMode] = useState<'imagen' | 'search' | null>(null);
  const [imageFeedback, setImageFeedback] = useState<string | null>(null);
  const seenImageUrlsRef = useRef<Record<string, string[]>>({});

  const recipeHistoryPushedRef = useRef(false);
  const cookModeHistoryPushedRef = useRef(false);
  const isNavigatingBackRef = useRef(false);

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
        { type: 'recipe_detail', recipeId: recipe.id, tab: 'recipes' },
        '',
        url.pathname + (url.search ? url.search : '')
      );
    }
  };

  const handleToggleCookMode = (enable?: boolean) => {
    const nextMode = enable !== undefined ? enable : !isCookMode;
    if (nextMode === isCookMode) return;

    if (nextMode) {
      setIsCookMode(true);
      if (typeof window !== 'undefined') {
        cookModeHistoryPushedRef.current = true;
        window.history.pushState(
          { type: 'cook_mode', recipeId: selectedRecipe?.id, tab: 'recipes' },
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

  // Popstate listener for mobile phone back button / swipe back gesture
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      // If back navigation was already performed by an in-app UI click, consume flag and return
      if (isNavigatingBackRef.current) {
        isNavigatingBackRef.current = false;
        return;
      }

      // If a child drawer or modal triggered this popstate, do not close recipe
      if (e.state?.type === 'drawer' || e.state?.type === 'admin_modal') {
        return;
      }

      // 1. If currently in cook mode and popped state is not cook mode, exit cook mode
      if (cookModeHistoryPushedRef.current && e.state?.type !== 'cook_mode') {
        cookModeHistoryPushedRef.current = false;
        setIsCookMode(false);
        return;
      }

      // 2. If in recipe detail and popped state is not recipe detail, return to Recipe Box
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

  // Restore recipe from URL query parameter on initial load if present
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

  const handleRegenerateImage = async (recipeId: string, options: { mode?: 'imagen' | 'search'; customUrl?: string }) => {
    setRegeneratingId(recipeId);
    setRegenerateMode(options.mode || 'search');
    setImageFeedback(null);

    // Track previously seen photos so user never gets stuck in a 2-image loop
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
        // Automatically fallback to finding a real high-res photo!
        handleRegenerateImage(recipeId, { mode: 'search' });
      } else {
        alert(err.message || 'Failed to update image.');
      }
    } finally {
      setRegeneratingId(null);
      setRegenerateMode(null);
    }
  };

  const loadRecipes = async () => {
    if (!household) return;
    setIsLoading(true);
    try {
      const data = await api.getRecipes(household.id);
      setRecipes(data);
    } catch (err) {
      console.error('Failed to load recipes:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRecipes();
  }, [household]);

  const handleAddAllToGrocery = async (recipe: Recipe) => {
    if (!household) return;
    try {
      const res = await api.addRecipeToGrocery(recipe, household.id);
      // Also add to Shopped Recipes list
      await api.addWeeklyMeal(household.id, {
        title: recipe.title,
        recipe_id: recipe.id,
      }).catch((e) => console.warn('Auto-add to shopped meals:', e));

      const feedback = (res as any).skippedStaplesCount > 0
        ? `Added ${res.addedCount} ingredients (filtered ${(res as any).skippedStaplesCount} pantry staples: water, salt, etc.)!`
        : `Added ${res.addedCount} ingredients to Grocery List & Meals on Deck!`;
      setAddedGroceryFeedback(feedback);
      setTimeout(() => setAddedGroceryFeedback(null), 3500);
    } catch (err: any) {
      console.error('Add to grocery failed:', err);
      alert(err.message || 'Failed to add ingredients to grocery list');
    }
  };

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

    // If all steps completed, celebrate with confetti!
    const isAllDone =
      selectedRecipe.instructions.length > 0 &&
      selectedRecipe.instructions.every((_, idx) => nextSteps[idx]);

    if (isAllDone && isNowCompleted) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 4500);
    }

    // If step was just crossed off, scroll to the next step
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

  const handleDeleteRecipe = async (id: string, title: string) => {
    if (confirm(`Are you sure you want to delete "${title}"?`)) {
      try {
        await api.deleteRecipe(id);
        handleCloseRecipe();
        await loadRecipes();
      } catch (err) {
        console.error('Failed to delete recipe:', err);
      }
    }
  };

  const hasProgress =
    Object.values(checkedIngredients).some(Boolean) ||
    Object.values(completedSteps).some(Boolean);

  const allStepsCompleted =
    !!selectedRecipe &&
    selectedRecipe.instructions.length > 0 &&
    selectedRecipe.instructions.every((_, idx) => completedSteps[idx]);

  const handleResetProgress = () => {
    setCheckedIngredients({});
    setCompletedSteps({});
    setJustCompletedStep(null);
    setJustCheckedIngredient(null);
    setShowConfetti(false);
  };

  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const isAiRecipe = (recipe?: { tags?: string[] } | null): boolean => {
    if (!recipe || !recipe.tags) return false;
    return recipe.tags.some((t) => {
      const clean = t.toLowerCase().trim().replace(/^#/, '');
      return clean === 'ai';
    });
  };

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

  // Collect unique clean tags
  const allUniqueTags = Array.from(
    new Set(
      recipes.flatMap((r) => r.tags || []).map((t) => t.trim().replace(/^#/, ''))
    )
  ).filter(Boolean);
  const hasAiRecipes = recipes.some((r) => isAiRecipe(r));

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-6 pt-3 pb-36 md:pb-28 space-y-4">
      {/* If a recipe is selected, show detail view / Cook Mode */}
      {selectedRecipe ? (
        <div className="space-y-4 animate-in fade-in duration-150 relative">
          <CelebrationConfetti active={showConfetti || allStepsCompleted} />

          {/* Back button & Actions Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 glass-panel p-3 rounded-2xl border border-white/10">
            <button
              onClick={handleCloseRecipe}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-900/90 hover:bg-slate-850 px-3 py-2 rounded-xl border border-white/10 transition-colors shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Recipe Box</span>
            </button>

            <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">
              <button
                onClick={() => handleToggleCookMode()}
                className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
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

              {hasProgress && (
                <button
                  onClick={handleResetProgress}
                  className="px-2.5 sm:px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all text-slate-300 hover:text-white bg-slate-850 hover:bg-slate-800 border border-white/10 shrink-0 animate-in fade-in"
                  title="Uncheck all ingredients and instructions"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                  <span className="hidden sm:inline">Reset</span>
                </button>
              )}

              <button
                onClick={() => setIsEditRecipeModalOpen(true)}
                className="bg-slate-850 hover:bg-slate-800 text-slate-200 px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border border-white/10 shrink-0 cursor-pointer"
                title="Edit Recipe Details & Ingredients"
              >
                <Pencil className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Edit Recipe</span>
                <span className="sm:hidden">Edit</span>
              </button>

              <button
                onClick={() => handleAddAllToGrocery(selectedRecipe)}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-emerald-500/20 shrink-0"
                title="Add all ingredients to Grocery List"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Add to Grocery List</span>
                <span className="sm:hidden">Add to List</span>
              </button>

              <button
                onClick={() => handleDeleteRecipe(selectedRecipe.id, selectedRecipe.title)}
                title="Delete Recipe"
                className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {addedGroceryFeedback && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center gap-2 text-emerald-400 text-xs font-semibold animate-in fade-in">
              <Check className="w-4 h-4" />
              {addedGroceryFeedback}
            </div>
          )}

          {/* Recipe Content Card */}
          <div className="glass-panel rounded-3xl p-6 border border-white/10 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Image & Overview */}
              <div className="md:col-span-1 space-y-3">
                <div className="relative w-full overflow-hidden rounded-3xl border border-white/10 shadow-lg">
                  {selectedRecipe.image_url ? (
                    <img
                      src={selectedRecipe.image_url}
                      alt={selectedRecipe.title}
                      className="w-full h-56 object-cover"
                    />
                  ) : (
                    <div className="w-full h-44 bg-slate-900 flex items-center justify-center text-slate-600">
                      <ChefHat className="w-12 h-12" />
                    </div>
                  )}

                  {/* Assistant AI icon in bottom right-hand corner of the picture */}
                  {isAiRecipe(selectedRecipe) && (
                    <div
                      className="absolute bottom-3 right-3 z-10 w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-400 to-teal-300 flex items-center justify-center text-zinc-950 shadow-lg shadow-emerald-950/50 border border-white/30"
                      title="Created by AI Assistant (#ai)"
                    >
                      <Sparkles className="w-4.5 h-4.5 stroke-[2.2]" />
                    </div>
                  )}
                </div>

                {/* Photo controls */}
                <div className="space-y-1.5 pt-0.5">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleRegenerateImage(selectedRecipe.id, { mode: 'search' })}
                      disabled={regeneratingId === selectedRecipe.id}
                      className="flex-1 py-1.5 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                      title="Find another high-resolution photograph of this dish"
                    >
                      {regeneratingId === selectedRecipe.id && regenerateMode === 'search' ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                          <span>Finding photo...</span>
                        </>
                      ) : (
                        <>
                          <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Find Another Photo</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => {
                        const newUrl = prompt('Paste new image URL:', selectedRecipe.image_url || '');
                        if (newUrl && newUrl.trim() && newUrl.trim() !== selectedRecipe.image_url) {
                          handleRegenerateImage(selectedRecipe.id, { customUrl: newUrl.trim() });
                        }
                      }}
                      disabled={regeneratingId === selectedRecipe.id}
                      className="py-1.5 px-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-[11px] font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                      title="Paste image link"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      <span>URL</span>
                    </button>
                  </div>

                  {imageFeedback && (
                    <div className="text-[11px] text-emerald-400 text-center font-medium py-0.5 animate-fade-in">
                      ✓ {imageFeedback}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                  {Boolean(selectedRecipe.prep_time_minutes && selectedRecipe.prep_time_minutes > 0) ? (
                    <span className="bg-slate-900/80 px-3 py-1.5 rounded-xl text-slate-300 flex items-center gap-1.5 border border-white/5 font-mono">
                      <Clock className="w-3.5 h-3.5 text-pink-400" />
                      Prep: {selectedRecipe.prep_time_minutes}m
                    </span>
                  ) : null}
                  {Boolean(selectedRecipe.cook_time_minutes && selectedRecipe.cook_time_minutes > 0) ? (
                    <span className="bg-slate-900/80 px-3 py-1.5 rounded-xl text-slate-300 flex items-center gap-1.5 border border-white/5 font-mono">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      Cook: {selectedRecipe.cook_time_minutes}m
                    </span>
                  ) : null}
                  {Boolean(selectedRecipe.servings && selectedRecipe.servings > 0) ? (
                    <span className="bg-slate-900/80 px-3 py-1.5 rounded-xl text-slate-300 flex items-center gap-1.5 border border-white/5 font-mono">
                      <Users className="w-3.5 h-3.5 text-blue-400" />
                      Serves: {selectedRecipe.servings}
                    </span>
                  ) : null}
                </div>

                {selectedRecipe.source_url && (
                  <a
                    href={selectedRecipe.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-pink-400 hover:text-pink-300 hover:underline"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Original Recipe Website
                  </a>
                )}
              </div>

              {/* Title & Description */}
              <div className="md:col-span-2 space-y-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    {selectedRecipe.title}
                  </h1>
                  {selectedRecipe.description && (
                    <p className="text-sm text-slate-300 mt-2 leading-relaxed selectable-text">
                      {selectedRecipe.description}
                    </p>
                  )}
                </div>

                {/* Tags */}
                {selectedRecipe.tags && selectedRecipe.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedRecipe.tags.map((t, idx) => {
                      const cleanTag = t.trim().replace(/^#/, '');
                      const isAi = cleanTag.toLowerCase() === 'ai';
                      return (
                        <span
                          key={idx}
                          className={`text-[11px] px-2.5 py-1 rounded-lg border flex items-center gap-1 ${
                            isAi
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 font-semibold shadow-sm shadow-emerald-500/10'
                              : 'bg-white/5 text-slate-400 border-white/5'
                          }`}
                        >
                          {isAi && <Sparkles className="w-3 h-3 text-emerald-400" />}
                          #{cleanTag}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Ingredients & Instructions 2-column layout */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-4 border-t border-white/10">
              {/* Ingredients Column */}
              <div className="md:col-span-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-400">
                    Ingredients ({selectedRecipe.ingredients.length})
                  </h3>
                  <button
                    onClick={() => setIsEditRecipeModalOpen(true)}
                    className="text-[11px] font-semibold text-slate-400 hover:text-emerald-400 flex items-center gap-1 transition-colors px-2 py-1 rounded-lg hover:bg-white/5 cursor-pointer"
                    title="Edit Ingredients"
                  >
                    <Pencil className="w-3 h-3 text-emerald-400" />
                    <span>Edit</span>
                  </button>
                </div>

                <div className="space-y-1.5">
                  {selectedRecipe.ingredients.map((ing, i) => {
                    const isJustChecked = justCheckedIngredient === i;
                    const isChecked = Boolean(checkedIngredients[i]);
                    return (
                      <div
                        key={i}
                        onClick={() => handleToggleIngredient(i)}
                        className={`p-3 rounded-2xl flex items-center justify-between text-xs cursor-pointer transition-all border ${
                          isChecked
                            ? 'bg-emerald-500/10 text-slate-400 border-emerald-500/20'
                            : 'bg-slate-900/60 hover:bg-slate-900/90 text-slate-200 border-white/5'
                        } ${isJustChecked ? 'animate-row-crossing ring-1 ring-emerald-500/30' : ''}`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <div
                            className={`relative w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                              isChecked
                                ? 'border-emerald-500 bg-emerald-500 text-slate-950 shadow-sm shadow-emerald-500/30 ' +
                                  (isJustChecked ? 'animate-check-pop' : '')
                                : 'border-white/20'
                            }`}
                          >
                            <CheckSparkle trigger={isJustChecked} />
                            {isChecked && <Check className="w-3 h-3 font-bold stroke-[3]" />}
                          </div>
                          <span
                            className={`font-medium selectable-text transition-colors ${
                              isChecked ? 'text-slate-400' : ''
                            }`}
                          >
                            {ing.item}
                          </span>
                        </div>
                        {ing.amount && (
                          <span
                            className={`font-mono font-bold shrink-0 ${
                              isChecked ? 'text-slate-500' : 'text-slate-400'
                            }`}
                          >
                            {ing.amount} {ing.unit || ''}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Instructions Column */}
              <div className="md:col-span-7 space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-pink-400">
                  Step-by-Step Instructions ({selectedRecipe.instructions.length})
                </h3>

                <div className="space-y-3">
                  {selectedRecipe.instructions.map((step, i) => {
                    const isJustDone = justCompletedStep === i;
                    const isDone = Boolean(completedSteps[i]);
                    return (
                      <div
                        key={i}
                        id={`recipe-step-${i}`}
                        onClick={() => handleToggleStep(i)}
                        className={`p-4 rounded-3xl transition-all cursor-pointer border scroll-mt-24 ${
                          isDone
                            ? 'bg-slate-900/30 border-white/5 opacity-60'
                            : isCookMode
                            ? 'bg-slate-900/90 border-amber-500/40 shadow-lg'
                            : 'glass-panel-subtle border-white/5 hover:border-white/15'
                        } ${isJustDone ? 'animate-row-crossing ring-2 ring-emerald-500/40' : ''}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="relative shrink-0 mt-0.5">
                            <CheckSparkle trigger={isJustDone} />
                            <span
                              className={`w-6 h-6 rounded-xl flex items-center justify-center text-xs font-mono font-bold transition-all ${
                                isDone
                                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30 ' +
                                    (isJustDone ? 'animate-check-pop' : '')
                                  : 'bg-white/10 text-pink-400 hover:bg-pink-500/20'
                              }`}
                            >
                              {isDone ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : i + 1}
                            </span>
                          </div>
                          <p
                            className={`text-sm leading-relaxed selectable-text transition-colors ${
                              isDone ? 'text-slate-400 font-normal' : 'text-slate-100'
                            }`}
                          >
                            {step}
                          </p>
                        </div>
                      </div>
                    );
                  })}

                  {/* All Steps Completed Celebration Banner */}
                  {allStepsCompleted && (
                    <div className="p-5 rounded-3xl bg-gradient-to-br from-emerald-950/40 to-slate-900 border border-emerald-500/30 text-center space-y-3 animate-in fade-in shadow-xl shadow-emerald-500/10 relative overflow-hidden">
                      <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center animate-trophy-bounce border border-emerald-500/30 shadow-inner">
                        <ChefHat className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-base font-black text-white">
                          🎉 Recipe Completed! Bon Appétit!
                        </h4>
                        <p className="text-xs text-emerald-300/80 mt-1 max-w-sm mx-auto">
                          All steps crossed off! Time to sit back, relax, and enjoy your delicious meal.
                        </p>
                      </div>
                      <button
                        onClick={handleResetProgress}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-emerald-500/20 active:scale-95 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reset recipe for next time</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Recipe Box Grid List View */
        <div className="space-y-4">
          {/* Consistent Mobile-First Header */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-md shadow-emerald-500/20 text-slate-950">
                <BookOpen className="w-5 h-5 stroke-[2.2]" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                Recipes
                {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />}
              </h1>
            </div>

            <button
              type="button"
              onClick={() => setIsScraperOpen(true)}
              className="flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-emerald-500/20 active:scale-95"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Import</span>
            </button>
          </div>

          {/* Category / Tag Filter Pills */}
          {(hasAiRecipes || allUniqueTags.length > 0) && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none no-scrollbar">
              <button
                onClick={() => setSelectedTag(null)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedTag === null
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                    : 'bg-slate-900/80 hover:bg-slate-850 text-slate-300 border border-white/10'
                }`}
              >
                All Recipes ({recipes.length})
              </button>

              {hasAiRecipes && (
                <button
                  onClick={() => setSelectedTag(selectedTag === 'ai' ? null : 'ai')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                    selectedTag === 'ai'
                      ? 'bg-gradient-to-r from-emerald-400 to-teal-300 text-zinc-950 font-bold shadow-md shadow-emerald-500/20 ring-1 ring-white/40'
                      : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/25'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 stroke-[2.2]" />
                  <span>#ai</span>
                  <span className="text-[10px] opacity-80">
                    ({recipes.filter((r) => isAiRecipe(r)).length})
                  </span>
                </button>
              )}

              {allUniqueTags
                .filter((t) => t.toLowerCase() !== 'ai')
                .slice(0, 10)
                .map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                      selectedTag === tag
                        ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                        : 'bg-slate-900/80 hover:bg-slate-850 text-slate-300 border border-white/10'
                    }`}
                  >
                    #{tag}
                  </button>
                ))}
            </div>
          )}

          {/* Recipe Grid Cards */}
          {isLoading ? (
            <div className="py-12 text-center text-xs text-slate-400">Loading recipes...</div>
          ) : filteredRecipes.length === 0 ? (
            <div className="py-16 text-center glass-panel rounded-3xl p-8 border border-white/5 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
                <ChefHat className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">No recipes found</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {selectedTag === 'ai'
                  ? 'No AI-created recipes yet. Ask your Family Assistant to create a recipe!'
                  : 'Import your first recipe by pasting a link from any cooking site or asking the Gemini AI!'}
              </p>
              <div className="pt-2">
                <button
                  onClick={() => {
                    setSelectedTag(null);
                    setIsScraperOpen(true);
                  }}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2 rounded-2xl text-xs font-bold inline-flex items-center gap-2 transition-all shadow-md shadow-emerald-500/20"
                >
                  <Link2 className="w-4 h-4" />
                  <span>Import Recipe from Web</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredRecipes.map((recipe) => (
                <div
                  key={recipe.id}
                  onClick={() => handleSelectRecipe(recipe)}
                  className="glass-panel rounded-3xl border border-white/10 hover:border-emerald-500/40 overflow-hidden cursor-pointer transition-all hover:scale-[1.01] shadow-lg flex flex-col group"
                >
                  {/* Picture container with Assistant AI icon in bottom right-hand corner */}
                  <div className="relative w-full h-44 overflow-hidden border-b border-white/10">
                    {recipe.image_url ? (
                      <img
                        src={recipe.image_url}
                        alt={recipe.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full bg-slate-900 flex items-center justify-center text-slate-600">
                        <ChefHat className="w-10 h-10" />
                      </div>
                    )}

                    {/* Assistant AI icon badge in bottom right-hand corner */}
                    {isAiRecipe(recipe) && (
                      <div
                        className="absolute bottom-2.5 right-2.5 z-10 w-7 h-7 rounded-xl bg-gradient-to-tr from-emerald-400 to-teal-300 flex items-center justify-center text-zinc-950 shadow-lg shadow-emerald-950/50 border border-white/30 transition-transform group-hover:scale-110"
                        title="Created by AI Assistant (#ai)"
                      >
                        <Sparkles className="w-4 h-4 stroke-[2.2]" />
                      </div>
                    )}
                  </div>

                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <h3 className="text-sm font-bold text-white line-clamp-1 group-hover:text-pink-400 transition-colors">
                        {recipe.title}
                      </h3>
                      {recipe.description && (
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                          {recipe.description}
                        </p>
                      )}

                      {/* Recipe Tags preview */}
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
                      <span className="text-pink-400 font-semibold group-hover:translate-x-0.5 transition-transform">
                        View & Cook &rarr;
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Animated Expanding Search Dock & FAB */}
          <div className="fixed bottom-[calc(76px+1rem+env(safe-area-inset-bottom,0px))] md:bottom-8 left-0 right-0 z-40 px-4 pointer-events-none">
            <div className="max-w-3xl mx-auto pointer-events-none flex justify-end">
              <div
                ref={dockRef}
                className={`fab-dock-transition pointer-events-auto h-[50px] border shadow-2xl flex items-center overflow-hidden ${
                  isSearchExpanded
                    ? 'w-full rounded-3xl border-white/25 bg-slate-900/95 backdrop-blur-xl shadow-emerald-500/10 px-2'
                    : 'w-[50px] rounded-full border-emerald-400/40 bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 cursor-pointer shadow-xl shadow-emerald-500/30 hover:scale-105 active:scale-95 justify-center'
                }`}
              >
                {!isSearchExpanded ? (
                  <button
                    type="button"
                    onClick={() => setIsSearchExpanded(true)}
                    className="w-full h-full flex items-center justify-center text-slate-950"
                    title="Search Recipes"
                  >
                    <Search className="w-5 h-5 stroke-[2.2]" />
                  </button>
                ) : (
                  <div className="w-full flex items-center gap-2">
                    {/* Far left: Close button */}
                    <button
                      type="button"
                      onClick={() => setIsSearchExpanded(false)}
                      className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white shrink-0"
                      title="Close search"
                    >
                      <X className="w-4 h-4" />
                    </button>

                    {/* Secondary action: Import from Web */}
                    <button
                      type="button"
                      onClick={() => setIsScraperOpen(true)}
                      className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-white/5 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-400 border border-white/10 hover:border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 transition-all shrink-0"
                      title="Import Recipe from Web"
                    >
                      <Link2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="hidden sm:inline">Import</span>
                    </button>

                    {/* Middle: Search text input */}
                    <input
                      autoFocus
                      type="text"
                      placeholder="Search recipes by title or tags (e.g. Pasta, Quick)..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="flex-1 min-w-0 bg-transparent border-none text-xs text-white placeholder-slate-500 focus:outline-none px-1"
                    />

                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-white shrink-0"
                        title="Clear search text"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}

                    {/* Far right: Main action button (Search) */}
                    <button
                      type="button"
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-emerald-500/20 shrink-0"
                      title="Search recipes"
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Search</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scraper Modal */}
      {household && (
        <RecipeScraperModal
          isOpen={isScraperOpen}
          onClose={() => {
            setIsScraperOpen(false);
            setScraperInitialUrl('');
            setScraperAutoImport(false);
          }}
          householdId={household.id}
          initialUrl={scraperInitialUrl}
          autoImport={scraperAutoImport}
          onRecipeImported={(newRec) => {
            setRecipes((prev) => {
              const exists = prev.some((r) => r.id === newRec.id);
              return exists ? prev.map((r) => (r.id === newRec.id ? newRec : r)) : [newRec, ...prev];
            });
            handleSelectRecipe(newRec);
            setIsScraperOpen(false);
            setScraperInitialUrl('');
            setScraperAutoImport(false);
          }}
        />
      )}

      {/* Edit Recipe Modal */}
      {selectedRecipe && (
        <EditRecipeModal
          isOpen={isEditRecipeModalOpen}
          onClose={() => setIsEditRecipeModalOpen(false)}
          recipe={selectedRecipe}
          onSave={(updated) => {
            setSelectedRecipe(updated);
            setRecipes((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
          }}
        />
      )}
    </div>
  );
};
