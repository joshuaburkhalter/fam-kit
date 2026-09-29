import React, { useState, useEffect } from 'react';
import { Drawer } from '../ui/Drawer';
import { Trash2, ShoppingCart, Loader2, Sparkles, Package, Check, Plus, X } from 'lucide-react';
import { api } from '../../lib/api';
import { getFreshnessBadge, getDaysUntilExpiry } from '../../lib/shelfLife';
import type { InventoryItem, PantryLocation, PantryCategory } from '../../types';

interface EditInventoryModalProps {
  isOpen: boolean;
  item: InventoryItem | null;
  isInGrocery?: boolean;
  customCategories?: string[];
  onCustomCategoriesChange?: (categories: string[]) => void;
  onClose: () => void;
  onSaved: (item: InventoryItem) => void;
  onDeleted?: (id: string) => void;
  onToggleRestock?: (item: InventoryItem) => void;
}

export const DEFAULT_PANTRY_CATEGORIES = [
  'Produce',
  'Dairy & Eggs',
  'Meat & Seafood',
  'Bakery',
  'Pantry',
  'Frozen',
  'Beverages',
  'Snacks',
  'Condiments & Spices',
  'Other',
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

  // Custom categories state
  const [customCategories, setCustomCategories] = useState<string[]>(() => {
    if (propCustomCategories && propCustomCategories.length > 0) return propCustomCategories;
    try {
      const saved = localStorage.getItem('famkit_custom_pantry_categories');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  useEffect(() => {
    if (propCustomCategories && propCustomCategories.length > 0) {
      setCustomCategories((prev) => Array.from(new Set([...prev, ...propCustomCategories])));
    }
  }, [propCustomCategories]);

  useEffect(() => {
    if (isOpen) {
      api.getPantryCategories()
        .then((res) => {
          const names = (res.customCategories || []).map((c: PantryCategory) => c.name);
          const used = (res.usedCategories || []).filter((u: string) => !DEFAULT_PANTRY_CATEGORIES.includes(u));
          setCustomCategories((prev) => {
            const merged = Array.from(new Set([...prev, ...names, ...used]));
            try {
              localStorage.setItem('famkit_custom_pantry_categories', JSON.stringify(merged));
            } catch {}
            if (onCustomCategoriesChange) onCustomCategoriesChange(merged);
            return merged;
          });
        })
        .catch(() => {});
    }
  }, [isOpen]);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setCategory(item.category || 'Pantry');
      setLocation(item.location || 'pantry');
      setQuantity(item.quantity || '1');
      setExpiresAt(item.expiresAt ? item.expiresAt.split('T')[0] : '');
      setIsStock(Boolean(item.isStock));
      setRestockCadenceDays(item.restockCadenceDays || 14);
      setRestockedSuccess(false);
      setIsAddingCustom(false);
      setNewCategoryName('');
      setCategoryError(null);
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
      setIsAddingCustom(false);
      setNewCategoryName('');
      setCategoryError(null);
    }
  }, [item, isOpen]);

  const handleCreateCustomCategory = async () => {
    const raw = newCategoryName.trim();
    if (!raw) return;

    const formatted = raw.length > 1
      ? raw.charAt(0).toUpperCase() + raw.slice(1)
      : raw.toUpperCase();

    // Check if it already exists
    const matchedDefault = DEFAULT_PANTRY_CATEGORIES.find((c) => c.toLowerCase() === formatted.toLowerCase());
    if (matchedDefault) {
      setCategory(matchedDefault);
      setIsAddingCustom(false);
      setNewCategoryName('');
      setCategoryError(null);
      return;
    }

    const matchedCustom = customCategories.find((c) => c.toLowerCase() === formatted.toLowerCase());
    if (matchedCustom) {
      setCategory(matchedCustom);
      setIsAddingCustom(false);
      setNewCategoryName('');
      setCategoryError(null);
      return;
    }

    setIsSavingCategory(true);
    setCategoryError(null);
    try {
      const nextCustom = [...customCategories, formatted];
      setCustomCategories(nextCustom);
      setCategory(formatted);
      try {
        localStorage.setItem('famkit_custom_pantry_categories', JSON.stringify(nextCustom));
      } catch {}
      if (onCustomCategoriesChange) onCustomCategoriesChange(nextCustom);

      await api.addPantryCategory({ name: formatted });
      setIsAddingCustom(false);
      setNewCategoryName('');
    } catch (err: any) {
      console.warn('Saved category locally:', err);
      setIsAddingCustom(false);
      setNewCategoryName('');
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (catToDelete: string) => {
    if (!confirm(`Delete custom category "${catToDelete}"? Existing pantry items will not be deleted.`)) return;
    const nextCustom = customCategories.filter((c) => c !== catToDelete);
    setCustomCategories(nextCustom);
    if (category === catToDelete) {
      setCategory('Pantry');
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
    try {
      if (item) {
        const updated = await api.updateInventoryItem(item.id, {
          name: name.trim(),
          category,
          location,
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
          location,
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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Storage Location
            </label>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value as PantryLocation)}
              className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="fridge">🧊 Fridge</option>
              <option value="freezer">❄️ Freezer</option>
              <option value="pantry">🥫 Pantry</option>
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-300">
                Category
              </label>
              {!isAddingCustom && (
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingCustom(true);
                    setCategoryError(null);
                  }}
                  className="text-[10px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-0.5 cursor-pointer"
                  title="Add custom category"
                >
                  <Plus className="w-2.5 h-2.5 stroke-[2.5]" />
                  <span>New</span>
                </button>
              )}
            </div>
            <select
              value={category}
              onChange={(e) => {
                if (e.target.value === '__ADD_NEW__') {
                  setIsAddingCustom(true);
                  setCategoryError(null);
                } else {
                  setCategory(e.target.value);
                  setIsAddingCustom(false);
                }
              }}
              className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <optgroup label="Standard Categories">
                {DEFAULT_PANTRY_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </optgroup>
              {customCategories.length > 0 && (
                <optgroup label="Custom Categories">
                  {customCategories.map((c) => (
                    <option key={c} value={c}>
                      ⭐ {c}
                    </option>
                  ))}
                </optgroup>
              )}
              {item &&
                item.category &&
                !DEFAULT_PANTRY_CATEGORIES.includes(item.category) &&
                !customCategories.includes(item.category) && (
                  <optgroup label="Item Category">
                    <option value={item.category}>{item.category}</option>
                  </optgroup>
                )}
              <option value="__ADD_NEW__">✨ + Add Category...</option>
            </select>
          </div>
        </div>

        {/* Custom Category Inline Creator */}
        {isAddingCustom && (
          <div className="p-2.5 bg-slate-900/95 border border-emerald-500/40 rounded-xl space-y-1.5 animate-in fade-in duration-150 shadow-lg">
            <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-300">
              <span>Create New Pantry Category</span>
              <button
                type="button"
                onClick={() => {
                  setIsAddingCustom(false);
                  setNewCategoryName('');
                  setCategoryError(null);
                }}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCreateCustomCategory();
                  } else if (e.key === 'Escape') {
                    setIsAddingCustom(false);
                  }
                }}
                placeholder="Enter any category name..."
                autoFocus
                className="flex-1 px-3 py-1.5 bg-slate-950 border border-white/15 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500 placeholder-slate-500"
              />
              <button
                type="button"
                onClick={handleCreateCustomCategory}
                disabled={!newCategoryName.trim() || isSavingCategory}
                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 shrink-0"
              >
                {isSavingCategory ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Add'}
              </button>
            </div>
          </div>
        )}

        {/* Delete current custom category option */}
        {customCategories.includes(category) && !isAddingCustom && (
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
  );
};
