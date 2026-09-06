'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePWA } from '@/components/pwa/PWAProvider';
import { RecipeData, RecipeIngredient } from '@/types';
import {
  BookOpen,
  Plus,
  Link as LinkIcon,
  Search,
  Clock,
  Users,
  ShoppingCart,
  Calendar,
  ExternalLink,
  Sparkles,
  CheckCircle2,
  Trash2,
  X,
  ChefHat,
  ChevronRight,
  Check
} from 'lucide-react';

function RecipesContent() {
  const searchParams = useSearchParams();
  const { activeMember, apiKey } = usePWA();
  const [recipes, setRecipes] = useState<RecipeData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Importer state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Selected recipe detail / cook modal
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeData | null>(null);
  const [cookMode, setCookMode] = useState(false);
  const [checkedSteps, setCheckedSteps] = useState<Record<number, boolean>>({});
  const [isExportingGrocery, setIsExportingGrocery] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Schedule to meal plan modal state
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleDate, setScheduleDate] = useState(new Date().toISOString().split('T')[0]);
  const [scheduleMealType, setScheduleMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('dinner');

  // Load recipes
  const fetchRecipes = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/recipes');
      if (res.ok) {
        const data = await res.json();
        setRecipes(data);
      }
    } catch (err) {
      console.error('Failed to load recipes:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecipes();

    // Check if opened via PWA Web Share Target
    const sharedUrl = searchParams.get('url') || searchParams.get('text');
    if (sharedUrl) {
      // Find URL inside text if needed
      const match = sharedUrl.match(/https?:\/\/[^\s]+/);
      const target = match ? match[0] : sharedUrl;
      setImportUrl(target);
      setShowImportModal(true);
    }
  }, [searchParams]);

  // Handle URL Import
  const handleImportRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importUrl.trim()) return;

    setIsImporting(true);
    setImportError(null);

    try {
      const res = await fetch('/api/recipes/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: importUrl.trim(),
          apiKey,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to import recipe');
      }

      if (data.recipe) {
        setRecipes((prev) => [data.recipe, ...prev]);
        setSelectedRecipe(data.recipe);
        setShowImportModal(false);
        setImportUrl('');
      }
    } catch (err: any) {
      setImportError(err.message || 'Error extracting recipe from URL');
    } finally {
      setIsImporting(false);
    }
  };

  // Add Ingredients to Grocery List
  const handleExportToGrocery = async (recipe: RecipeData) => {
    try {
      setIsExportingGrocery(true);
      let parsedIngs: RecipeIngredient[] = [];
      try {
        parsedIngs = JSON.parse(recipe.ingredients);
      } catch {
        parsedIngs = [{ item: recipe.ingredients }];
      }

      const res = await fetch('/api/meal-planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'export_ingredients',
          ingredients: parsedIngs,
          addedById: activeMember?.id,
        }),
      });

      if (res.ok) {
        setExportSuccess(true);
        setTimeout(() => setExportSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Failed to export ingredients:', err);
    } finally {
      setIsExportingGrocery(false);
    }
  };

  // Schedule Recipe to Weekly Meal Planner
  const handleScheduleMeal = async () => {
    if (!selectedRecipe) return;

    try {
      await fetch('/api/meal-planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: scheduleDate,
          mealType: scheduleMealType,
          title: selectedRecipe.title,
          recipeId: selectedRecipe.id,
        }),
      });
      setShowScheduleModal(false);
      alert(`Scheduled "${selectedRecipe.title}" for ${scheduleDate} (${scheduleMealType})!`);
    } catch (err) {
      console.error('Failed to schedule meal:', err);
    }
  };

  // Delete recipe
  const handleDeleteRecipe = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this recipe?')) return;

    setRecipes((prev) => prev.filter((r) => r.id !== id));
    if (selectedRecipe?.id === id) setSelectedRecipe(null);

    try {
      await fetch(`/api/recipes?id=${id}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Failed to delete recipe:', err);
    }
  };

  // Filter recipes
  const filteredRecipes = recipes.filter((r) => {
    const q = searchQuery.toLowerCase();
    return (
      r.title.toLowerCase().includes(q) ||
      (r.description || '').toLowerCase().includes(q) ||
      (r.tags || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 w-full space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            <BookOpen className="w-7 h-7 text-emerald-400" />
            Family Recipe Box
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Import recipes from any web link or let Gemini suggest delicious family meals.
          </p>
        </div>

        {/* Actions: Import URL */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/30 transition-all hover:scale-102"
          >
            <LinkIcon className="w-4 h-4" />
            <span>Import from Web Link</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search recipes, tags (e.g. Chicken, Dinner, Quick, Seafood)..."
          className="w-full bg-slate-900/90 text-slate-100 placeholder-slate-500 rounded-2xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 border border-slate-800"
        />
      </div>

      {/* Recipe Cards Grid */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-500 text-sm animate-pulse">
          Loading recipe collection...
        </div>
      ) : filteredRecipes.length === 0 ? (
        <div className="glass-panel p-12 rounded-3xl border border-slate-800 text-center space-y-3">
          <ChefHat className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="font-bold text-slate-200">No recipes found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Import a recipe from your favorite food blog or ask the Gemini Assistant for meal inspiration!
          </p>
          <button
            onClick={() => setShowImportModal(true)}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
          >
            Import First Recipe
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredRecipes.map((recipe) => {
            let ingCount = 0;
            try {
              ingCount = JSON.parse(recipe.ingredients)?.length || 0;
            } catch {}

            return (
              <div
                key={recipe.id}
                onClick={() => {
                  setSelectedRecipe(recipe);
                  setCookMode(false);
                  setCheckedSteps({});
                }}
                className="glass-panel rounded-2xl border border-slate-800 overflow-hidden hover:border-slate-700 transition-all hover:scale-[1.01] cursor-pointer flex flex-col group"
              >
                {/* Image */}
                <div className="relative h-44 w-full bg-slate-900 overflow-hidden">
                  {recipe.imageUrl ? (
                    <img
                      src={recipe.imageUrl}
                      alt={recipe.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-emerald-950/40 to-slate-900 text-emerald-500/40">
                      <ChefHat className="w-16 h-16" />
                    </div>
                  )}

                  {/* Badges on image */}
                  <div className="absolute top-2 right-2 flex items-center gap-1.5">
                    {recipe.cookTime && (
                      <span className="px-2 py-1 rounded-full bg-slate-950/80 backdrop-blur-md text-[11px] font-semibold text-emerald-300 flex items-center gap-1 border border-white/10">
                        <Clock className="w-3 h-3" />
                        {recipe.cookTime}
                      </span>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <h3 className="font-bold text-base text-slate-100 group-hover:text-emerald-300 transition-colors line-clamp-1">
                      {recipe.title}
                    </h3>
                    {recipe.description && (
                      <p className="text-xs text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                        {recipe.description}
                      </p>
                    )}
                  </div>

                  {/* Metadata Row */}
                  <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/80">
                    <div className="flex items-center gap-3">
                      {recipe.servings && (
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-slate-500" />
                          {recipe.servings} serv
                        </span>
                      )}
                      {ingCount > 0 && (
                        <span>{ingCount} ingr</span>
                      )}
                    </div>

                    <button
                      onClick={(e) => handleDeleteRecipe(recipe.id, e)}
                      className="text-slate-600 hover:text-rose-400 p-1 transition-colors"
                      title="Delete recipe"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* URL Recipe Importer Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <LinkIcon className="w-5 h-5 text-emerald-400" />
                Import Recipe from Web Link
              </h3>
              <button
                onClick={() => setShowImportModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleImportRecipe} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1.5">
                  Recipe URL / Web Page
                </label>
                <input
                  type="url"
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  placeholder="https://www.allrecipes.com/recipe/... or any cooking blog"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-emerald-500/50"
                  required
                />
                <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                  Supports JSON-LD structured recipe tags and Gemini web extraction fallback across popular food sites.
                </p>
              </div>

              {importError && (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs">
                  {importError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  disabled={isImporting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isImporting || !importUrl.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold shadow-md shadow-emerald-600/30"
                >
                  {isImporting ? (
                    <>
                      <Sparkles className="w-4 h-4 animate-spin text-white" />
                      <span>Extracting Recipe...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Import Recipe</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Recipe Detail / Cook Mode Modal */}
      {selectedRecipe && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header Bar */}
            <div className="p-4 sm:px-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCookMode(!cookMode)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                    cookMode
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-800 text-slate-300 hover:text-white'
                  }`}
                >
                  <ChefHat className="w-3.5 h-3.5" />
                  {cookMode ? 'Exit Cook Mode' : 'Cook Mode'}
                </button>
              </div>

              <button
                onClick={() => setSelectedRecipe(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              {/* Recipe Hero */}
              <div className="flex flex-col sm:flex-row gap-5">
                {selectedRecipe.imageUrl && (
                  <div className="w-full sm:w-48 h-44 rounded-2xl overflow-hidden shrink-0 border border-slate-800">
                    <img
                      src={selectedRecipe.imageUrl}
                      alt={selectedRecipe.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="flex-1 space-y-2">
                  <h2 className="text-xl sm:text-2xl font-black text-white">{selectedRecipe.title}</h2>
                  {selectedRecipe.description && (
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                      {selectedRecipe.description}
                    </p>
                  )}

                  {/* Metadata Chips */}
                  <div className="flex items-center gap-2 flex-wrap pt-1 text-xs">
                    {selectedRecipe.prepTime && (
                      <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300">
                        Prep: {selectedRecipe.prepTime}
                      </span>
                    )}
                    {selectedRecipe.cookTime && (
                      <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300">
                        Cook: {selectedRecipe.cookTime}
                      </span>
                    )}
                    {selectedRecipe.servings && (
                      <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300">
                        Servings: {selectedRecipe.servings}
                      </span>
                    )}
                    {selectedRecipe.sourceUrl && (
                      <a
                        href={selectedRecipe.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-emerald-400 hover:underline"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Source Link
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 flex-wrap p-3 rounded-2xl bg-slate-950/80 border border-slate-800">
                <button
                  onClick={() => handleExportToGrocery(selectedRecipe)}
                  disabled={isExportingGrocery}
                  className="flex-1 min-w-[200px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/30 transition-all"
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span>
                    {exportSuccess
                      ? '✓ Ingredients Added to Grocery List!'
                      : isExportingGrocery
                      ? 'Adding...'
                      : 'Add Ingredients to Grocery List'}
                  </span>
                </button>

                <button
                  onClick={() => setShowScheduleModal(true)}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors"
                >
                  <Calendar className="w-4 h-4 text-amber-400" />
                  <span>Schedule in Meal Plan</span>
                </button>
              </div>

              {/* Ingredients & Instructions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Ingredients Column */}
                <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-3">
                  <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-emerald-400" />
                    Ingredients
                  </h3>
                  <ul className="space-y-2 text-xs text-slate-300">
                    {(() => {
                      let items: any[] = [];
                      try {
                        items = JSON.parse(selectedRecipe.ingredients);
                      } catch {
                        items = [{ item: selectedRecipe.ingredients }];
                      }
                      return items.map((ing, i) => (
                        <li key={i} className="flex items-start gap-2 p-1.5 rounded-lg hover:bg-slate-800/40">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                          <span>{typeof ing === 'string' ? ing : ing.item}</span>
                        </li>
                      ));
                    })()}
                  </ul>
                </div>

                {/* Instructions Column */}
                <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-3">
                  <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
                    <ChefHat className="w-4 h-4 text-amber-400" />
                    Instructions
                  </h3>
                  <ol className="space-y-3 text-xs text-slate-300">
                    {(() => {
                      let steps: string[] = [];
                      try {
                        steps = JSON.parse(selectedRecipe.instructions);
                      } catch {
                        steps = [selectedRecipe.instructions];
                      }
                      return steps.map((step, idx) => {
                        const isDone = checkedSteps[idx];
                        return (
                          <li
                            key={idx}
                            onClick={() =>
                              cookMode &&
                              setCheckedSteps((prev) => ({ ...prev, [idx]: !prev[idx] }))
                            }
                            className={`flex items-start gap-3 p-2 rounded-xl transition-colors ${
                              cookMode ? 'cursor-pointer hover:bg-slate-800/60' : ''
                            } ${isDone ? 'opacity-50 line-through' : ''}`}
                          >
                            <span
                              className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 ${
                                isDone
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {isDone ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                            </span>
                            <span className="leading-relaxed flex-1">{step}</span>
                          </li>
                        );
                      });
                    })()}
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Schedule to Meal Plan Modal */}
      {showScheduleModal && selectedRecipe && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-5 shadow-2xl">
            <h3 className="font-bold text-base text-white mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-400" />
              Schedule Meal
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Date</label>
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Meal Slot</label>
                <select
                  value={scheduleMealType}
                  onChange={(e) => setScheduleMealType(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="breakfast">Breakfast</option>
                  <option value="lunch">Lunch</option>
                  <option value="dinner">Dinner</option>
                  <option value="snack">Snack</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowScheduleModal(false)}
                  className="px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleScheduleMeal}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                >
                  Schedule
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RecipesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading Recipe Box...</div>}>
      <RecipesContent />
    </Suspense>
  );
}
