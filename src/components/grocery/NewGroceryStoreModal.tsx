import React, { useState } from 'react';
import { Drawer } from '../ui/Drawer';
import { Store, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';
import type { GroceryStore } from '../../types';

interface NewGroceryStoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  householdId: string;
  existingStores: GroceryStore[];
  onStoreCreated: (store: GroceryStore) => void;
  onOpenManage?: () => void;
}

const STORE_EMOJIS = [
  '🏪', '🛒', '🏬', '🛍️', '🍎', '🥩', '🥖', '🥕', '🥦', '🧀', '🍷', '💊', '🎯', '📦', '⛽', '🏷️', '🪴', '🐟'
];

const STORE_COLORS = [
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#14b8a6', // Teal
];

export const NewGroceryStoreModal: React.FC<NewGroceryStoreModalProps> = ({
  isOpen,
  onClose,
  householdId,
  existingStores,
  onStoreCreated,
  onOpenManage,
}) => {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🏪');
  const [color, setColor] = useState('#10b981');
  const [isDefault, setIsDefault] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) return;

    // Check if store with same name already exists
    if (existingStores.some((s) => s.name.toLowerCase() === cleanName.toLowerCase())) {
      setError(`A store named "${cleanName}" already exists.`);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const formattedName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
    const optimisticStore: GroceryStore = {
      id: `store_${Date.now()}`,
      household_id: householdId,
      name: formattedName,
      icon,
      color,
      is_default: isDefault || existingStores.length === 0,
      order_index: existingStores.length,
      created_at: new Date().toISOString(),
    };

    try {
      const created = await api.addGroceryStore(householdId, {
        name: formattedName,
        icon,
        color,
        is_default: isDefault,
      });
      onStoreCreated(created || optimisticStore);
      setName('');
      setIcon('🏪');
      setColor('#10b981');
      setIsDefault(false);
      onClose();
    } catch (err: any) {
      console.error('Failed to create store:', err);
      // Fallback to optimistic
      onStoreCreated(optimisticStore);
      setName('');
      setIcon('🏪');
      setColor('#10b981');
      setIsDefault(false);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Add Store"
      subtitle="Shop across multiple stores like Costco, Trader Joe's, or local shops"
      icon={<Store className="w-5 h-5 text-slate-950" />}
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
              Manage stores
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
              form="create-grocery-store-form"
              disabled={!name.trim() || isSubmitting}
              className="min-h-[40px] bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold px-5 py-2 rounded-xl text-xs shadow-md shadow-emerald-500/20 cursor-pointer flex items-center gap-1.5 transition-all"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{isSubmitting ? 'Adding...' : 'Add Store'}</span>
            </button>
          </div>
        </div>
      }
    >
      <form id="create-grocery-store-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            Store Name
          </label>
          <input
            type="text"
            required
            autoFocus
            placeholder="e.g. Costco, Trader Joe's, Target, Local Market..."
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
            {STORE_EMOJIS.map((emoji) => (
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

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            Color Accent
          </label>
          <div className="flex items-center gap-2 pt-1">
            {STORE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                style={{ backgroundColor: c }}
                className={`w-7 h-7 rounded-full transition-transform cursor-pointer border-2 ${
                  color === c ? 'border-white scale-110 shadow-md' : 'border-transparent hover:scale-105'
                }`}
              />
            ))}
          </div>
        </div>

        {existingStores.length > 0 && (
          <div className="pt-2">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-500 bg-slate-950 border-white/20 focus:ring-emerald-500 cursor-pointer"
              />
              <div>
                <span className="text-xs font-semibold text-white block">Make this my primary store</span>
                <span className="text-[10px] text-slate-400 block">
                  New unassigned grocery items will default to this store
                </span>
              </div>
            </label>
          </div>
        )}
      </form>
    </Drawer>
  );
};
