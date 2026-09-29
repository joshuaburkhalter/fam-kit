import React, { useState, useEffect } from 'react';
import { Drawer } from '../ui/Drawer';
import { Trash2, ShoppingCart, Loader2, Sparkles, Package, Check, Plus } from 'lucide-react';
import { api } from '../../lib/api';
import { getFreshnessBadge, getDaysUntilExpiry } from '../../lib/shelfLife';
import type { InventoryItem, PantryLocation, PantryCategory } from '../../types';
import { NewPantryCategoryModal } from './NewPantryCategoryModal';
import { ManagePantryCategoriesModal } from './ManagePantryCategoriesModal';

interface EditInventoryModalProps {
  isOpen: boolean;
  item: InventoryItem | null;
  isInGrocery?: boolean;
  customCategories?: PantryCategory[];
  onCustomCategoriesChange?: (categories: PantryCategory[]) => void;
  onClose: () => void;
  onSaved: (item: InventoryItem) => void;
  onDeleted?: (id: string) => void;
  onToggleRestock?: (item: InventoryItem) => void;
}

export const DEFAULT_PANTRY_CATEGORIES: Array<{ name: string; icon: string }> = [
  { name: 'Pantry', icon: '🥫' },
  { name: 'Fridge', icon: '🧊' },
  { name: 'Freezer', icon: '❄️' },
];

