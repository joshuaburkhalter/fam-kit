import React, { useState, useEffect, useRef } from 'react';
import { Drawer } from '../ui/Drawer';
import {
  Sparkles,
  RefreshCw,
  Plus,
  Clock,
  Users,
  ChefHat,
  X,
  AlertCircle,
  Check,
  Loader2,
  BookOpen,
} from 'lucide-react';
import type { Recipe } from '../../types';
import { api } from '../../lib/api';
import { usePWA } from '../../context/PWAContext';

interface RecipePromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  householdId: string;
  onRecipeCreated: (recipe: Recipe) => void;
}

interface GeneratedRecipeData {
  title: string;
  description?: string;
  category?: string;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  servings?: number;
  imageUrl?: string;
  tags: string[];
  ingredients: { item: string; amount?: string; unit?: string; category?: string }[];
  instructions: string[];
  sourceUrl?: string;
}

const MAX_TRIES = 5;

export const RecipePromptModal: React.FC<RecipePromptModalProps> = ({
  isOpen,
  onClose,
  householdId,
  onRecipeCreated,
}) => {
  const { apiKey } = usePWA();
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // History & iteration tracking (up to 5 tries)
  const [currentRecipe, setCurrentRecipe] = useState<GeneratedRecipeData | null>(null);
  const [tryCount, setTryCount] = useState(0);
  const [previousTitles, setPreviousTitles] = useState<string[]>([]);

  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Reset or autofocus on open
  useEffect(() => {
    if (isOpen) {
      if (!currentRecipe) {
        setTimeout(() => {
          inputRef.current?.focus();
        }, 150);
      }
    } else {
      // Clear state when closed
      setPrompt('');
      setCurrentRecipe(null);
      setTryCount(0);
      setPreviousTitles([]);
      setError(null);
      setIsGenerating(false);
      setIsSaving(false);
    }
  }, [isOpen]);

  const handleGenerate = async (forcedPrompt?: string) => {
    const textToUse = (forcedPrompt !== undefined ? forcedPrompt : prompt).trim();
    if (!textToUse || isGenerating) return;

    if (tryCount >= MAX_TRIES) {
      return;
    }

    setIsGenerating(true);
    setError(null);

    const nextIteration = tryCount + 1;

    try {
      const generated = await api.generateRecipeFromPrompt({
        prompt: textToUse,
        iteration: nextIteration,
        previousTitles,
        apiKey,
      });

      setCurrentRecipe(generated);
      setTryCount(nextIteration);
      if (generated.title && !previousTitles.includes(generated.title)) {
        setPreviousTitles((prev) => [...prev, generated.title]);
      }
    } catch (err: any) {
      console.error('Failed to generate recipe from prompt:', err);
      setError(err?.message || 'Failed to generate recipe. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddRecipe = async () => {
    if (!currentRecipe || isSaving || !householdId) return;

    setIsSaving(true);
    setError(null);

    try {
      const created = await api.createRecipe(householdId, {
        title: currentRecipe.title,
        description: currentRecipe.description,
        category: currentRecipe.category || 'Dinner',
        prep_time_minutes: currentRecipe.prepTimeMinutes,
        cook_time_minutes: currentRecipe.cookTimeMinutes,
        servings: currentRecipe.servings || 4,
        image_url: currentRecipe.imageUrl,
        source_url: currentRecipe.sourceUrl || 'Created by Prompt',
        tags: currentRecipe.tags || ['ai'],
        ingredients: currentRecipe.ingredients,
        instructions: currentRecipe.instructions,
      });

      onRecipeCreated(created);
      onClose();
    } catch (err: any) {
      console.error('Failed to save generated recipe:', err);
      setError(err?.message || 'Failed to save recipe. Please try again.');
      setIsSaving(false);
    }
  };

  const isExhausted = tryCount >= MAX_TRIES;
  const remainingTries = Math.max(0, MAX_TRIES - tryCount);

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Create with Prompt"
      subtitle={
        currentRecipe
          ? `Generated Recipe · Try ${tryCount} of ${MAX_TRIES}`
          : 'Describe any meal, dietary preference, or ingredients on hand'
      }
      icon={<Sparkles className="w-5 h-5 text-purple-400" />}
      width="max-w-xl"
    >
      <div className="p-4 sm:p-5 space-y-4">
        {/* Error banner */}
        {error && (
          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">{error}</div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-rose-400 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Input section (always available to tweak prompt) */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span>Your Prompt</span>
              <span className="text-[10px] text-purple-400 font-mono">AI Chef</span>
            </span>
            {tryCount > 0 && (
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isExhausted
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                }`}
              >
                {tryCount} / {MAX_TRIES} tries used
              </span>
            )}
          </label>
          <div className="relative">
            <textarea
              ref={inputRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={isGenerating || isSaving}
              rows={2}
              placeholder="e.g. Quick 20-minute creamy chicken pasta with broccoli and garlic, family friendly..."
              className="w-full bg-slate-900/80 border border-white/10 rounded-2xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/40 transition-all resize-none disabled:opacity-50"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  if (!isExhausted) {
                    handleGenerate();
                  }
                }
              }}
            />
          </div>

          {!currentRecipe && (
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-400">
                Tip: Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white font-mono text-[10px]">Ctrl+Enter</kbd> to generate
              </span>
              <button
                type="button"
                onClick={() => handleGenerate()}
                disabled={!prompt.trim() || isGenerating}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white text-xs font-bold transition-all shadow-md shadow-purple-500/25 active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer flex items-center gap-1.5"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Cooking up recipe...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Generate Recipe</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Loading placeholder skeleton */}
        {isGenerating && (
          <div className="p-8 rounded-3xl bg-slate-900/60 border border-purple-500/30 text-center space-y-3 animate-pulse">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/15 text-purple-400 flex items-center justify-center mx-auto">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
            <div className="space-y-1">
              <div className="text-xs font-bold text-white">
                {tryCount === 0 ? 'Generating your custom recipe...' : `Cooking up attempt #${tryCount + 1}...`}
              </div>
              <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                Balancing ingredients, cooking times, instructions, and matching food photography.
              </p>
            </div>
          </div>
        )}

        {/* 5-Try Exhaustion Message */}
        {isExhausted && currentRecipe && !isGenerating && (
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="font-bold text-amber-300">Sorry we couldn't nail it!</div>
              <p className="text-[11px] text-amber-200/80 leading-relaxed">
                You've reached the 5-try limit for this prompt. You can still add this latest version to your recipes, or close this window without saving.
              </p>
            </div>
          </div>
        )}

        {/* Render Generated Recipe Preview */}
        {currentRecipe && !isGenerating && (
          <div className="space-y-4 rounded-3xl bg-slate-900/70 border border-white/10 p-4 sm:p-5 animate-in fade-in duration-200">
            {/* Header / Hero */}
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              {currentRecipe.imageUrl && (
                <img
                  src={currentRecipe.imageUrl}
                  alt={currentRecipe.title}
                  className="w-full sm:w-28 h-28 object-cover rounded-2xl border border-white/10 shrink-0 shadow-lg shadow-black/40"
                  referrerPolicy="no-referrer"
                />
              )}
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    {currentRecipe.category || 'Dinner'}
                  </span>
                  {currentRecipe.tags?.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 text-slate-400 border border-white/5"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
                <h3 className="text-base font-bold text-white tracking-tight leading-snug">
                  {currentRecipe.title}
                </h3>
                {currentRecipe.description && (
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {currentRecipe.description}
                  </p>
                )}

                {/* Quick stats pills */}
                <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-300">
                  {currentRecipe.prepTimeMinutes && (
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Prep: {currentRecipe.prepTimeMinutes}m</span>
                    </div>
                  )}
                  {currentRecipe.cookTimeMinutes && (
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Cook: {currentRecipe.cookTimeMinutes}m</span>
                    </div>
                  )}
                  {currentRecipe.servings && (
                    <div className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span>{currentRecipe.servings} servings</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Ingredients preview */}
            <div className="space-y-2 pt-2 border-t border-white/5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-200">
                  Ingredients ({currentRecipe.ingredients?.length || 0})
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                {currentRecipe.ingredients?.map((ing, i) => (
                  <div
                    key={i}
                    className="p-2 rounded-xl bg-slate-950/60 border border-white/5 flex items-center justify-between text-xs"
                  >
                    <span className="font-medium text-slate-200 truncate pr-2">
                      {ing.item}
                    </span>
                    {(ing.amount || ing.unit) && (
                      <span className="font-mono text-slate-400 text-[11px] shrink-0 font-semibold">
                        {ing.amount || ''} {ing.unit || ''}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Instructions preview */}
            <div className="space-y-2 pt-2 border-t border-white/5">
              <span className="font-bold text-slate-200 text-xs block">
                Instructions ({currentRecipe.instructions?.length || 0} steps)
              </span>
              <ol className="space-y-2 max-h-44 overflow-y-auto pr-1">
                {currentRecipe.instructions?.map((step, idx) => (
                  <li
                    key={idx}
                    className="text-xs text-slate-300 flex items-start gap-2.5 leading-relaxed bg-slate-950/40 p-2 rounded-xl border border-white/5"
                  >
                    <span className="w-5 h-5 rounded-full bg-white/10 text-slate-300 font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="flex-1">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}

        {/* Bottom Actions Bar */}
        {currentRecipe && !isGenerating && (
          <div className="pt-2 flex flex-col-reverse sm:flex-row items-center justify-between gap-3 border-t border-white/10">
            {/* Left side close / info */}
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-xs font-semibold transition-all cursor-pointer text-center"
            >
              Cancel
            </button>

            {/* Right side buttons */}
            <div className="w-full sm:w-auto flex items-center justify-end gap-2">
              {/* Regenerate Button (or Close if 5 tries reached) */}
              {isExhausted ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold transition-all border border-white/10 cursor-pointer"
                >
                  Close
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleGenerate()}
                  disabled={isGenerating || isSaving}
                  className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-purple-300 hover:text-purple-200 text-xs font-bold transition-all border border-purple-500/30 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
                  title={`Try a different variation (${remainingTries} tries remaining)`}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Regenerate ({remainingTries} left)</span>
                </button>
              )}

              {/* Add to Recipes Button */}
              <button
                type="button"
                onClick={handleAddRecipe}
                disabled={isSaving || isGenerating}
                className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 text-xs font-bold transition-all shadow-md shadow-emerald-500/20 active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    <span>Add to Recipes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
};
