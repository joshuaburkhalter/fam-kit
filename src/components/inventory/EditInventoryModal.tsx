import React, { useState, useEffect } from 'react';
import { X, Trash2, ShoppingCart, Loader2, Sparkles } from 'lucide-react';
import { api } from '../../lib/api';
import { getFreshnessBadge, getDaysUntilExpiry } from '../../lib/shelfLife';
import type { InventoryItem, PantryLocation } from '../../types';

interface EditInventoryModalProps {
  isOpen: boolean;
  item: InventoryItem | null;
  onClose: () => void;
  onSaved: (item: InventoryItem) => void;
  onDeleted?: (id: string) => void;
}

const CATEGORIES = [
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
  onClose,
  onSaved,
  onDeleted,
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

  if (!isOpen) return null;

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
    setIsRestocking(true);
    try {
      await api.restockInventoryItemToGrocery(item.id);
      setRestockedSuccess(true);
      setTimeout(() => setRestockedSuccess(false), 3000);
    } catch (e: any) {
      alert(e.message || 'Failed to add item to grocery list');
    } finally {
      setIsRestocking(false);
    }
  };

  const daysUntilExpiry = expiresAt ? getDaysUntilExpiry(expiresAt) : 999;
  const badge = item ? getFreshnessBadge(item.freshness, daysUntilExpiry) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {item ? 'Edit Pantry Item' : 'Add Pantry Item'}
            </h3>
            {badge && (
              <span
                className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${badge.bgColor} ${badge.color} ${badge.borderColor}`}
              >
                {badge.label}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Item Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Greek Yogurt, Eggs, Sourdough"
              className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Storage Location
              </label>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value as PantryLocation)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="fridge">🧊 Fridge</option>
                <option value="freezer">❄️ Freezer</option>
                <option value="pantry">🥫 Pantry</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Quantity
              </label>
              <input
                type="text"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="e.g. 1 carton, 12 count"
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Expiration Date
                </label>
              </div>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Keep In Stock Staple Settings */}
          <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-2.5">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  ⭐ Keep in Stock Staple
                </span>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Always keep this item on hand with cadence reminders
                </p>
              </div>
              <input
                type="checkbox"
                checked={isStock}
                onChange={(e) => setIsStock(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-zinc-300 dark:border-zinc-700"
              />
            </label>

            {isStock && (
              <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700/60 flex items-center justify-between">
                <span className="text-xs text-zinc-600 dark:text-zinc-300">Check stock every:</span>
                <select
                  value={restockCadenceDays}
                  onChange={(e) => setRestockCadenceDays(parseInt(e.target.value, 10))}
                  className="px-2.5 py-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-medium text-zinc-900 dark:text-zinc-100"
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
                className={`w-full py-2 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-2 transition-all ${
                  restockedSuccess
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300'
                    : 'bg-zinc-50 dark:bg-zinc-800/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200'
                }`}
              >
                {isRestocking ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ShoppingCart className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                )}
                <span>{restockedSuccess ? '✓ Added to Grocery List!' : 'Add to Grocery List'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
          {item ? (
            <button
              type="button"
              onClick={handleDelete}
              className="p-2 text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors"
              title="Delete item"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          ) : (
            <div />
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!name.trim() || isSaving}
              className="py-2 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-medium transition-colors flex items-center gap-1.5 shadow-sm"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save Item'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
