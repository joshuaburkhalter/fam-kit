import React, { useState } from 'react';
import { Drawer } from '../ui/Drawer';
import { Tag, Trash2, Plus, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { api } from '../../lib/api';
import type { PantryCategory, InventoryItem } from '../../types';

interface ManagePantryCategoriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: PantryCategory[];
  inventoryItems?: InventoryItem[];
  onCategoryDeleted: (categoryName: string) => void;
  onOpenNewCategory: () => void;
}

const CORE_CATEGORIES = [
  { name: 'Pantry', icon: '🥫', desc: 'Dry goods, canned food, snacks' },
  { name: 'Fridge', icon: '🧊', desc: 'Chilled items, produce, dairy' },
  { name: 'Freezer', icon: '❄️', desc: 'Frozen meats, meals, ice cream' },
];

export const ManagePantryCategoriesModal: React.FC<ManagePantryCategoriesModalProps> = ({
  isOpen,
  onClose,
  categories,
  inventoryItems = [],
  onCategoryDeleted,
  onOpenNewCategory,
}) => {
  const [deletingCategoryName, setDeletingCategoryName] = useState<string | null>(null);

  const getItemCount = (categoryName: string) => {
    return inventoryItems.filter(
      (item) => (item.category || '').toLowerCase() === categoryName.toLowerCase()
    ).length;
  };

  const handleDelete = async (categoryName: string) => {
    const count = getItemCount(categoryName);
    const confirmMessage = count > 0
      ? `Delete custom category "${categoryName}"? The ${count} ${count === 1 ? 'item' : 'items'} in this category will remain in your pantry.`
      : `Delete custom category "${categoryName}"?`;

    if (!confirm(confirmMessage)) return;

    setDeletingCategoryName(categoryName);
    try {
      await api.deletePantryCategory(categoryName);
      onCategoryDeleted(categoryName);
    } catch (err: any) {
      console.error('Failed to delete category:', err);
      // Still propagate optimistic deletion locally
      onCategoryDeleted(categoryName);
    } finally {
      setDeletingCategoryName(null);
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Manage Categories"
      subtitle="Organize or delete custom pantry categories"
      icon={<Tag className="w-5 h-5 text-slate-950" />}
      maxWidth="max-w-md"
      footer={
        <div className="w-full flex items-center justify-between">
          <span className="text-xs text-slate-400">
            {categories.length} {categories.length === 1 ? 'custom category' : 'custom categories'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Quick Add Button */}
        <div>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenNewCategory();
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 text-xs font-bold transition-all shadow-md shadow-emerald-500/20 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add New Category</span>
          </button>
        </div>

        {/* Custom Categories Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Custom Categories
            </h4>
            <span className="text-[10px] text-slate-500">Tap trash to delete</span>
          </div>

          {categories.length === 0 ? (
            <div className="p-6 text-center rounded-2xl bg-slate-900/50 border border-white/5 space-y-2">
              <p className="text-xs text-slate-400 font-medium">No custom categories created yet.</p>
              <p className="text-[11px] text-slate-500">
                You can create categories like Baby, Pet, Baking, or Medicine to organize items.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {categories.map((cat) => {
                const count = getItemCount(cat.name);
                const isDeleting = deletingCategoryName === cat.name;

                return (
                  <div
                    key={cat.id || cat.name}
                    className="flex items-center justify-between p-3 rounded-2xl bg-slate-900/80 border border-white/10 hover:border-white/20 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-lg shrink-0">
                        {cat.icon || '🏷️'}
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-white block truncate">
                          {cat.name}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          {count} {count === 1 ? 'item' : 'items'}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => handleDelete(cat.name)}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer border border-transparent hover:border-rose-500/20 shrink-0"
                      title={`Delete "${cat.name}" category`}
                    >
                      {isDeleting ? (
                        <Loader2 className="w-4 h-4 animate-spin text-rose-400" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Default Core Categories */}
        <div className="space-y-2 pt-2 border-t border-white/10">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Default Core Locations
          </h4>
          <div className="space-y-1.5">
            {CORE_CATEGORIES.map((core) => {
              const count = inventoryItems.filter(
                (i) => i.location === core.name.toLowerCase() || (i.category || '').toLowerCase() === core.name.toLowerCase()
              ).length;

              return (
                <div
                  key={core.name}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/40 border border-white/5"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-base shrink-0">{core.icon}</span>
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-slate-200 block">
                        {core.name}
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        {core.desc}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/5 text-slate-400 border border-white/5 shrink-0">
                    {count} items
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Drawer>
  );
};
