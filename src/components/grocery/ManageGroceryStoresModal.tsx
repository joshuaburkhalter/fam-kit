import React, { useState } from 'react';
import { Drawer } from '../ui/Drawer';
import { Store, Trash2, Plus, Loader2, Star, X } from 'lucide-react';
import { api } from '../../lib/api';
import type { GroceryStore, GroceryItem } from '../../types';

interface ManageGroceryStoresModalProps {
  isOpen: boolean;
  onClose: () => void;
  householdId: string;
  stores: GroceryStore[];
  items?: GroceryItem[];
  onStoreCreated?: (store: GroceryStore) => void;
  onStoreUpdated: (store: GroceryStore) => void;
  onStoreDeleted: (storeId: string) => void;
  onOpenNewStore?: () => void;
}

const STORE_EMOJIS = [
  '🏪', '🛒', '🏬', '🛍️', '🍎', '🥩', '🥖', '🥕', '🥦', '🧀', '🍷', '💊', '🎯', '📦', '⛽', '🏷️', '🪴', '🐟'
];

const STORE_COLORS = [
  '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#ef4444', '#14b8a6'
];

export const ManageGroceryStoresModal: React.FC<ManageGroceryStoresModalProps> = ({
  isOpen,
  onClose,
  householdId,
  stores,
  items = [],
  onStoreCreated,
  onStoreUpdated,
  onStoreDeleted,
  onOpenNewStore,
}) => {
  const [deletingStoreId, setDeletingStoreId] = useState<string | null>(null);
  const [updatingDefaultId, setUpdatingDefaultId] = useState<string | null>(null);

  // Inline Add Store Form State
  const [isAddingStore, setIsAddingStore] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('🏪');
  const [newColor, setNewColor] = useState('#10b981');
  const [newIsDefault, setNewIsDefault] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const getStoreItemCount = (store: GroceryStore) => {
    return items.filter((it) => {
      if (store.is_default) {
        return it.store_id === store.id || !it.store_id || (it.store && it.store.toLowerCase() === store.name.toLowerCase());
      }
      return it.store_id === store.id || (it.store && it.store.toLowerCase() === store.name.toLowerCase());
    }).length;
  };

  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newName.trim();
    if (!cleanName) return;

    if (stores.some((s) => s.name.toLowerCase() === cleanName.toLowerCase())) {
      setAddError(`A store named "${cleanName}" already exists.`);
      return;
    }

    setIsSubmitting(true);
    setAddError(null);

    const formattedName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
    const optimisticStore: GroceryStore = {
      id: `store_${Date.now()}`,
      household_id: householdId,
      name: formattedName,
      icon: newIcon,
      color: newColor,
      is_default: newIsDefault || stores.length === 0,
      order_index: stores.length,
      created_at: new Date().toISOString(),
    };

    try {
      const created = await api.addGroceryStore(householdId, {
        name: formattedName,
        icon: newIcon,
        color: newColor,
        is_default: newIsDefault,
      });
      onStoreCreated?.(created || optimisticStore);
      setNewName('');
      setNewIcon('🏪');
      setNewColor('#10b981');
      setNewIsDefault(false);
      setIsAddingStore(false);
    } catch (err: any) {
      console.error('Failed to create store:', err);
      onStoreCreated?.(optimisticStore);
      setNewName('');
      setNewIcon('🏪');
      setNewColor('#10b981');
      setNewIsDefault(false);
      setIsAddingStore(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetDefault = async (store: GroceryStore) => {
    if (store.is_default) return;
    setUpdatingDefaultId(store.id);
    try {
      const updated = await api.updateGroceryStore(store.id, { is_default: true });
      onStoreUpdated(updated);
    } catch (err: any) {
      console.error('Failed to set store as default:', err);
      onStoreUpdated({ ...store, is_default: true });
    } finally {
      setUpdatingDefaultId(null);
    }
  };

  const handleDelete = async (store: GroceryStore) => {
    const count = getStoreItemCount(store);
    const confirmMessage = count > 0
      ? `Delete store "${store.name}"? The ${count} ${count === 1 ? 'item' : 'items'} in this store will be moved to your primary store.`
      : `Delete store "${store.name}"?`;

    if (!confirm(confirmMessage)) return;

    setDeletingStoreId(store.id);
    try {
      await api.deleteGroceryStore(store.id);
      onStoreDeleted(store.id);
    } catch (err: any) {
      console.error('Failed to delete store:', err);
      onStoreDeleted(store.id);
    } finally {
      setDeletingStoreId(null);
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Manage Stores"
      subtitle="Organize grocery stores, set defaults, or remove unused stores"
      icon={<Store className="w-5 h-5 text-slate-950" />}
      maxWidth="max-w-md"
      footer={
        <div className="w-full flex items-center justify-between">
          <span className="text-xs text-slate-400">
            {stores.length} {stores.length === 1 ? 'store' : 'stores'} configured
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
      <div className="space-y-4">
        {/* Quick Add Button or Inline Form */}
        {!isAddingStore ? (
          <div>
            <button
              type="button"
              onClick={() => setIsAddingStore(true)}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 text-xs font-bold transition-all shadow-md shadow-emerald-500/20 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add New Store</span>
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleCreateStore}
            className="p-4 rounded-2xl bg-slate-900/90 border border-emerald-500/30 space-y-3.5 shadow-lg animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-emerald-400" />
                <span>Add New Store</span>
              </h4>
              <button
                type="button"
                onClick={() => {
                  setIsAddingStore(false);
                  setAddError(null);
                }}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
                title="Cancel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Store Name
              </label>
              <input
                type="text"
                required
                autoFocus
                placeholder="e.g. Costco, Trader Joe's, Target..."
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  setAddError(null);
                }}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              {addError && <p className="text-xs text-rose-400 mt-1">{addError}</p>}
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Icon / Emoji
              </label>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {STORE_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setNewIcon(emoji)}
                    className={`w-8 h-8 rounded-lg text-base flex items-center justify-center border transition-all cursor-pointer ${
                      newIcon === emoji
                        ? 'border-emerald-500 bg-emerald-500/20 shadow-sm scale-105'
                        : 'border-white/10 bg-slate-950/60 hover:border-white/20'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Color Accent
              </label>
              <div className="flex items-center gap-2 pt-0.5">
                {STORE_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewColor(c)}
                    style={{ backgroundColor: c }}
                    className={`w-6 h-6 rounded-full transition-transform cursor-pointer border-2 ${
                      newColor === c ? 'border-white scale-110 shadow-md' : 'border-transparent hover:scale-105'
                    }`}
                  />
                ))}
              </div>
            </div>

            {stores.length > 0 && (
              <div className="pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newIsDefault}
                    onChange={(e) => setNewIsDefault(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-emerald-500 bg-slate-950 border-white/20 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span className="text-[11px] font-semibold text-white">Make this my primary store</span>
                </label>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1 border-t border-white/5">
              <button
                type="button"
                onClick={() => {
                  setIsAddingStore(false);
                  setAddError(null);
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newName.trim() || isSubmitting}
                className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold px-4 py-1.5 rounded-lg text-xs shadow-md shadow-emerald-500/20 cursor-pointer flex items-center gap-1.5 transition-all"
              >
                {isSubmitting && <Loader2 className="w-3 h-3 animate-spin" />}
                <span>{isSubmitting ? 'Adding...' : 'Add Store'}</span>
              </button>
            </div>
          </form>
        )}

        {/* Stores List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Your Stores
            </h4>
            <span className="text-[10px] text-slate-500">Tap star to make primary</span>
          </div>

          {stores.length === 0 ? (
            <div className="p-6 text-center rounded-2xl bg-slate-900/50 border border-white/5 space-y-2">
              <p className="text-xs text-slate-400 font-medium">No stores added yet.</p>
              <p className="text-[11px] text-slate-500">
                Add stores like Costco, Trader Joe&apos;s, Target, or your local supermarket to split your shopping list.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {stores.map((store) => {
                const count = getStoreItemCount(store);
                const isDeleting = deletingStoreId === store.id;
                const isUpdating = updatingDefaultId === store.id;

                return (
                  <div
                    key={store.id}
                    className="flex items-center justify-between p-3 rounded-2xl bg-slate-900/80 border border-white/10 hover:border-white/20 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-9 h-9 rounded-xl border flex items-center justify-center text-lg shrink-0"
                        style={{
                          backgroundColor: `${store.color || '#10b981'}20`,
                          borderColor: `${store.color || '#10b981'}40`,
                        }}
                      >
                        {store.icon || '🏪'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white block truncate">
                            {store.name}
                          </span>
                          {store.is_default && (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              Primary
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 block">
                          {count} {count === 1 ? 'item' : 'items'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {!store.is_default && (
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => handleSetDefault(store)}
                          className="p-2 rounded-xl text-slate-400 hover:text-amber-400 hover:bg-amber-400/10 transition-colors cursor-pointer border border-transparent hover:border-amber-400/20"
                          title="Make primary store"
                        >
                          {isUpdating ? (
                            <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                          ) : (
                            <Star className="w-4 h-4" />
                          )}
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={() => handleDelete(store)}
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer border border-transparent hover:border-rose-500/20"
                        title={`Delete "${store.name}" store`}
                      >
                        {isDeleting ? (
                          <Loader2 className="w-4 h-4 animate-spin text-rose-400" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
};
