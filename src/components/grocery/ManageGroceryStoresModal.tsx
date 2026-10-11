import React, { useState } from 'react';
import { Drawer } from '../ui/Drawer';
import { Store, Trash2, Plus, Loader2, Star } from 'lucide-react';
import { api } from '../../lib/api';
import type { GroceryStore, GroceryItem } from '../../types';

interface ManageGroceryStoresModalProps {
  isOpen: boolean;
  onClose: () => void;
  stores: GroceryStore[];
  items?: GroceryItem[];
  onStoreUpdated: (store: GroceryStore) => void;
  onStoreDeleted: (storeId: string) => void;
  onOpenNewStore: () => void;
}

export const ManageGroceryStoresModal: React.FC<ManageGroceryStoresModalProps> = ({
  isOpen,
  onClose,
  stores,
  items = [],
  onStoreUpdated,
  onStoreDeleted,
  onOpenNewStore,
}) => {
  const [deletingStoreId, setDeletingStoreId] = useState<string | null>(null);
  const [updatingDefaultId, setUpdatingDefaultId] = useState<string | null>(null);

  const getStoreItemCount = (store: GroceryStore) => {
    return items.filter((it) => {
      if (store.is_default) {
        return it.store_id === store.id || !it.store_id || (it.store && it.store.toLowerCase() === store.name.toLowerCase());
      }
      return it.store_id === store.id || (it.store && it.store.toLowerCase() === store.name.toLowerCase());
    }).length;
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
      <div className="space-y-5">
        {/* Quick Add Button */}
        <div>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenNewStore();
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 text-xs font-bold transition-all shadow-md shadow-emerald-500/20 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add New Store</span>
          </button>
        </div>

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
