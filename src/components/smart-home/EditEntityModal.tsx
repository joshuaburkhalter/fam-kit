import React, { useState, useEffect } from 'react';
import {
  X,
  RotateCcw,
  Check,
  Lightbulb,
  Lamp,
  Sun,
  Sparkles,
  Power,
  Zap,
  Plug,
  ToggleRight,
  Gauge,
  Thermometer,
  Flame,
  Snowflake,
  Fan,
  Wind,
  Warehouse,
  Blinds,
  DoorClosed,
  DoorOpen,
  Lock,
  Unlock,
  Key,
  Shield,
  Bed,
  Bath,
  Sofa,
  Tv,
  Speaker,
  Coffee,
  Utensils,
  Activity,
  Droplets,
  Battery,
  Wifi,
  User,
  Clock,
  Sliders,
  SlidersHorizontal,
  Pencil,
} from 'lucide-react';
import { HomeAssistantEntity, EntityCustomization } from '../../types';

interface EditEntityModalProps {
  isOpen: boolean;
  entity: HomeAssistantEntity | null;
  currentCustomization?: EntityCustomization;
  onClose: () => void;
  onSave: (entityId: string, customization: EntityCustomization | null) => Promise<void>;
}

export const AVAILABLE_ICONS = [
  { id: '', label: 'Default', icon: Sliders },
  { id: 'Lightbulb', label: 'Light', icon: Lightbulb },
  { id: 'Lamp', label: 'Lamp', icon: Lamp },
  { id: 'Sun', label: 'Sun', icon: Sun },
  { id: 'Sparkles', label: 'Sparkles', icon: Sparkles },
  { id: 'Power', label: 'Power', icon: Power },
  { id: 'Zap', label: 'Electricity', icon: Zap },
  { id: 'Plug', label: 'Outlet', icon: Plug },
  { id: 'ToggleRight', label: 'Switch', icon: ToggleRight },
  { id: 'Gauge', label: 'Gauge', icon: Gauge },
  { id: 'Thermometer', label: 'Temp', icon: Thermometer },
  { id: 'Flame', label: 'Heat', icon: Flame },
  { id: 'Snowflake', label: 'Cool', icon: Snowflake },
  { id: 'Fan', label: 'Fan', icon: Fan },
  { id: 'Wind', label: 'Wind', icon: Wind },
  { id: 'Warehouse', label: 'Garage', icon: Warehouse },
  { id: 'Blinds', label: 'Shades', icon: Blinds },
  { id: 'DoorClosed', label: 'Door', icon: DoorClosed },
  { id: 'DoorOpen', label: 'Open Door', icon: DoorOpen },
  { id: 'Lock', label: 'Lock', icon: Lock },
  { id: 'Unlock', label: 'Unlock', icon: Unlock },
  { id: 'Key', label: 'Key', icon: Key },
  { id: 'Shield', label: 'Security', icon: Shield },
  { id: 'Bed', label: 'Bedroom', icon: Bed },
  { id: 'Bath', label: 'Bathroom', icon: Bath },
  { id: 'Sofa', label: 'Living', icon: Sofa },
  { id: 'Tv', label: 'TV', icon: Tv },
  { id: 'Speaker', label: 'Audio', icon: Speaker },
  { id: 'Coffee', label: 'Coffee', icon: Coffee },
  { id: 'Utensils', label: 'Kitchen', icon: Utensils },
  { id: 'Activity', label: 'Motion', icon: Activity },
  { id: 'Droplets', label: 'Humidity', icon: Droplets },
  { id: 'Battery', label: 'Battery', icon: Battery },
  { id: 'Wifi', label: 'Network', icon: Wifi },
  { id: 'User', label: 'Person', icon: User },
  { id: 'Clock', label: 'Clock', icon: Clock },
  { id: 'SlidersHorizontal', label: 'Sliders', icon: SlidersHorizontal },
];

export const AVAILABLE_CATEGORIES = [
  { id: '', label: 'Default (Automatic Domain)' },
  { id: 'climate', label: '🌡️ Climate' },
  { id: 'lights', label: '💡 Lights' },
  { id: 'locks', label: '🔒 Locks' },
  { id: 'covers', label: '🚪 Covers & Doors' },
  { id: 'switches', label: '⚡ Switches' },
  { id: 'fans', label: '🌀 Fans' },
  { id: 'triggers', label: '⚡ Triggers & Scenes' },
  { id: 'media', label: '📺 Media Players' },
  { id: 'other', label: '🎛️ Other Controls' },
];

