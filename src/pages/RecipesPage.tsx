import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import type { Recipe } from '../types';
import { usePWA } from '../context/PWAContext';
import { api } from '../lib/api';
import { RecipeScraperModal } from '../components/RecipeScraperModal';
import { useFabAutoClose } from '../hooks/useFabAutoClose';

export const RecipesPage: React.FC = () => {
  const { household } = usePWA();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [isScraperOpen, setIsScraperOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

  const dockRef = useFabAutoClose<HTMLDivElement>({
    isOpen: isSearchExpanded,
    onClose: () => setIsSearchExpanded(false),
    ignore: isScraperOpen || Boolean(selectedRecipe),
  });
  const [isCookMode, setIsCookMode] = useState(false);
  const [checkedIngredients, setCheckedIngredients] = useState<Record<number, boolean>>({});
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({});
  const [addedGroceryFeedback, setAddedGroceryFeedback] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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
      const res = await api.addRecipeToGrocery(recipe.id, household.id);
      setAddedGroceryFeedback(`Added ${res.addedCount} ingredients to Grocery List!`);
      setTimeout(() => setAddedGroceryFeedback(null), 3500);
    } catch (err: any) {
      console.error('Add to grocery failed:', err);
      alert(err.message || 'Failed to add ingredients to grocery list');
    }
  };

  const handleToggleStep = (index: number) => {
    if (!selectedRecipe) return;
    const isNowCompleted = !completedSteps[index];

    setCompletedSteps((prev) => ({
      ...prev,
      [index]: isNowCompleted,
    }));

    // If step was just crossed off, scroll to the next step
    if (isNowCompleted) {
      let nextIndex = index + 1;
      while (nextIndex < selectedRecipe.instructions.length && completedSteps[nextIndex]) {
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
        }, 120);
      }
    }
  };

  const handleDeleteRecipe = async (id: string, title: string) => {
    if (confirm(`Are you sure you want to delete "${title}"?`)) {
      try {
        await api.deleteRecipe(id);
        setSelectedRecipe(null);
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
  };

  const filteredRecipes = recipes.filter((r) =>
    r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.tags?.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="max-w-6xl mx-auto p-2 sm:p-4 pb-36 md:pb-28 space-y-4">
      {/* If a recipe is selected, show detail view / Cook Mode */}
      {selectedRecipe ? (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Back button & Actions Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 glass-panel p-3 rounded-2xl border border-white/10">
            <button
              onClick={() => {
                setSelectedRecipe(null);
                setIsCookMode(false);
                setCheckedIngredients({});
                setCompletedSteps({});
              }}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-900/90 hover:bg-slate-850 px-3 py-2 rounded-xl border border-white/10 transition-colors shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Recipe Box</span>
            </button>

            <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">
              <button
                onClick={() => setIsCookMode(!isCookMode)}
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
                {selectedRecipe.image_url ? (
                  <img
                    src={selectedRecipe.image_url}
                    alt={selectedRecipe.title}
                    className="w-full h-56 object-cover rounded-3xl border border-white/10 shadow-lg"
                  />
                ) : (
                  <div className="w-full h-44 rounded-3xl bg-slate-900 border border-white/10 flex items-center justify-center text-slate-600">
                    <ChefHat className="w-12 h-12" />
                  </div>
                )}

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
                    {selectedRecipe.tags.map((t, idx) => (
                      <span
                        key={idx}
                        className="text-[11px] bg-white/5 text-slate-400 px-2.5 py-1 rounded-lg border border-white/5"
                      >
                        #{t}
                      </span>
                    ))}
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
                </div>

                <div className="space-y-1.5">
                  {selectedRecipe.ingredients.map((ing, i) => (
                    <div
                      key={i}
                      onClick={() =>
                        setCheckedIngredients((prev) => ({
                          ...prev,
                          [i]: !prev[i],
                        }))
                      }
                      className={`p-3 rounded-2xl flex items-center justify-between text-xs cursor-pointer transition-colors border ${
                        checkedIngredients[i]
                          ? 'bg-emerald-500/10 text-slate-400 border-emerald-500/20'
                          : 'bg-slate-900/60 hover:bg-slate-900/90 text-slate-200 border-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <div
                          className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                            checkedIngredients[i]
                              ? 'border-emerald-500 bg-emerald-500 text-slate-950'
                              : 'border-white/20'
                          }`}
                        >
                          {checkedIngredients[i] && <Check className="w-3 h-3 font-bold" />}
                        </div>
                        <span
                          className={`font-medium selectable-text ${
                            checkedIngredients[i] ? 'line-through text-slate-400' : ''
                          }`}
                        >
                          {ing.item}
                        </span>
                      </div>
                      {ing.amount && (
                        <span
                          className={`font-mono font-bold shrink-0 ${
                            checkedIngredients[i] ? 'text-slate-500 line-through' : 'text-slate-400'
                          }`}
                        >
                          {ing.amount} {ing.unit || ''}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Instructions Column */}
              <div className="md:col-span-7 space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-pink-400">
                  Step-by-Step Instructions ({selectedRecipe.instructions.length})
                </h3>

                <div className="space-y-3">
                  {selectedRecipe.instructions.map((step, i) => (
                    <div
                      key={i}
                      id={`recipe-step-${i}`}
                      onClick={() => handleToggleStep(i)}
                      className={`p-4 rounded-3xl transition-all cursor-pointer border scroll-mt-24 ${
                        completedSteps[i]
                          ? 'bg-slate-900/30 border-white/5 opacity-50'
                          : isCookMode
                          ? 'bg-slate-900/90 border-amber-500/40 shadow-lg'
                          : 'glass-panel-subtle border-white/5 hover:border-white/15'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`w-6 h-6 rounded-xl flex items-center justify-center text-xs font-mono font-bold shrink-0 mt-0.5 ${
                            completedSteps[i]
                              ? 'bg-emerald-500 text-slate-950'
                              : 'bg-white/10 text-pink-400'
                          }`}
                        >
                          {completedSteps[i] ? <Check className="w-3.5 h-3.5" /> : i + 1}
                        </span>
                        <p
                          className={`text-sm leading-relaxed selectable-text ${
                            completedSteps[i] ? 'line-through text-slate-500' : 'text-slate-100'
                          }`}
                        >
                          {step}
                        </p>
                      </div>
                    </div>
                  ))}

                  {/* All Steps Completed Celebration Banner */}
                  {allStepsCompleted && (
                    <div className="p-4 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-2.5 animate-in fade-in">
                      <p className="text-xs sm:text-sm font-bold text-emerald-400">
                        🎉 All instructions completed! Enjoy your meal!
                      </p>
                      <button
                        onClick={handleResetProgress}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-emerald-500/20"
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
          {/* Recipe Grid Cards */}
          {isLoading ? (
            <div className="py-12 text-center text-xs text-slate-400">Loading recipes...</div>
          ) : filteredRecipes.length === 0 ? (
            <div className="py-16 text-center glass-panel rounded-3xl p-8 border border-white/5 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-pink-500/10 text-pink-400 flex items-center justify-center mx-auto">
                <ChefHat className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">No recipes found</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Import your first recipe by pasting a link from any cooking site or asking the Gemini AI!
              </p>
              <div className="pt-2">
                <button
                  onClick={() => setIsScraperOpen(true)}
                  className="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-400 hover:to-rose-400 text-white px-4 py-2 rounded-2xl text-xs font-bold inline-flex items-center gap-2 transition-all shadow-lg shadow-pink-500/20"
                >
                  <Link2 className="w-4 h-4" />
                  <span>Import Recipe from Web</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {filteredRecipes.map((recipe) => (
                <div
                  key={recipe.id}
                  onClick={() => setSelectedRecipe(recipe)}
                  className="glass-panel rounded-3xl border border-white/10 hover:border-pink-500/40 overflow-hidden cursor-pointer transition-all hover:scale-[1.01] shadow-lg flex flex-col group"
                >
                  {recipe.image_url ? (
                    <img
                      src={recipe.image_url}
                      alt={recipe.title}
                      className="w-full h-44 object-cover border-b border-white/10 group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-40 bg-slate-900 flex items-center justify-center text-slate-600 border-b border-white/5">
                      <ChefHat className="w-10 h-10" />
                    </div>
                  )}

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
                className={`fab-dock-transition pointer-events-auto h-[52px] border shadow-2xl flex items-center overflow-hidden ${
                  isSearchExpanded
                    ? 'w-full rounded-3xl border-white/25 bg-slate-900/95 backdrop-blur-xl shadow-pink-500/10 px-2'
                    : 'w-[52px] rounded-full border-pink-400/40 bg-gradient-to-r from-pink-500 to-rose-500 cursor-pointer shadow-xl shadow-pink-500/30 hover:scale-105 active:scale-95 justify-center'
                }`}
              >
                {!isSearchExpanded ? (
                  <button
                    type="button"
                    onClick={() => setIsSearchExpanded(true)}
                    className="w-full h-full flex items-center justify-center text-white"
                    title="Search Recipes"
                  >
                    <Search className="w-6 h-6 stroke-[2.2]" />
                  </button>
                ) : (
                  <div className="w-full flex items-center gap-2">
                    {/* Far left: Close button */}
                    <button
                      type="button"
                      onClick={() => setIsSearchExpanded(false)}
                      className="p-2 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white shrink-0"
                      title="Close search"
                    >
                      <X className="w-4 h-4" />
                    </button>

                    {/* Secondary action: Import from Web (to the right of close button, left of text box) */}
                    <button
                      type="button"
                      onClick={() => setIsScraperOpen(true)}
                      className="p-2 sm:px-3 sm:py-2 rounded-2xl bg-white/5 hover:bg-pink-500/20 text-slate-300 hover:text-pink-400 border border-white/10 hover:border-pink-500/30 text-xs font-bold flex items-center gap-1.5 transition-all shrink-0"
                      title="Import Recipe from Web"
                    >
                      <Link2 className="w-4 h-4 text-pink-400" />
                      <span className="hidden sm:inline">Import</span>
                    </button>

                    {/* Middle: Search text input */}
                    <input
                      autoFocus
                      type="text"
                      placeholder="Search recipes by title or tags (e.g. Pasta, Quick)..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="flex-1 min-w-0 bg-transparent border-none text-sm text-white placeholder-slate-500 focus:outline-none px-1"
                    />

                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="p-2 rounded-xl text-slate-400 hover:text-white shrink-0"
                        title="Clear search text"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}

                    {/* Far right: Main action button (Search) */}
                    <button
                      type="button"
                      className="p-2 sm:px-3.5 sm:py-2 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-400 hover:to-rose-400 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-pink-500/20 shrink-0"
                      title="Search recipes"
                    >
                      <Search className="w-4 h-4" />
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
          onClose={() => setIsScraperOpen(false)}
          householdId={household.id}
          onRecipeImported={(newRec) => {
            setRecipes((prev) => [newRec, ...prev]);
            setSelectedRecipe(newRec);
            setIsScraperOpen(false);
          }}
        />
      )}
    </div>
  );
};
