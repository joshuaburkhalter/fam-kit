import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Search,
  Sliders,
  Check,
  CheckSquare,
  Square,
  Lock,
  Lightbulb,
  Power,
  Zap,
  Thermometer,
  Shield,
  Activity,
  Sparkles,
  SlidersHorizontal,
} from 'lucide-react';
import { HomeAssistantEntity } from '../../types';

interface ManageControlsModalProps {
  isOpen: boolean;
  onClose: () => void;
  allEntities: HomeAssistantEntity[];
  initialVisibleIds: string[];
  onSave: (visibleIds: string[]) => Promise<void>;
}

export const ManageControlsModal: React.FC<ManageControlsModalProps> = ({
  isOpen,
  onClose,
  allEntities,
  initialVisibleIds,
  onSave,
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(initialVisibleIds));
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set(initialVisibleIds));
      setSearchQuery('');
      setActiveCategory('all');
    }
  }, [isOpen, initialVisibleIds]);

  // Helper to detect access-related entities (doors, locks, gates, intercom relays)
  const isAccessEntity = (e: HomeAssistantEntity) => {
    if (e.domain === 'lock' || e.domain === 'cover') return true;
    const s = (e.entity_id + ' ' + e.friendly_name).toLowerCase();
    return (
      (e.domain === 'button' || e.domain === 'input_button' || e.domain === 'switch') &&
      (s.includes('door') || s.includes('gate') || s.includes('lock') || s.includes('relay') || s.includes('verso') || s.includes('intercom') || s.includes('strike'))
    );
  };

  // Category counts and pills
  const categories = useMemo(() => {
    const cats = [
      { id: 'all', label: 'All', count: allEntities.length },
      { id: 'selected', label: 'Selected', count: selectedIds.size },
      { id: 'access', label: 'Locks & Entry', count: allEntities.filter(isAccessEntity).length },
      { id: 'lights', label: 'Lights', count: allEntities.filter((e) => e.domain === 'light').length },
      { id: 'switches', label: 'Switches', count: allEntities.filter((e) => e.domain === 'switch').length },
      { id: 'climate', label: 'Climate', count: allEntities.filter((e) => e.domain === 'climate').length },
      { id: 'triggers', label: 'Triggers', count: allEntities.filter((e) => e.domain === 'button' || e.domain === 'input_button' || e.domain === 'scene' || e.domain === 'script').length },
      { id: 'sensors', label: 'Sensors', count: allEntities.filter((e) => e.domain === 'sensor' || e.domain === 'binary_sensor').length },
    ];
    return cats.filter((c) => c.id === 'all' || c.id === 'selected' || c.count > 0);
  }, [allEntities, selectedIds]);

  // Filtered entity list
  const filteredEntities = useMemo(() => {
    return allEntities.filter((entity) => {
      // Category filter
      if (activeCategory === 'selected') {
        if (!selectedIds.has(entity.entity_id)) return false;
      } else if (activeCategory === 'access') {
        if (!isAccessEntity(entity)) return false;
      } else if (activeCategory === 'lights') {
        if (entity.domain !== 'light') return false;
      } else if (activeCategory === 'switches') {
        if (entity.domain !== 'switch') return false;
      } else if (activeCategory === 'climate') {
        if (entity.domain !== 'climate') return false;
      } else if (activeCategory === 'triggers') {
        if (entity.domain !== 'button' && entity.domain !== 'input_button' && entity.domain !== 'scene' && entity.domain !== 'script') return false;
      } else if (activeCategory === 'sensors') {
        if (entity.domain !== 'sensor' && entity.domain !== 'binary_sensor') return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          entity.friendly_name.toLowerCase().includes(query) ||
          entity.entity_id.toLowerCase().includes(query) ||
          entity.domain.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [allEntities, activeCategory, searchQuery, selectedIds]);

  const toggleEntity = (entityId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(entityId)) {
        next.delete(entityId);
      } else {
        next.add(entityId);
      }
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredEntities.forEach((e) => next.add(e.entity_id));
      return next;
    });
  };

  const handleDeselectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredEntities.forEach((e) => next.delete(e.entity_id));
      return next;
    });
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await onSave(Array.from(selectedIds));
      onClose();
    } catch (err) {
      console.error('Failed to save visible controls:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl bg-slate-900 border border-white/10 shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight">
                Manage Home Controls
              </h2>
              <p className="text-xs text-slate-400">
                Choose which devices and triggers appear on your Home dashboard
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar: Search & Category Pills */}
        <div className="p-4 sm:p-5 border-b border-white/10 space-y-3 bg-slate-900/50">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by device name, room, or entity ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-950 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
              >
                Clear
              </button>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeCategory === cat.id
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                    : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 border border-white/5'
                }`}
              >
                <span>{cat.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  activeCategory === cat.id ? 'bg-slate-950/20 text-slate-950 font-black' : 'bg-white/10 text-slate-400'
                }`}>
                  {cat.count}
                </span>
              </button>
            ))}
          </div>

          {/* Quick Select Actions */}
          <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
            <span>
              Showing {filteredEntities.length} of {allEntities.length} devices
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSelectAllFiltered}
                className="text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer"
              >
                Select all filtered
              </button>
              <span className="text-slate-600">•</span>
              <button
                type="button"
                onClick={handleDeselectAllFiltered}
                className="text-slate-400 hover:text-white font-semibold cursor-pointer"
              >
                Clear filtered
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Entity List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2 divide-y divide-white/5">
          {filteredEntities.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <Sliders className="w-8 h-8 mx-auto text-slate-500 opacity-60" />
              <p className="text-sm font-semibold">No matching devices found</p>
              <p className="text-xs text-slate-500">Try adjusting your search or category filter</p>
            </div>
          ) : (
            filteredEntities.map((entity) => {
              const isSelected = selectedIds.has(entity.entity_id);
              const isUnavailable = entity.state === 'unavailable' || entity.state === 'unknown';

              // Determine icon
              let icon = <Sliders className="w-4 h-4" />;
              let iconColor = 'bg-white/5 text-slate-400';

              if (entity.domain === 'light') {
                icon = <Lightbulb className="w-4 h-4" />;
                iconColor = 'bg-amber-500/15 text-amber-400';
              } else if (entity.domain === 'switch') {
                icon = <Power className="w-4 h-4" />;
                iconColor = 'bg-emerald-500/15 text-emerald-400';
              } else if (entity.domain === 'button' || entity.domain === 'input_button') {
                icon = <Zap className="w-4 h-4" />;
                iconColor = 'bg-amber-500/15 text-amber-400';
              } else if (entity.domain === 'lock') {
                icon = <Lock className="w-4 h-4" />;
                iconColor = 'bg-purple-500/15 text-purple-400';
              } else if (entity.domain === 'cover') {
                icon = <Shield className="w-4 h-4" />;
                iconColor = 'bg-blue-500/15 text-blue-400';
              } else if (entity.domain === 'climate') {
                icon = <Thermometer className="w-4 h-4" />;
                iconColor = 'bg-rose-500/15 text-rose-400';
              } else if (entity.domain === 'sensor' || entity.domain === 'binary_sensor') {
                icon = <Activity className="w-4 h-4" />;
                iconColor = 'bg-cyan-500/15 text-cyan-400';
              } else if (entity.domain === 'scene' || entity.domain === 'script') {
                icon = <Sparkles className="w-4 h-4" />;
                iconColor = 'bg-purple-500/15 text-purple-400';
              }

              return (
                <div
                  key={entity.entity_id}
                  onClick={() => toggleEntity(entity.entity_id)}
                  className={`pt-2 first:pt-0 flex items-center justify-between p-3 rounded-2xl transition-all cursor-pointer select-none ${
                    isSelected
                      ? 'bg-emerald-500/10 border border-emerald-500/25'
                      : 'hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-4">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconColor}`}>
                      {icon}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate flex items-center gap-2">
                        <span>{entity.friendly_name}</span>
                        {isUnavailable && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 text-slate-500 font-normal">
                            Offline
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate flex items-center gap-1.5 mt-0.5">
                        <span className="capitalize text-slate-500 font-semibold">{entity.domain}</span>
                        <span>•</span>
                        <span className="text-slate-500 truncate">{entity.entity_id}</span>
                        <span>•</span>
                        <span className={`capitalize font-medium ${isUnavailable ? 'text-slate-500' : 'text-slate-300'}`}>
                          {entity.state}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Checkbox Toggle */}
                  <div className="shrink-0">
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                      isSelected
                        ? 'bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/20'
                        : 'border border-white/20 bg-white/5 text-transparent'
                    }`}>
                      <Check className="w-4 h-4 stroke-[3]" />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-slate-900 flex items-center justify-between gap-4">
          <div className="text-xs text-slate-400">
            <span className="font-bold text-white">{selectedIds.size}</span> control{selectedIds.size === 1 ? '' : 's'} selected
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-xs font-bold transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSave}
              className="px-5 py-2 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Controls'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