export const getCustomIconComponent = (iconName?: string) => {
  if (!iconName) return null;
  const match = AVAILABLE_ICONS.find((i) => i.id === iconName);
  return match ? match.icon : null;
};

export const EditEntityModal: React.FC<EditEntityModalProps> = ({
  isOpen,
  entity,
  currentCustomization,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen && entity) {
      setName(currentCustomization?.name || '');
      setSelectedIcon(currentCustomization?.icon || '');
      setSelectedCategory(currentCustomization?.category || '');
    }
  }, [isOpen, entity, currentCustomization]);

  if (!isOpen || !entity) return null;

  const originalName = entity.attributes?.friendly_name || entity.friendly_name || entity.entity_id;

  const handleResetToDefault = async () => {
    try {
      setIsSaving(true);
      await onSave(entity.entity_id, null);
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to reset entity customization');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      const cleanName = name.trim();
      const customization: EntityCustomization | null =
        cleanName || selectedIcon || selectedCategory
          ? {
              ...(cleanName ? { name: cleanName } : {}),
              ...(selectedIcon ? { icon: selectedIcon } : {}),
              ...(selectedCategory ? { category: selectedCategory } : {}),
            }
          : null;

      await onSave(entity.entity_id, customization);
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to save entity customization');
    } finally {
      setIsSaving(false);
    }
  };

  const PreviewIcon = getCustomIconComponent(selectedIcon) || Sliders;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="glass-panel w-full max-w-lg max-h-[90vh] rounded-3xl border border-white/10 shadow-2xl flex flex-col overflow-hidden bg-slate-900/95">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
              <Pencil className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-black text-white">Customize Control</h2>
              <p className="text-xs text-slate-400 truncate max-w-[260px] sm:max-w-xs font-mono mt-0.5">
                {entity.entity_id}
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

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Live Preview Card */}
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0">
              <PreviewIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                Dashboard Preview
              </div>
              <div className="text-sm font-bold text-white truncate">
                {name.trim() || originalName}
              </div>
              <div className="text-[11px] text-slate-400 capitalize">
                {selectedCategory
                  ? AVAILABLE_CATEGORIES.find((c) => c.id === selectedCategory)?.label
                  : `Domain: ${entity.domain}`}
              </div>
            </div>
          </div>

          {/* 1. Custom Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center justify-between">
              <span>Custom Name</span>
              {name && (
                <button
                  type="button"
                  onClick={() => setName('')}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer lowercase"
                >
                  revert to default
                </button>
              )}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={originalName}
              className="w-full px-4 py-2.5 rounded-2xl bg-slate-950/70 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 transition-all font-medium"
            />
            <p className="text-[11px] text-slate-500">
              Leave blank to keep original: <span className="text-slate-400 font-medium">"{originalName}"</span>
            </p>
          </div>

          {/* 2. Carousel Category */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
              Carousel Group
            </label>
            <div className="relative">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl bg-slate-950/70 border border-white/10 text-xs text-white focus:outline-none focus:border-emerald-500/50 transition-all appearance-none cursor-pointer"
              >
                {AVAILABLE_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id} className="bg-slate-900 text-white">
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[11px] text-slate-500">
              Choose which carousel track this control appears inside.
            </p>
          </div>

          {/* 3. Icon Selection Grid */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center justify-between">
              <span>Choose Icon</span>
              {selectedIcon && (
                <button
                  type="button"
                  onClick={() => setSelectedIcon('')}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer lowercase"
                >
                  use default icon
                </button>
              )}
            </label>

            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-48 overflow-y-auto no-scrollbar p-1 rounded-2xl border border-white/5 bg-slate-950/40">
              {AVAILABLE_ICONS.map((item) => {
                const IconComponent = item.icon;
                const isSelected = selectedIcon === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedIcon(item.id)}
                    className={`p-2.5 rounded-xl flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 font-bold'
                        : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/5'
                    }`}
                    title={item.label}
                  >
                    <IconComponent className="w-4 h-4 shrink-0" />
                    <span className="text-[9px] truncate max-w-full text-center">
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </form>

        {/* Modal Footer */}
        <div className="px-5 sm:px-6 py-4 border-t border-white/10 bg-slate-900 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            disabled={isSaving || (!currentCustomization?.name && !currentCustomization?.icon && !currentCustomization?.category)}
            onClick={handleResetToDefault}
            className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 font-semibold cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset All</span>
          </button>

          <div className="flex items-center gap-2">
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
