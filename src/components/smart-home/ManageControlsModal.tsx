import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Search,
  Sliders,
  Check,
  Lock,
  Lightbulb,
  Power,
  Zap,
  Gauge,
  Warehouse,
  Blinds,
  Activity,
  Sparkles,
  SlidersHorizontal,
  User,
  Droplets,
  Battery,
  DoorClosed,
  Fan,
} from 'lucide-react';
import { HomeAssistantEntity, EntityCustomization } from '../../types';

interface ManageControlsModalProps {
  isOpen: boolean;
  onClose: () => void;
  allEntities: HomeAssistantEntity[];
  customizations?: Record<string, EntityCustomization>;
  initialVisibleIds: string[];
  onSave: (visibleIds: string[]) => Promise<void>;
}

export const isDataOnlyEntity = (e: HomeAssistantEntity): boolean => {
  return e.domain === 'sensor' || e.domain === 'binary_sensor' || e.domain === 'person';
};

export const ManageControlsModal: React.FC<ManageControlsModalProps> = ({
  isOpen,
  onClose,
  allEntities,
  customizations = {},
  initialVisibleIds,
  onSave,
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(initialVisibleIds));
  const [searchQuery, setSearchQuery] = useState('');
  const [viewSection, setViewSection] = useState<'all' | 'controls' | 'data' | 'selected'>('all');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set(initialVisibleIds));
      setSearchQuery('');
      setViewSection('all');
      setActiveCategory('all');
    }
  }, [isOpen, initialVisibleIds]);

  // Helper to detect access-related entities
  const isAccessEntity = (e: HomeAssistantEntity) => {
    if (e.domain === 'lock' || e.domain === 'cover') return true;
    const s = (e.entity_id + ' ' + e.friendly_name).toLowerCase();
    return (
      (e.domain === 'button' || e.domain === 'input_button' || e.domain === 'switch') &&
      (s.includes('door') || s.includes('gate') || s.includes('lock') || s.includes('relay') || s.includes('verso') || s.includes('intercom') || s.includes('strike'))
    );
  };

  // Helper to detect sensor icon
  const getSensorIcon = (entity: HomeAssistantEntity) => {
    const s = (entity.entity_id + ' ' + entity.friendly_name).toLowerCase();
    const dc = (entity.attributes?.device_class || '').toLowerCase();

    if (entity.domain === 'person') {
      return { icon: <User className="w-4 h-4" />, color: 'bg-indigo-500/15 text-indigo-400' };
    }
    if (dc === 'temperature' || s.includes('temp')) {
      return { icon: <Gauge className="w-4 h-4" />, color: 'bg-amber-500/15 text-amber-400' };
    }
    if (dc === 'humidity' || s.includes('humidity')) {
      return { icon: <Droplets className="w-4 h-4" />, color: 'bg-cyan-500/15 text-cyan-400' };
    }
    if (dc === 'power' || dc === 'energy' || s.includes('power') || s.includes('watt') || s.includes('voltage')) {
      return { icon: <Zap className="w-4 h-4" />, color: 'bg-amber-500/15 text-amber-400' };
    }
    if (dc === 'battery' || s.includes('battery')) {
      return { icon: <Battery className="w-4 h-4" />, color: 'bg-emerald-500/15 text-emerald-400' };
    }
    if (dc === 'door' || dc === 'window' || dc === 'garage_door' || s.includes('door') || s.includes('window') || s.includes('contact')) {
      return { icon: <DoorClosed className="w-4 h-4" />, color: 'bg-blue-500/15 text-blue-400' };
    }
    return { icon: <Activity className="w-4 h-4" />, color: 'bg-cyan-500/15 text-cyan-400' };
  };

  const getEntityIcon = (entity: HomeAssistantEntity) => {
    if (isDataOnlyEntity(entity)) {
      return getSensorIcon(entity);
    }
    if (entity.domain === 'light') {
      return { icon: <Lightbulb className="w-4 h-4" />, color: 'bg-amber-500/15 text-amber-400' };
    }
    if (entity.domain === 'switch') {
      return { icon: <Power className="w-4 h-4" />, color: 'bg-emerald-500/15 text-emerald-400' };
    }
    if (entity.domain === 'fan') {
      return { icon: <Fan className="w-4 h-4" />, color: 'bg-cyan-500/15 text-cyan-400' };
    }
    if (entity.domain === 'button' || entity.domain === 'input_button') {
      return { icon: <Zap className="w-4 h-4" />, color: 'bg-amber-500/15 text-amber-400' };
    }
    if (entity.domain === 'lock') {
      return { icon: <Lock className="w-4 h-4" />, color: 'bg-purple-500/15 text-purple-400' };
    }
    if (entity.domain === 'cover') {
      const isGarage =
        entity.attributes?.device_class === 'garage' ||
        entity.entity_id.toLowerCase().includes('garage') ||
        (entity.friendly_name || '').toLowerCase().includes('garage');
      return {
        icon: isGarage ? <Warehouse className="w-4 h-4" /> : <Blinds className="w-4 h-4" />,
        color: 'bg-blue-500/15 text-blue-400',
      };
    }
    if (entity.domain === 'climate') {
      return { icon: <Gauge className="w-4 h-4" />, color: 'bg-rose-500/15 text-rose-400' };
    }
    if (entity.domain === 'scene' || entity.domain === 'script') {
      return { icon: <Sparkles className="w-4 h-4" />, color: 'bg-purple-500/15 text-purple-400' };
    }
    return { icon: <Sliders className="w-4 h-4" />, color: 'bg-white/5 text-slate-400' };
  };

  const { controlEntities, dataEntities } = useMemo(() => {
    const controls: HomeAssistantEntity[] = [];
    const data: HomeAssistantEntity[] = [];
    for (const e of allEntities) {
      if (isDataOnlyEntity(e)) {
        data.push(e);
      } else {
        controls.push(e);
      }
    }
    return { controlEntities: controls, dataEntities: data };
  }, [allEntities]);

  // Counts
  const selectedControlsCount = useMemo(() => {
    return controlEntities.filter((e) => selectedIds.has(e.entity_id)).length;
  }, [controlEntities, selectedIds]);

  const selectedDataCount = useMemo(() => {
    return dataEntities.filter((e) => selectedIds.has(e.entity_id)).length;
  }, [dataEntities, selectedIds]);

  // Filter entities according to search and category
  const filterList = (list: HomeAssistantEntity[]) => {
    return list.filter((entity) => {
      if (viewSection === 'selected' && !selectedIds.has(entity.entity_id)) return false;

      // Category filter (when not 'all')
      if (activeCategory === 'access' && !isAccessEntity(entity)) return false;
      if (activeCategory === 'lights' && entity.domain !== 'light') return false;
      if (activeCategory === 'switches' && entity.domain !== 'switch') return false;
      if (activeCategory === 'climate' && entity.domain !== 'climate') return false;
      if (activeCategory === 'triggers' && !['button', 'input_button', 'scene', 'script'].includes(entity.domain)) return false;
      if (activeCategory === 'people' && entity.domain !== 'person') return false;
      if (activeCategory === 'sensors' && entity.domain !== 'sensor' && entity.domain !== 'binary_sensor') return false;

      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const customName = customizations[entity.entity_id]?.name || entity.friendly_name;
        return (
          customName.toLowerCase().includes(query) ||
          entity.entity_id.toLowerCase().includes(query) ||
          entity.domain.toLowerCase().includes(query)
        );
      }

      return true;
    });
  };

  const filteredControls = useMemo(() => filterList(controlEntities), [controlEntities, searchQuery, activeCategory, viewSection, selectedIds]);
  const filteredData = useMemo(() => filterList(dataEntities), [dataEntities, searchQuery, activeCategory, viewSection, selectedIds]);

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

  const handleSelectAllInList = (list: HomeAssistantEntity[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      list.forEach((e) => next.add(e.entity_id));
      return next;
    });
  };

  const handleDeselectAllInList = (list: HomeAssistantEntity[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      list.forEach((e) => next.delete(e.entity_id));
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

  // Render a single entity item row
  const renderEntityRow = (entity: HomeAssistantEntity) => {
    const isSelected = selectedIds.has(entity.entity_id);
    const isUnavailable = entity.state === 'unavailable' || entity.state === 'unknown';
    const { icon, color } = getEntityIcon(entity);

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
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
            {icon}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-white truncate flex items-center gap-2">
              <span>{customizations[entity.entity_id]?.name || entity.friendly_name}</span>
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
                {entity.state} {entity.attributes?.unit_of_measurement || ''}
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
  };

  const showControls = viewSection === 'all' || viewSection === 'controls' || viewSection === 'selected';
  const showData = viewSection === 'all' || viewSection === 'data' || viewSection === 'selected';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="glass-panel w-full max-w-2xl max-h-[90vh] rounded-3xl border border-white/10 shadow-2xl flex flex-col overflow-hidden bg-slate-900/95">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
              <SlidersHorizontal className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">Edit Dashboard Controls</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Choose which controls and data readouts appear on the family screen
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search & Section Selector Bar */}
        <div className="p-4 sm:p-5 border-b border-white/10 space-y-3 bg-slate-900/60 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by device name, domain, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-950/70 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 transition-all"
            />
          </div>

          {/* Section View Tabs: All, Controls, Data & Sensors, Selected */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            <button
              type="button"
              onClick={() => { setViewSection('all'); setActiveCategory('all'); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                viewSection === 'all'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 border border-white/5'
              }`}
            >
              <span>All Entities</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${viewSection === 'all' ? 'bg-slate-950/20 text-slate-950 font-black' : 'bg-white/10 text-slate-400'}`}>
                {allEntities.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => { setViewSection('controls'); setActiveCategory('all'); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                viewSection === 'controls'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 border border-white/5'
              }`}
            >
              <Power className="w-3.5 h-3.5" />
              <span>Interactive Controls</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${viewSection === 'controls' ? 'bg-slate-950/20 text-slate-950 font-black' : 'bg-white/10 text-slate-400'}`}>
                {selectedControlsCount}/{controlEntities.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => { setViewSection('data'); setActiveCategory('all'); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                viewSection === 'data'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 border border-white/5'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Data & Sensors</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${viewSection === 'data' ? 'bg-slate-950/20 text-slate-950 font-black' : 'bg-white/10 text-slate-400'}`}>
                {selectedDataCount}/{dataEntities.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => { setViewSection('selected'); setActiveCategory('all'); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                viewSection === 'selected'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 border border-white/5'
              }`}
            >
              <span>Selected</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${viewSection === 'selected' ? 'bg-slate-950/20 text-slate-950 font-black' : 'bg-white/10 text-slate-400'}`}>
                {selectedIds.size}
              </span>
            </button>
          </div>
        </div>

        {/* Scrollable Entity List with Distinct Sections */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6">
          {/* SECTION 1: INTERACTIVE CONTROLS */}
          {showControls && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                    <Power className="w-3.5 h-3.5 stroke-[2.2]" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-white">
                      Interactive Controls
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Lights, switches, thermostats, covers, and quick triggers
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => handleSelectAllInList(filteredControls)}
                    className="text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer text-[11px]"
                  >
                    Select all
                  </button>
                  <span className="text-slate-600">•</span>
                  <button
                    type="button"
                    onClick={() => handleDeselectAllInList(filteredControls)}
                    className="text-slate-400 hover:text-white font-semibold cursor-pointer text-[11px]"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {filteredControls.length === 0 ? (
                <div className="py-6 text-center text-slate-500 text-xs">
                  No matching interactive controls found
                </div>
              ) : (
                <div className="space-y-1.5 divide-y divide-white/5">
                  {filteredControls.map(renderEntityRow)}
                </div>
              )}
            </div>
          )}

          {/* SECTION 2: DATA-ONLY ENTITIES & SENSORS */}
          {showData && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-cyan-500/15 text-cyan-400 flex items-center justify-center">
                    <Activity className="w-3.5 h-3.5 stroke-[2.2]" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
                      <span>Data-Only & Sensors</span>
                      <span className="px-1.5 py-0.2 rounded-md bg-cyan-500/20 text-cyan-300 text-[10px] font-bold">
                        Top Sensor Row
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Environmental sensors, presence/people, contact sensors, power & battery readouts
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => handleSelectAllInList(filteredData)}
                    className="text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer text-[11px]"
                  >
                    Select all
                  </button>
                  <span className="text-slate-600">•</span>
                  <button
                    type="button"
                    onClick={() => handleDeselectAllInList(filteredData)}
                    className="text-slate-400 hover:text-white font-semibold cursor-pointer text-[11px]"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {filteredData.length === 0 ? (
                <div className="py-6 text-center text-slate-500 text-xs">
                  No matching data readouts or sensors found
                </div>
              ) : (
                <div className="space-y-1.5 divide-y divide-white/5">
                  {filteredData.map(renderEntityRow)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-slate-900 flex items-center justify-between gap-4 shrink-0">
          <div className="text-xs text-slate-400">
            <span className="font-bold text-white">{selectedIds.size}</span> item{selectedIds.size === 1 ? '' : 's'} selected ({selectedControlsCount} controls, {selectedDataCount} sensors)
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
              className="px-5 py-2 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black transition-all shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
