import React, { useState, useEffect } from 'react';
import { ShoppingCart, Users, Plus, Minus, Check, Trash2, Sparkles, Scale } from 'lucide-react';
import type { Recipe, InventoryItem } from '../../types';
import { Drawer } from '../ui/Drawer';
import { scaleAmountString, scaleIngredient } from '../../lib/recipeScaling';

interface RecipeBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipe: Recipe | null;
  initialMultiplier?: number;
  isInGrocery: boolean;
  onConfirmAdd: (recipe: Recipe, multiplier: number) => Promise<void> | void;
  onConfirmUpdate?: (recipe: Recipe, multiplier: number) => Promise<void> | void;
  onRemove?: (recipe: Recipe) => Promise<void> | void;
  getIngredientPantryMatch?: (name: string) => InventoryItem | null | undefined;
}

export const RecipeBatchModal: React.FC<RecipeBatchModalProps> = ({
  isOpen,
  onClose,
  recipe,
  initialMultiplier = 1,
  isInGrocery,
  onConfirmAdd,
  onConfirmUpdate,
  onRemove,
  getIngredientPantryMatch,
}) => {
  const [multiplier, setMultiplier] = useState<number>(initialMultiplier);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMultiplier(initialMultiplier > 0 ? initialMultiplier : 1);
      setIsSubmitting(false);
    }
  }, [isOpen, initialMultiplier]);

  if (!recipe) return null;

  const handleStep = (delta: number) => {
    setMultiplier((prev) => {
      const next = Math.round((prev + delta) * 10) / 10;
      return Math.max(0.5, Math.min(10, next));
    });
  };

  const handlePreset = (val: number) => {
    setMultiplier(val);
  };

  const handleAdd = async () => {
    setIsSubmitting(true);
    try {
      await onConfirmAdd(recipe, multiplier);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    setIsSubmitting(true);
    try {
      if (onConfirmUpdate) {
        await onConfirmUpdate(recipe, multiplier);
      } else {
        await onConfirmAdd(recipe, multiplier);
      }
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemove = async () => {
    setIsSubmitting(true);
    try {
      if (onRemove) {
        await onRemove(recipe);
      }
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const baseServings = recipe.servings ? Number(recipe.servings) : null;
  const scaledServings = baseServings ? Math.round(baseServings * multiplier * 10) / 10 : null;

  const rawIngredients = recipe.ingredients && recipe.ingredients.length > 0
    ? recipe.ingredients
    : [{ item: recipe.title, amount: '', unit: '', category: 'Other' }];

  const scaledIngredients = rawIngredients.map((ing) => scaleIngredient(ing, multiplier));

  const multiplierPills = [
    { val: 0.5, label: '½x', desc: 'Less people' },
    { val: 1,   label: '1x', desc: 'Standard' },
    { val: 1.5, label: '1.5x', desc: 'Family' },
    { val: 2,   label: '2x', desc: 'Double' },
    { val: 3,   label: '3x', desc: 'Crowd' },
  ];

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <span>{isInGrocery ? 'Adjust Recipe Batch' : 'Add Recipe to Grocery'}</span>
        </span>
      }
      subtitle={recipe.title}
      icon={<Scale className="w-5 h-5 text-teal-400" />}
      maxWidth="max-w-md"
      footer={
        <div className="flex flex-col gap-2 w-full">
          {isInGrocery ? (
            <div className="flex items-center gap-2 w-full">
              {onRemove && (
                <button
                  type="button"
                  onClick={handleRemove}
                  disabled={isSubmitting}
                  className="px-3.5 py-3 rounded-2xl border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                  title="Remove this recipe's items from your grocery list"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Remove</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleUpdate}
                disabled={isSubmitting}
                className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 text-slate-950 font-bold text-sm shadow-lg shadow-teal-500/20 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>Update Grocery List ({multiplier === 0.5 ? '½x' : `${multiplier}x`})</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 w-full">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-3 rounded-2xl border border-white/10 hover:bg-white/5 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAdd}
                disabled={isSubmitting}
                className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <ShoppingCart className="w-4 h-4 stroke-[2.5]" />
                <span>Add {multiplier === 0.5 ? '½x' : multiplier === 1 ? '' : `${multiplier}x `}to Grocery List</span>
              </button>
            </div>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {/* Multiplier / Servings Control Box */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Batch Multiplier
            </span>
            {scaledServings !== null && (
              <span className="text-xs font-semibold text-teal-300 flex items-center gap-1 bg-teal-500/10 px-2 py-0.5 rounded-lg border border-teal-500/20">
                <Users className="w-3.5 h-3.5" />
                <span>
                  {scaledServings} serving{scaledServings === 1 ? '' : 's'}
                  {baseServings && multiplier !== 1 && (
                    <span className="text-slate-400 ml-1 font-normal">(was {baseServings})</span>
                  )}
                </span>
              </span>
            )}
          </div>

          {/* Stepper Display */}
          <div className="flex items-center justify-between bg-slate-950/60 p-2 rounded-xl border border-white/5">
            <button
              type="button"
              onClick={() => handleStep(-0.5)}
              disabled={multiplier <= 0.5}
              className="w-10 h-10 rounded-lg bg-slate-800/80 hover:bg-slate-700 active:scale-95 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center text-slate-200 cursor-pointer transition-all"
              aria-label="Decrease multiplier"
            >
              <Minus className="w-4 h-4" />
            </button>

            <div className="text-center px-4">
              <span className="text-2xl font-black text-white tracking-tight">
                {multiplier === 0.5 ? '½' : multiplier}
                <span className="text-teal-400 text-lg ml-0.5 font-bold">x</span>
              </span>
              <p className="text-[11px] text-slate-400">
                {multiplier < 1
                  ? 'Cooking for less people'
                  : multiplier === 1
                  ? 'Standard recipe size'
                  : 'Cooking for more people'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleStep(0.5)}
              disabled={multiplier >= 10}
              className="w-10 h-10 rounded-lg bg-slate-800/80 hover:bg-slate-700 active:scale-95 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center text-slate-200 cursor-pointer transition-all"
              aria-label="Increase multiplier"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Preset Pills */}
          <div className="grid grid-cols-5 gap-1.5 pt-1">
            {multiplierPills.map((pill) => {
              const isActive = multiplier === pill.val;
              return (
                <button
                  key={pill.val}
                  type="button"
                  onClick={() => handlePreset(pill.val)}
                  className={`py-1.5 px-1 rounded-xl text-center transition-all cursor-pointer ${
                    isActive
                      ? 'bg-teal-500 text-slate-950 font-bold shadow-md shadow-teal-500/25 ring-1 ring-teal-300'
                      : 'bg-slate-800/50 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/5'
                  }`}
                >
                  <div className="text-xs font-bold leading-tight">{pill.label}</div>
                  <div className={`text-[9px] leading-tight truncate ${isActive ? 'text-slate-900 font-semibold' : 'text-slate-400'}`}>
                    {pill.desc}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Scaled Ingredients Preview */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs px-1 text-slate-400">
            <span className="font-semibold uppercase tracking-wider text-[11px]">
              Ingredients Preview ({scaledIngredients.length})
            </span>
            {multiplier !== 1 && (
              <span className="text-teal-400 text-[11px] font-medium flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Quantities multiplied by {multiplier === 0.5 ? '½' : multiplier}x
              </span>
            )}
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
            {scaledIngredients.map((ing, idx) => {
              const pantryMatch = getIngredientPantryMatch ? getIngredientPantryMatch(ing.item) : null;
              const hasPantry = Boolean(pantryMatch);
              const originalAmount = rawIngredients[idx]?.amount;
              const isScaled = multiplier !== 1 && originalAmount && ing.amount !== originalAmount;

              return (
                <div
                  key={idx}
                  className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                    hasPantry
                      ? 'bg-slate-900/40 border-white/5 text-slate-400 opacity-75'
                      : 'bg-slate-900/80 border-white/10 text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400 shrink-0" />
                    <span className="font-medium truncate">{ing.item}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 text-right">
                    {ing.amount && (
                      <span className={`font-mono font-bold ${isScaled ? 'text-teal-300' : 'text-slate-300'}`}>
                        {ing.amount} {ing.unit || ''}
                      </span>
                    )}
                    {hasPantry && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 shrink-0">
                        In pantry
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Drawer>
  );
};
