import React, { useState, useEffect } from 'react';
import {
  X,
  ArrowUp,
  ArrowDown,
  Plus,
  Trash2,
  MoveVertical,
  Palette,
} from 'lucide-react';
import type { Aisle } from '../types';
import { api } from '../lib/api';

interface AisleManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  householdId: string;
  initialAisles?: Aisle[];
  onAislesUpdated: () => void;
}

const PRESET_COLORS = [
  '#10b981', // Emerald
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#8b5cf6', // Purple
  '#06b6d4', // Cyan
  '#84cc16', // Lime
  '#64748b', // Slate
];

export const AisleManagerModal: React.FC<AisleManagerModalProps> = ({
  isOpen,
  onClose,
  householdId,
  initialAisles = [],
  onAislesUpdated,
}) => {
  const [aisles, setAisles] = useState<Aisle[]>(initialAisles);
  const [newAisleName, setNewAisleName] = useState('');
  const [newAisleColor, setNewAisleColor] = useState(PRESET_COLORS[0]);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const loadAisles = async () => {
    if (!householdId) return;
    try {
      const data = await api.getAisles(householdId);
      setAisles(data);
    } catch (err) {
      console.error('Failed to load aisles:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (initialAisles && initialAisles.length > 0) {
        setAisles(initialAisles);
      }
      loadAisles();
    }
  }, [isOpen, householdId, initialAisles]);

  if (!isOpen) return null;

  const moveAisle = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= aisles.length) return;

    const newAisles = [...aisles];
    const [moved] = newAisles.splice(index, 1);
    newAisles.splice(targetIndex, 0, moved);

    setAisles(newAisles);

    // Save reorder to backend
    try {
      setIsSaving(true);
      await api.reorderAisles(
        householdId,
        newAisles.map((a) => a.id)
      );
      onAislesUpdated();
    } catch (err) {
      console.error('Failed to save reorder:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddAisle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAisleName.trim()) return;

    try {
      setIsSaving(true);
      await api.createAisle(householdId, newAisleName.trim(), newAisleColor);
      setNewAisleName('');
      await loadAisles();
      onAislesUpdated();
    } catch (err) {
      console.error('Failed to add aisle:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAisle = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete aisle "${name}"? Items in this aisle will move to Uncategorized.`)) {
      try {
        setIsSaving(true);
        await api.deleteAisle(id);
        await loadAisles();
        onAislesUpdated();
      } catch (err) {
        console.error('Failed to delete aisle:', err);
      } finally {
        setIsSaving(false);
      }
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-100"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel w-full max-w-lg rounded-3xl p-5 sm:p-6 shadow-2xl border border-white/10 flex flex-col max-h-[82vh] sm:max-h-[88vh] my-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <MoveVertical className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Rearrange Store Aisles</h2>
              <p className="text-xs text-slate-400">
                Order aisles to match your local grocery store layout
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Add New Aisle - Sleek Integrated Bar */}
        <form onSubmit={handleAddAisle} className="py-3 border-b border-white/10 relative">
          <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-900/80 border border-white/10 focus-within:border-emerald-500/50 transition-all">
            {/* Clickable Color Swatch */}
            <div className="relative pl-1.5">
              <button
                type="button"
                onClick={() => setShowColorPicker(!showColorPicker)}
                style={{ backgroundColor: newAisleColor }}
                className="w-5 h-5 rounded-full ring-2 ring-white/20 hover:ring-white/50 transition-all cursor-pointer block"
                title="Choose color accent"
              />

              {/* Color Picker Popover */}
              {showColorPicker && (
                <div className="absolute top-full left-0 mt-2 z-30 p-2.5 rounded-2xl bg-slate-900 border border-white/15 shadow-2xl flex items-center gap-1.5 animate-in fade-in zoom-in-95">
                  {PRESET_COLORS.map((c) => (
                    <button
                      type="button"
                      key={c}
                      onClick={() => {
                        setNewAisleColor(c);
                        setShowColorPicker(false);
                      }}
                      style={{ backgroundColor: c }}
                      className={`w-5 h-5 rounded-full transition-transform ${
                        newAisleColor === c ? 'scale-125 ring-2 ring-white' : 'opacity-70 hover:opacity-100'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>

            <input
              type="text"
              placeholder="Add store aisle (e.g. Produce, Deli, Bakery)..."
              value={newAisleName}
              onChange={(e) => setNewAisleName(e.target.value)}
              className="flex-1 min-w-0 bg-transparent border-none text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none px-1.5"
            />

            <button
              type="submit"
              disabled={!newAisleName.trim() || isSaving}
              className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all shadow-md shadow-emerald-500/20 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </div>
        </form>

        {/* Aisles List with Clean Controls */}
        <div className="flex-1 overflow-y-auto py-3 space-y-1.5 pr-1">
          {aisles.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">No store aisles configured yet.</div>
          ) : (
            aisles.map((aisle, index) => (
              <div
                key={aisle.id}
                className="flex items-center justify-between p-2.5 sm:p-3 rounded-2xl bg-slate-900/40 hover:bg-slate-900/70 border border-white/5 transition-colors group"
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  <span className="w-5 text-center text-xs font-mono font-medium text-slate-500 shrink-0">
                    {index + 1}
                  </span>
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                    style={{ backgroundColor: aisle.color || '#10b981' }}
                  />
                  <span className="text-xs sm:text-sm font-semibold text-slate-200 truncate">
                    {aisle.name}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {/* Unified Reorder Control Pill */}
                  <div className="flex items-center bg-slate-800/80 rounded-xl border border-white/5 p-0.5">
                    <button
                      onClick={() => moveAisle(index, 'up')}
                      disabled={index === 0 || isSaving}
                      title="Move Up"
                      className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-20 text-slate-300 hover:text-white transition-colors"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <div className="w-[1px] h-3 bg-white/10" />
                    <button
                      onClick={() => moveAisle(index, 'down')}
                      disabled={index === aisles.length - 1 || isSaving}
                      title="Move Down"
                      className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-20 text-slate-300 hover:text-white transition-colors"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Delete Button */}
                  <button
                    onClick={() => handleDeleteAisle(aisle.id, aisle.name)}
                    disabled={isSaving}
                    title="Delete Aisle"
                    className="p-1.5 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors ml-0.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-white/10 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            {isSaving ? 'Saving changes...' : `${aisles.length} aisles arranged`}
          </span>
          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-white px-5 py-2 rounded-xl text-xs font-semibold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
