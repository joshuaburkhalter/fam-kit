import React, { useState, useEffect } from 'react';
import { Drawer } from './ui/Drawer';
import {
  ArrowLeftRight,
  ShoppingCart,
  Sparkles,
  Loader2,
  Check,
  Plus,
  Info,
  ChefHat,
  RefreshCw,
} from 'lucide-react';
import { api } from '../lib/api';
import { getCuratedSubstitutions } from '../lib/substitutions';
import { triggerHaptic } from '../lib/haptics';
import type { IngredientSubstitution } from '../types';

interface IngredientSubstitutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  ingredient: {
    item: string;
    amount?: string;
    unit?: string;
  } | null;
  recipeTitle: string;
  recipeId?: string;
  householdId: string;
  isAlreadyOnGrocery?: boolean;
  onSelectSubstitution: (params: {
    substitution: IngredientSubstitution;
    updateRecipeInDb: boolean;
  }) => Promise<void>;
}

export const IngredientSubstitutionModal: React.FC<IngredientSubstitutionModalProps> = ({
  isOpen,
  onClose,
  ingredient,
  recipeTitle,
  isAlreadyOnGrocery = false,
  onSelectSubstitution,
}) => {
  const [substitutions, setSubstitutions] = useState<IngredientSubstitution[]>([]);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [alsoUpdateRecipe, setAlsoUpdateRecipe] = useState(false);
  const [isApplyingId, setIsApplyingId] = useState<string | null>(null);

  // Custom substitute write-in state
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const [customUnit, setCustomUnit] = useState('');

  useEffect(() => {
    if (!isOpen || !ingredient) {
      setSubstitutions([]);
      setShowCustomInput(false);
      setCustomName('');
      setCustomAmount('');
      setCustomUnit('');
      setAlsoUpdateRecipe(false);
      setIsApplyingId(null);
      return;
    }

    // 1. Instant local curated substitutions (0ms delay)
    const curated = getCuratedSubstitutions(ingredient.item, ingredient.amount, ingredient.unit);
    setSubstitutions(curated);
    setCustomAmount(ingredient.amount || '');
    setCustomUnit(ingredient.unit || '');

    // 2. If curated has fewer than 3 items, or to fetch AI suggestions, load in background
    if (curated.length < 3) {
      loadAiSubstitutions(ingredient, curated);
    }
  }, [isOpen, ingredient]);

  const loadAiSubstitutions = async (
    targetIngredient: { item: string; amount?: string; unit?: string },
    existing: IngredientSubstitution[]
  ) => {
    setIsLoadingAi(true);
    try {
      const apiKey = localStorage.getItem('famkit_gemini_api_key') || undefined;
      const res = await api.getIngredientSubstitutions({
        ingredient: targetIngredient.item,
        amount: targetIngredient.amount,
        unit: targetIngredient.unit,
        recipeTitle,
        apiKey,
      });

      if (res?.substitutions && res.substitutions.length > 0) {
        // Merge with existing avoiding duplicates
        const seen = new Set(existing.map((s) => s.name.toLowerCase().trim()));
        const merged = [...existing];
        for (const s of res.substitutions) {
          const lower = s.name.toLowerCase().trim();
          if (!seen.has(lower)) {
            seen.add(lower);
            merged.push(s);
          }
        }
        setSubstitutions(merged);
      }
    } catch (err) {
      console.warn('Could not load AI substitutions:', err);
    } finally {
      setIsLoadingAi(false);
    }
  };

  const handleApply = async (sub: IngredientSubstitution) => {
    setIsApplyingId(sub.id);
    triggerHaptic(40);
    try {
      await onSelectSubstitution({
        substitution: sub,
        updateRecipeInDb: alsoUpdateRecipe,
      });
      onClose();
    } catch (err: any) {
      console.error('Failed to apply substitution:', err);
      alert(err.message || 'Failed to apply substitution');
    } finally {
      setIsApplyingId(null);
    }
  };

  const handleApplyCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;

    const customSub: IngredientSubstitution = {
      id: `custom-${Date.now()}`,
      name: customName.trim(),
      amount: customAmount.trim() || ingredient?.amount || '',
      unit: customUnit.trim() || ingredient?.unit || '',
      ratio: 'Custom replacement',
      badge: 'Custom Choice',
      reason: `Custom substitute picked for ${recipeTitle}`,
      groceryItemName: customName.trim(),
    };

    await handleApply(customSub);
  };

  if (!ingredient) return null;

  const originalDesc = [ingredient.amount, ingredient.unit, ingredient.item].filter(Boolean).join(' ');

  const getBadgeStyle = (badge: string) => {
    const lower = badge.toLowerCase();
    if (lower.includes('health') || lower.includes('protein')) {
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    }
    if (lower.includes('dairy-free') || lower.includes('vegan') || lower.includes('plant')) {
      return 'bg-sky-500/15 text-sky-300 border-sky-500/30';
    }
    if (lower.includes('gluten') || lower.includes('grain')) {
      return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    }
    if (lower.includes('pantry') || lower.includes('hack') || lower.includes('staple')) {
      return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
    }
    return 'bg-white/10 text-slate-300 border-white/10';
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="truncate">Ingredient Substitutions</span>
        </div>
      }
      subtitle={`For: ${recipeTitle || 'Recipe'}`}
      maxWidth="max-w-xl"
    >
      <div className="space-y-4">
        {/* Original Ingredient Spotlight Card */}
        <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-white/10 flex items-center justify-between gap-3 shadow-inner">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
              <ChefHat className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                Original Ingredient
              </div>
              <div className="text-sm font-bold text-white truncate">{originalDesc}</div>
            </div>
          </div>
          {isAlreadyOnGrocery && (
            <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0 flex items-center gap-1">
              <ShoppingCart className="w-3 h-3" />
              <span>In Grocery</span>
            </span>
          )}
        </div>

        {/* Suggestion List */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-0.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Recommended Swaps ({substitutions.length})
            </span>
            {isLoadingAi && (
              <span className="text-[11px] text-emerald-400 flex items-center gap-1 animate-pulse font-medium">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Finding smart ideas...</span>
              </span>
            )}
          </div>

          {substitutions.length === 0 && !isLoadingAi && (
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-white/5 text-center space-y-2">
              <Info className="w-6 h-6 text-slate-400 mx-auto opacity-70" />
              <p className="text-xs text-slate-300">
                No instant substitutions found for <strong className="text-white">{ingredient.item}</strong>.
              </p>
              <button
                onClick={() => loadAiSubstitutions(ingredient, [])}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-semibold border border-emerald-500/30 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Ask AI for culinary substitutions</span>
              </button>
            </div>
          )}

          {substitutions.map((sub) => {
            const isApplying = isApplyingId === sub.id;
            return (
              <div
                key={sub.id}
                className="p-3.5 rounded-2xl bg-slate-900/80 hover:bg-slate-850/90 border border-white/10 transition-all space-y-2.5 group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
                        {sub.name}
                      </span>
                      {sub.badge && (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md border tracking-wide ${getBadgeStyle(
                            sub.badge
                          )}`}
                        >
                          {sub.badge}
                        </span>
                      )}
                      {sub.isAiGenerated && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-0.5">
                          <Sparkles className="w-2.5 h-2.5" /> AI
                        </span>
                      )}
                    </div>
                    {sub.ratio && (
                      <div className="text-[11px] font-mono font-semibold text-emerald-400">
                        {sub.ratio}
                        {sub.amount && sub.unit ? ` · use ${sub.amount} ${sub.unit}` : ''}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleApply(sub)}
                    disabled={Boolean(isApplyingId)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition-all shadow-sm ${
                      isAlreadyOnGrocery
                        ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30'
                        : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                    } disabled:opacity-50 cursor-pointer`}
                    title={
                      isAlreadyOnGrocery
                        ? `Replace ${ingredient.item} with ${sub.name} on Grocery list`
                        : `Add ${sub.name} to Grocery list`
                    }
                  >
                    {isApplying ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Updating...</span>
                      </>
                    ) : isAlreadyOnGrocery ? (
                      <>
                        <ArrowLeftRight className="w-3.5 h-3.5" />
                        <span>Replace in List</span>
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="w-3.5 h-3.5" />
                        <span>Add to Grocery</span>
                      </>
                    )}
                  </button>
                </div>

                {sub.reason && (
                  <p className="text-xs text-slate-300 leading-relaxed bg-white/5 p-2 rounded-xl border border-white/5">
                    {sub.reason}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* AI More ideas button */}
        {!isLoadingAi && substitutions.length > 0 && (
          <button
            onClick={() => loadAiSubstitutions(ingredient, substitutions)}
            className="w-full py-2 px-3 rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-white/5 hover:border-white/15 text-xs text-slate-300 hover:text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Ask AI for more substitution ideas</span>
          </button>
        )}

        {/* Recipe Update Checkbox Option */}
        <div className="pt-2 border-t border-white/10">
          <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-900/50 hover:bg-slate-900 border border-white/5 cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={alsoUpdateRecipe}
              onChange={(e) => setAlsoUpdateRecipe(e.target.checked)}
              className="mt-0.5 rounded border-white/20 bg-slate-800 text-emerald-500 focus:ring-emerald-500/40 w-4 h-4"
            />
            <div className="text-xs space-y-0.5">
              <span className="font-semibold text-white block">
                Also update this recipe permanently
              </span>
              <span className="text-slate-400 block text-[11px] leading-relaxed">
                Swaps {ingredient.item} in this recipe's ingredients card so your family recipe reflects your preferred substitute.
              </span>
            </div>
          </label>
        </div>

        {/* Custom Write-In Option */}
        <div className="pt-1">
          {!showCustomInput ? (
            <button
              onClick={() => setShowCustomInput(true)}
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 py-1 px-1 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Have another substitute in mind? Type your own</span>
            </button>
          ) : (
            <form
              onSubmit={handleApplyCustom}
              className="p-3.5 rounded-2xl bg-slate-900/80 border border-white/10 space-y-3 animate-in fade-in"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">Custom Replacement</span>
                <button
                  type="button"
                  onClick={() => setShowCustomInput(false)}
                  className="text-[11px] text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-2">
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="e.g. Cashew sour cream, Oat milk..."
                    className="w-full px-3 py-2 bg-slate-950/70 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
                    autoFocus
                  />
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    type="text"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    placeholder="Amount"
                    className="w-full px-2.5 py-2 bg-slate-950/70 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
                  />
                  <input
                    type="text"
                    value={customUnit}
                    onChange={(e) => setCustomUnit(e.target.value)}
                    placeholder="Unit"
                    className="w-full px-2.5 py-2 bg-slate-950/70 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="submit"
                  disabled={!customName.trim() || Boolean(isApplyingId)}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>Add Custom Swap to Grocery</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </Drawer>
  );
};