export const EditInventoryModal: React.FC<EditInventoryModalProps> = ({
  isOpen,
  item,
  isInGrocery = false,
  customCategories: propCustomCategories,
  onCustomCategoriesChange,
  onClose,
  onSaved,
  onDeleted,
  onToggleRestock,
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Pantry');
  const [location, setLocation] = useState<PantryLocation>('pantry');
  const [quantity, setQuantity] = useState('1');
  const [expiresAt, setExpiresAt] = useState('');
  const [isStock, setIsStock] = useState(false);
  const [restockCadenceDays, setRestockCadenceDays] = useState(14);
  const [isSaving, setIsSaving] = useState(false);
  const [isRestocking, setIsRestocking] = useState(false);
  const [restockedSuccess, setRestockedSuccess] = useState(false);
  const [isNewCategoryModalOpen, setIsNewCategoryModalOpen] = useState(false);
  const [isManageCategoriesModalOpen, setIsManageCategoriesModalOpen] = useState(false);

  // Custom categories state
  const [customCategories, setCustomCategories] = useState<PantryCategory[]>(() => {
    if (propCustomCategories && propCustomCategories.length > 0) return propCustomCategories;
    try {
      const saved = localStorage.getItem('famkit_custom_pantry_categories');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (propCustomCategories) {
      setCustomCategories(propCustomCategories);
    }
  }, [propCustomCategories]);

  useEffect(() => {
    if (isOpen) {
      api.getPantryCategories()
        .then((res) => {
          const cats = res.customCategories || [];
          setCustomCategories(cats);
          try {
            localStorage.setItem('famkit_custom_pantry_categories', JSON.stringify(cats));
          } catch {}
          if (onCustomCategoriesChange) onCustomCategoriesChange(cats);
        })
        .catch(() => {});
    }
  }, [isOpen]);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setCategory(item.category || (item.location ? item.location.charAt(0).toUpperCase() + item.location.slice(1) : 'Pantry'));
      setLocation(item.location || 'pantry');
      setQuantity(item.quantity || '1');
      setExpiresAt(item.expiresAt ? item.expiresAt.split('T')[0] : '');
      setIsStock(Boolean(item.isStock));
      setRestockCadenceDays(item.restockCadenceDays || 14);
      setRestockedSuccess(false);
    } else {
      setName('');
      setCategory('Pantry');
      setLocation('pantry');
      setQuantity('1');
      const defaultExp = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
      setExpiresAt(defaultExp);
      setIsStock(false);
      setRestockCadenceDays(14);
      setRestockedSuccess(false);
    }
  }, [item, isOpen]);

  const handleCategoryCreated = (newCat: PantryCategory) => {
    const updated = [...customCategories.filter((c) => c.name.toLowerCase() !== newCat.name.toLowerCase()), newCat];
    setCustomCategories(updated);
    setCategory(newCat.name);
    try {
      localStorage.setItem('famkit_custom_pantry_categories', JSON.stringify(updated));
    } catch {}
    if (onCustomCategoriesChange) onCustomCategoriesChange(updated);
  };

  const handleDeleteCategory = async (catToDelete: string) => {
    if (!confirm(`Delete custom category "${catToDelete}"? Existing pantry items will not be deleted.`)) return;
    const nextCustom = customCategories.filter((c) => c.name !== catToDelete);
    setCustomCategories(nextCustom);
    if (category === catToDelete) {
      setCategory('Pantry');
      setLocation('pantry');
    }
    try {
      localStorage.setItem('famkit_custom_pantry_categories', JSON.stringify(nextCustom));
    } catch {}
    if (onCustomCategoriesChange) onCustomCategoriesChange(nextCustom);
    try {
      await api.deletePantryCategory(catToDelete);
    } catch (err) {
      console.error('Failed to delete category from server', err);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setIsSaving(true);
    const lowerCat = category.toLowerCase();
    const effectiveLocation: PantryLocation =
      lowerCat === 'fridge'
        ? 'fridge'
        : lowerCat === 'freezer'
        ? 'freezer'
        : lowerCat === 'pantry'
        ? 'pantry'
        : location || 'pantry';

    try {
      if (item) {
        const updated = await api.updateInventoryItem(item.id, {
          name: name.trim(),
          category,
          location: effectiveLocation,
          quantity,
          expiresAt,
          isStock,
          restockCadenceDays: isStock ? restockCadenceDays : null,
        });
        onSaved(updated);
      } else {
        const created = await api.addInventoryItem({
          name: name.trim(),
          category,
          location: effectiveLocation,
          quantity,
          expiresAt,
          isStock,
          restockCadenceDays: isStock ? restockCadenceDays : null,
        });
        onSaved(created);
      }
      onClose();
    } catch (e: any) {
      alert(e.message || 'Failed to save item');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!item) return;
    if (!confirm(`Are you sure you want to remove "${item.name}" from your pantry?`)) return;
    try {
      await api.deleteInventoryItem(item.id);
      if (onDeleted) onDeleted(item.id);
      onClose();
    } catch (e: any) {
      alert(e.message || 'Failed to delete item');
    }
  };

  const handleRestockToGrocery = async () => {
    if (!item) return;
    if (onToggleRestock) {
      onToggleRestock(item);
      return;
    }
    setIsRestocking(true);
    try {
      if (isInGrocery) {
        await api.unrestockInventoryItemFromGrocery(item.id);
        setRestockedSuccess(false);
      } else {
        await api.restockInventoryItemToGrocery(item.id);
        setRestockedSuccess(true);
        setTimeout(() => setRestockedSuccess(false), 3000);
      }
    } catch (e: any) {
      alert(e.message || 'Failed to update grocery list');
    } finally {
      setIsRestocking(false);
    }
  };

  const daysUntilExpiry = expiresAt ? getDaysUntilExpiry(expiresAt) : 999;
  const badge = item ? getFreshnessBadge(item.freshness, daysUntilExpiry) : null;

  return (
    <>
      <Drawer
        isOpen={isOpen}
        onClose={onClose}
        title={item ? 'Edit Pantry Item' : 'Add Pantry Item'}
        subtitle={item ? 'Update item details and shelf life' : 'Manually track an item in your pantry'}
        icon={<Package className="w-5 h-5 text-slate-950" />}
        maxWidth="max-w-md"
        badge={
          badge ? (
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${badge.bgColor} ${badge.color} ${badge.borderColor}`}
            >
              {badge.label}
            </span>
          ) : undefined
        }
        footer={
          <div className="w-full flex items-center justify-between gap-2">
            {item ? (
              <button
                type="button"
                onClick={handleDelete}
                className="p-2.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer border border-white/5"
                title="Delete item"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-white/10 text-xs font-semibold text-slate-300 hover:bg-white/5 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!name.trim() || isSaving}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 disabled:opacity-50 text-slate-950 text-xs font-bold transition-all shadow-md shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save Item'}
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Item Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Greek Yogurt, Eggs, Sourdough"
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-300">
                Category
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsManageCategoriesModalOpen(true)}
                  className="text-[10px] text-slate-400 hover:text-slate-300 font-semibold cursor-pointer"
                  title="Manage categories"
                >
                  Manage
                </button>
                <span className="text-slate-600 text-xs">•</span>
                <button
                  type="button"
                  onClick={() => setIsNewCategoryModalOpen(true)}
                  className="text-[10px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-0.5 cursor-pointer"
                  title="Add custom category"
                >
                  <Plus className="w-2.5 h-2.5 stroke-[2.5]" />
                  <span>New</span>
                </button>
              </div>
            </div>
            <select
              value={category}
              onChange={(e) => {
                if (e.target.value === '__ADD_NEW__') {
                  setIsNewCategoryModalOpen(true);
                } else if (e.target.value === '__MANAGE__') {
                  setIsManageCategoriesModalOpen(true);
                } else {
                  const selected = e.target.value;
                  setCategory(selected);
                  if (selected.toLowerCase() === 'fridge') setLocation('fridge');
                  else if (selected.toLowerCase() === 'freezer') setLocation('freezer');
                  else if (selected.toLowerCase() === 'pantry') setLocation('pantry');
                }
              }}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="Pantry">🥫 Pantry</option>
              <option value="Fridge">🧊 Fridge</option>
              <option value="Freezer">❄️ Freezer</option>

              {customCategories.length > 0 && (
                <optgroup label="Custom Categories">
                  {customCategories.map((c) => (
                    <option key={c.id || c.name} value={c.name}>
                      {c.icon || '🏷️'} {c.name}
                    </option>
                  ))}
                </optgroup>
              )}

              {item &&
                item.category &&
                !['Pantry', 'Fridge', 'Freezer'].some((c) => c.toLowerCase() === item.category.toLowerCase()) &&
                !customCategories.some((c) => c.name.toLowerCase() === item.category.toLowerCase()) && (
                  <optgroup label="Other">
                    <option value={item.category}>{item.category}</option>
                  </optgroup>
                )}

              <option value="__MANAGE__" className="text-slate-400 font-medium">
                ⚙️ Manage Categories...
              </option>
              <option value="__ADD_NEW__" className="text-emerald-400 font-bold">
                ✨ + Add Category...
              </option>
            </select>
          </div>

          {/* Delete custom category action if custom category is currently active */}
          {customCategories.some((c) => c.name.toLowerCase() === category.toLowerCase()) && (
            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 -mt-2">
              <span className="text-emerald-400/90 font-medium">Custom category</span>
              <button
                type="button"
                onClick={() => handleDeleteCategory(category)}
                className="text-rose-400 hover:text-rose-300 hover:underline cursor-pointer flex items-center gap-1 text-[10px]"
              >
                <Trash2 className="w-2.5 h-2.5" />
                <span>Delete "{category}"</span>
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Quantity
              </label>
              <input
                type="text"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="e.g. 1 carton, 12 count"
                className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Expiration Date
              </label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Keep In Stock Staple Settings */}
          <div className="p-3 bg-slate-900/60 rounded-xl border border-white/10 space-y-2.5">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  ⭐ Keep in Stock Staple
                </span>
                <p className="text-[11px] text-slate-400">
                  Always keep this item on hand with cadence reminders
                </p>
              </div>
              <input
                type="checkbox"
                checked={isStock}
                onChange={(e) => setIsStock(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 border-white/10 bg-slate-900 cursor-pointer"
              />
            </label>

            {isStock && (
              <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                <span className="text-xs text-slate-300">Check stock every:</span>
                <select
                  value={restockCadenceDays}
                  onChange={(e) => setRestockCadenceDays(parseInt(e.target.value, 10))}
                  className="px-2.5 py-1 bg-slate-900 border border-white/10 rounded-lg text-xs font-semibold text-white cursor-pointer"
                >
                  <option value={7}>7 Days (Weekly)</option>
                  <option value={14}>14 Days (Bi-weekly)</option>
                  <option value={30}>30 Days (Monthly)</option>
                </select>
              </div>
            )}
          </div>

          {/* Quick Restock to Grocery Button (for existing item) */}
          {item && (
            <div className="pt-1">
              <button
                type="button"
                onClick={handleRestockToGrocery}
                disabled={isRestocking}
                className={`w-full py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  isInGrocery
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
                    : restockedSuccess
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                    : 'bg-slate-900 hover:bg-slate-800 border-white/10 text-slate-200'
                }`}
              >
                {isRestocking ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : isInGrocery || restockedSuccess ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
                ) : (
                  <ShoppingCart className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <span>{isInGrocery ? 'In Grocery List (Click to Remove)' : restockedSuccess ? '✓ Added to Grocery List!' : 'Add to Grocery List'}</span>
              </button>
            </div>
          )}
        </div>
      </Drawer>

      {/* New Category Modal (Drawer with Emoji Picker, just like lists) */}
      <NewPantryCategoryModal
        isOpen={isNewCategoryModalOpen}
        onClose={() => setIsNewCategoryModalOpen(false)}
        onCategoryCreated={handleCategoryCreated}
        onOpenManage={() => setIsManageCategoriesModalOpen(true)}
      />

      {/* Manage Categories Modal */}
      <ManagePantryCategoriesModal
        isOpen={isManageCategoriesModalOpen}
        onClose={() => setIsManageCategoriesModalOpen(false)}
        categories={customCategories}
        onCategoryDeleted={(deletedName) => {
          const nextCustom = customCategories.filter(
            (c) => c.name.toLowerCase() !== deletedName.toLowerCase()
          );
          setCustomCategories(nextCustom);
          if (category.toLowerCase() === deletedName.toLowerCase()) {
            setCategory('Pantry');
            setLocation('pantry');
          }
          try {
            localStorage.setItem('famkit_custom_pantry_categories', JSON.stringify(nextCustom));
          } catch {}
          if (onCustomCategoriesChange) onCustomCategoriesChange(nextCustom);
        }}
        onOpenNewCategory={() => setIsNewCategoryModalOpen(true)}
      />
    </>
  );
};
