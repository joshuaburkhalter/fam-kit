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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-100"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-white/10 flex flex-col max-h-[90vh]"
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

        {/* Add New Aisle Input */}
        <form onSubmit={handleAddAisle} className="py-4 border-b border-white/10 space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="e.g. Produce, Deli, Bakery, Snacks..."
              value={newAisleName}
              onChange={(e) => setNewAisleName(e.target.value)}
              className="flex-1 bg-slate-900/80 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={!newAisleName.trim() || isSaving}
              className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-lg shadow-emerald-500/20"
            >
              <Plus className="w-4 h-4" />
              Add Aisle
            </button>
          </div>

          {/* Color Picker presets */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <Palette className="w-3.5 h-3.5 text-slate-400 mr-1 shrink-0" />
            <span className="text-[11px] text-slate-400 mr-2 shrink-0">Aisle Accent:</span>
            {PRESET_COLORS.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setNewAisleColor(c)}
                style={{ backgroundColor: c }}
                className={`w-5 h-5 rounded-full transition-transform shrink-0 ${
                  newAisleColor === c ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-slate-900' : 'opacity-70 hover:opacity-100'
                }`}
              />
            ))}
          </div>
        </form>

        {/* Aisles List with Move Up/Down Controls */}
        <div className="flex-1 overflow-y-auto py-3 space-y-2 pr-1">
          {aisles.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">No store aisles configured yet.</div>
          ) : (
            aisles.map((aisle, index) => (
              <div
                key={aisle.id}
                className="flex items-center justify-between p-3 rounded-2xl bg-slate-900/60 border border-white/5 hover:border-white/10 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 text-center text-xs font-mono font-bold text-slate-500">
                    {index + 1}
                  </span>
                  <div
                    className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                    style={{ backgroundColor: aisle.color || '#10b981' }}
                  />
                  <span className="text-sm font-semibold text-slate-200">
                    {aisle.name}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  {/* Up Button */}
                  <button
                    onClick={() => moveAisle(index, 'up')}
                    disabled={index === 0 || isSaving}
                    title="Move Up"
                    className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 disabled:opacity-30 text-slate-300 transition-colors"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>

                  {/* Down Button */}
                  <button
                    onClick={() => moveAisle(index, 'down')}
                    disabled={index === aisles.length - 1 || isSaving}
                    title="Move Down"
                    className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 disabled:opacity-30 text-slate-300 transition-colors"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>

                  {/* Delete Button */}
                  <button
                    onClick={() => handleDeleteAisle(aisle.id, aisle.name)}
                    disabled={isSaving}
                    title="Delete Aisle"
                    className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 ml-1 transition-colors"
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
