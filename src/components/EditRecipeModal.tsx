import React, { useState, useEffect, useRef } from 'react';
import { Drawer } from './ui/Drawer';
import { Plus, Trash2, Loader2, ChefHat, Check, Camera, ImageIcon, Link2 } from 'lucide-react';
import type { Recipe } from '../types';
import { api } from '../lib/api';
import { compressImageFile } from '../lib/imageCompression';

interface EditRecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipe: Recipe;
  onSave: (updated: Recipe) => void;
}

export const EditRecipeModal: React.FC<EditRecipeModalProps> = ({
  isOpen,
  onClose,
  recipe,
  onSave,
}) => {
  const [title, setTitle] = useState(recipe.title);
  const [description, setDescription] = useState(recipe.description || '');
  const [imageUrl, setImageUrl] = useState(recipe.image_url || '');
  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [prepTime, setPrepTime] = useState(recipe.prep_time_minutes?.toString() || '');
  const [cookTime, setCookTime] = useState(recipe.cook_time_minutes?.toString() || '');
  const [servings, setServings] = useState(recipe.servings?.toString() || '');
  const [tagsStr, setTagsStr] = useState((recipe.tags || []).join(', '));
  const [ingredients, setIngredients] = useState<Array<{ item: string; amount?: string; unit?: string }>>(() => {
    return (recipe.ingredients || []).map((ing) => ({
      item: ing.item,
      amount: ing.amount || '',
      unit: ing.unit || '',
    }));
  });
  const [instructions, setInstructions] = useState<string[]>(() => {
    return (recipe.instructions || []).slice();
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTitle(recipe.title);
    setDescription(recipe.description || '');
    setImageUrl(recipe.image_url || '');
    setShowUrlInput(false);
    setPrepTime(recipe.prep_time_minutes?.toString() || '');
    setCookTime(recipe.cook_time_minutes?.toString() || '');
    setServings(recipe.servings?.toString() || '');
    setTagsStr((recipe.tags || []).join(', '));
    setIngredients(
      (recipe.ingredients || []).map((ing) => ({
        item: ing.item,
        amount: ing.amount || '',
        unit: ing.unit || '',
      }))
    );
    setInstructions((recipe.instructions || []).slice());
    setError(null);
  }, [recipe]);

  const handleAddIngredient = () => {
    setIngredients((prev) => [...prev, { item: '', amount: '', unit: '' }]);
  };

  const handleUpdateIngredient = (index: number, field: 'item' | 'amount' | 'unit', value: string) => {
    setIngredients((prev) =>
      prev.map((ing, i) => (i === index ? { ...ing, [field]: value } : ing))
    );
  };

  const handleRemoveIngredient = (index: number) => {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddInstruction = () => {
    setInstructions((prev) => [...prev, '']);
  };

  const handleUpdateInstruction = (index: number, value: string) => {
    setInstructions((prev) => prev.map((inst, i) => (i === index ? value : inst)));
  };

  const handleRemoveInstruction = (index: number) => {
    setInstructions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Recipe title is required');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const cleanIngredients = ingredients
        .map((ing) => ({
          item: ing.item.trim(),
          amount: ing.amount?.trim() || undefined,
          unit: ing.unit?.trim() || undefined,
        }))
        .filter((ing) => Boolean(ing.item));

      const cleanInstructions = instructions
        .map((inst) => inst.trim())
        .filter(Boolean);

      const cleanTags = tagsStr
        .split(',')
        .map((t) => t.trim().replace(/^#/, ''))
        .filter(Boolean);

      let savedRecipe: Recipe;
      if (recipe.id) {
        savedRecipe = await api.updateRecipe(recipe.id, {
          title: title.trim(),
          description: description.trim() || undefined,
          image_url: imageUrl ? imageUrl.trim() : null,
          prep_time_minutes: prepTime ? parseInt(prepTime, 10) : undefined,
          cook_time_minutes: cookTime ? parseInt(cookTime, 10) : undefined,
          servings: servings ? parseInt(servings, 10) : undefined,
          tags: cleanTags,
          ingredients: cleanIngredients,
          instructions: cleanInstructions,
        });
      } else {
        savedRecipe = await api.createRecipe(recipe.household_id, {
          title: title.trim(),
          description: description.trim() || undefined,
          image_url: imageUrl ? imageUrl.trim() : undefined,
          prep_time_minutes: prepTime ? parseInt(prepTime, 10) : undefined,
          cook_time_minutes: cookTime ? parseInt(cookTime, 10) : undefined,
          servings: servings ? parseInt(servings, 10) : undefined,
          tags: cleanTags,
          ingredients: cleanIngredients,
          instructions: cleanInstructions,
        });
      }

      onSave(savedRecipe);
      onClose();
    } catch (err: any) {
      console.error('Failed to save recipe:', err);
      setError(err.message || 'Failed to save recipe');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={recipe.id ? "Edit Recipe" : "New Recipe"}
      subtitle={recipe.id ? "Update title, ingredients, notes, or instructions" : "Add a custom recipe to your collection"}
      icon={<ChefHat className="w-5 h-5 text-emerald-400" />}
      footer={
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="edit-recipe-form"
            disabled={isSaving || !title.trim()}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center gap-1.5 shadow-md shadow-emerald-500/20 disabled:opacity-50 transition-all cursor-pointer"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Save Recipe</span>
              </>
            )}
          </button>
        </div>
      }
    >
      {error && (
        <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
          {error}
        </div>
      )}

      <form id="edit-recipe-form" onSubmit={handleSubmit} className="space-y-6">
        {/* Recipe Photo */}
        <div>
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            Recipe Photo
          </label>

          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setIsCompressingPhoto(true);
              try {
                const res = await compressImageFile(file, { maxWidth: 1280, maxHeight: 1280, quality: 0.82 });
                setImageUrl(res.dataUrl);
              } catch (err: any) {
                console.error('Failed to process image:', err);
                setError('Failed to process image: ' + (err.message || 'Unknown error'));
              } finally {
                setIsCompressingPhoto(false);
                if (e.target) e.target.value = '';
              }
            }}
          />

          {imageUrl ? (
            <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-slate-900 group">
              <img
                src={imageUrl}
                alt="Recipe preview"
                className="w-full h-44 object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-black/30 flex items-end p-3 justify-between">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isCompressingPhoto}
                    onClick={() => photoInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isCompressingPhoto ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Camera className="w-3.5 h-3.5" />
                    )}
                    <span>Replace</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowUrlInput(!showUrlInput)}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/20 text-xs font-medium flex items-center gap-1 backdrop-blur-sm transition-all cursor-pointer"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span>URL</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setImageUrl('')}
                  className="p-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 text-xs font-medium flex items-center gap-1 backdrop-blur-sm transition-all cursor-pointer"
                  title="Remove photo"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="border border-dashed border-white/15 hover:border-emerald-500/40 rounded-2xl p-4 bg-slate-900/40 hover:bg-slate-900/60 transition-all text-center">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-2.5">
                {isCompressingPhoto ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Camera className="w-5 h-5" />
                )}
              </div>
              <p className="text-xs font-semibold text-white mb-1">
                {isCompressingPhoto ? 'Compressing photo...' : 'Add a dish photo'}
              </p>
              <p className="text-[11px] text-slate-400 mb-3">
                Take a picture with your camera or select from your photo library
              </p>
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  disabled={isCompressingPhoto}
                  onClick={() => photoInputRef.current?.click()}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Take / Upload Photo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowUrlInput(!showUrlInput)}
                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-xs font-medium flex items-center gap-1 transition-all cursor-pointer"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  <span>Image Link</span>
                </button>
              </div>
            </div>
          )}

          {showUrlInput && (
            <div className="mt-2.5 flex items-center gap-2 animate-in fade-in">
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://images.unsplash.com/..."
                className="flex-1 bg-slate-900/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
              />
              {imageUrl && (
                <button
                  type="button"
                  onClick={() => setShowUrlInput(false)}
                  className="px-3 py-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold cursor-pointer"
                >
                  Done
                </button>
              )}
            </div>
          )}
        </div>

        {/* Title & Description */}
        <div className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Recipe Title
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                placeholder="e.g. Peanut Butter-Chocolate Protein Bars"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Description / Summary
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50 resize-none"
                placeholder="Brief description or origin of recipe..."
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Prep (min)
                </label>
                <input
                  type="number"
                  min="0"
                  value={prepTime}
                  onChange={(e) => setPrepTime(e.target.value)}
                  className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50 font-mono"
                  placeholder="15"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Cook (min)
                </label>
                <input
                  type="number"
                  min="0"
                  value={cookTime}
                  onChange={(e) => setCookTime(e.target.value)}
                  className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50 font-mono"
                  placeholder="20"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Servings
                </label>
                <input
                  type="number"
                  min="1"
                  value={servings}
                  onChange={(e) => setServings(e.target.value)}
                  className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50 font-mono"
                  placeholder="4"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Tags (comma separated)
              </label>
              <input
                type="text"
                value={tagsStr}
                onChange={(e) => setTagsStr(e.target.value)}
                className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                placeholder="Snack, Protein Bar, Healthy, Gluten-Free"
              />
            </div>
          </div>

          {/* Ingredients Section */}
          <div className="space-y-3 pt-3 border-t border-white/10">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-emerald-400 uppercase tracking-wider">
                Ingredients ({ingredients.length})
              </label>
              <button
                type="button"
                onClick={handleAddIngredient}
                className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add Ingredient</span>
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {ingredients.map((ing, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={ing.amount || ''}
                    onChange={(e) => handleUpdateIngredient(idx, 'amount', e.target.value)}
                    placeholder="Amt (1/2)"
                    className="w-20 bg-slate-900/80 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/50 font-mono shrink-0"
                  />
                  <input
                    type="text"
                    value={ing.unit || ''}
                    onChange={(e) => handleUpdateIngredient(idx, 'unit', e.target.value)}
                    placeholder="Unit (cup)"
                    className="w-20 bg-slate-900/80 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/50 shrink-0"
                  />
                  <input
                    type="text"
                    value={ing.item}
                    onChange={(e) => handleUpdateIngredient(idx, 'item', e.target.value)}
                    placeholder="Ingredient name (e.g. egg white protein powder)"
                    className="flex-1 bg-slate-900/80 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/50 min-w-0"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveIngredient(idx)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0 cursor-pointer"
                    title="Remove ingredient"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Instructions Section */}
          <div className="space-y-3 pt-3 border-t border-white/10">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-pink-400 uppercase tracking-wider">
                Instructions ({instructions.length})
              </label>
              <button
                type="button"
                onClick={handleAddInstruction}
                className="text-xs font-bold text-pink-400 hover:text-pink-300 flex items-center gap-1 bg-pink-500/10 px-2.5 py-1 rounded-lg border border-pink-500/20 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add Step</span>
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {instructions.map((step, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 text-slate-400 text-xs flex items-center justify-center shrink-0 mt-1 font-mono font-bold">
                    {idx + 1}
                  </span>
                  <textarea
                    rows={2}
                    value={step}
                    onChange={(e) => handleUpdateInstruction(idx, e.target.value)}
                    placeholder={`Step ${idx + 1} directions...`}
                    className="flex-1 bg-slate-900/80 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/50 resize-none min-w-0"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveInstruction(idx)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0 mt-1 cursor-pointer"
                    title="Remove step"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

        </form>
    </Drawer>
  );
};
