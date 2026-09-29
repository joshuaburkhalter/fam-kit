import React, { useState } from 'react';
import { Drawer } from '../ui/Drawer';
import { FolderPlus, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';
import type { RecipeCategory } from '../../types';

interface NewRecipeCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCategoryCreated: (category: RecipeCategory) => void;
  onOpenManage?: () => void;
}

const RECIPE_CATEGORY_EMOJIS = [
  '🍽️', '🥞', '🥪', '🍲', '🍰', '🥨', '🍳', '🥗', '🍕', '🥩', '🌮', '🍝', '🍜', '🥘', '🥑', '🍣', '🍦', '☕', '🧁', '🍪', '🍹', '🥣', '🏷️', '🍔', '🍞', '🍗', '🥔', '🧀', '🍓', '🥕'
];

export const CORE_RECIPE_CATEGORY_NAMES = ['breakfast', 'lunch', 'dinner', 'dessert', 'snacks'];

export const NewRecipeCategoryModal: React.FC<NewRecipeCategoryModalProps> = ({
  isOpen,
  onClose,
  onCategoryCreated,
  onOpenManage,
}) => {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🍽️');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) return;

    // Disallow overriding the default core categories
    if (CORE_RECIPE_CATEGORY_NAMES.includes(cleanName.toLowerCase())) {
      setError(`"${cleanName}" is already a default recipe category.`);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const formattedName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
    const categoryObj: RecipeCategory = {
      id: `rcat_${Date.now()}`,
      name: formattedName,
      icon,
    };

    try {
      const created = await api.addRecipeCategory({ name: formattedName, icon });
      onCategoryCreated(created || categoryObj);
      setName('');
      setIcon('🍽️');
      onClose();
    } catch (err: any) {
      // Even if network blips, accept and propagate optimistic category
      onCategoryCreated(categoryObj);
      setName('');
      setIcon('🍽️');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="New Category"
      subtitle="Organize recipes in your collection just like in lists"
      icon={<FolderPlus className="w-5 h-5 text-slate-950" />}
      maxWidth="max-w-md"
      footer={
        <div className="w-full flex items-center justify-between gap-2">
          {onOpenManage ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenManage();
              }}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer underline"
            >
              Manage categories
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="create-recipe-category-form"
              disabled={!name.trim() || isSubmitting}
              className="min-h-[40px] bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold px-5 py-2 rounded-xl text-xs shadow-md shadow-emerald-500/20 cursor-pointer flex items-center gap-1.5 transition-all"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{isSubmitting ? 'Creating...' : 'Create Category'}</span>
            </button>
          </div>
        </div>
      }
    >
      <form id="create-recipe-category-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            Category Name
          </label>
          <input
            type="text"
            required
            autoFocus
            placeholder="e.g. Baking, Quick & Easy, Healthy, Grill, Drinks..."
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
          {error && <p className="text-xs text-rose-400 mt-1.5">{error}</p>}
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            Icon / Emoji
          </label>
          <div className="flex flex-wrap gap-2 pt-1">
            {RECIPE_CATEGORY_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setIcon(emoji)}
                className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center border transition-all cursor-pointer ${
                  icon === emoji
                    ? 'border-emerald-500 bg-emerald-500/20 shadow-sm scale-105'
                    : 'border-white/10 bg-slate-950/60 hover:border-white/20'
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </form>
    </Drawer>
  );
};
