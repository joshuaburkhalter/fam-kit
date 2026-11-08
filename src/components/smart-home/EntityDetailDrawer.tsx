import React, { useState, useEffect } from 'react';
import {
  Zap,
  Gauge,
  Lock,
  Unlock,
  Lightbulb,
  ToggleLeft,
  ToggleRight,
  Fan,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Flame,
  Snowflake,
  Power,
  RotateCcw,
  Sun,
  Warehouse,
  Blinds,
  ArrowUp,
  ArrowDown,
  Square,
  Activity,
  Battery,
  Info,
  Clock,
  Check,
  AlertTriangle,
  User,
} from 'lucide-react';
import { Drawer } from '../ui/Drawer';
import { api } from '../../lib/api';
import { HomeAssistantEntity, EntityCustomization } from '../../types';

interface EntityDetailDrawerProps {
  entity: HomeAssistantEntity | null;
  customization?: EntityCustomization;
  isOpen: boolean;
  onClose: () => void;
  onCallService: (domain: string, service: string, serviceData: any) => Promise<void>;
}


const PersonDrawerAvatar: React.FC<{ entity: HomeAssistantEntity; customName?: string }> = ({ entity, customName }) => {
  const [imgError, setImgError] = useState(false);
  const photo = entity.attributes?.entity_picture;
  const isHome = entity.state === 'home';
  const photoUrl = photo && !imgError ? api.getHomeAssistantImageUrl(photo) : null;
  const name = customName || entity.friendly_name || '';

  return (
    <div className="relative mb-3">
      {photoUrl ? (
        <img
          src={photoUrl}
          alt={name}
          onError={() => setImgError(true)}
          className="w-20 h-20 rounded-full object-cover ring-4 ring-emerald-500/30"
        />
      ) : (
        <div className="w-20 h-20 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-3xl font-black">
          {name.charAt(0).toUpperCase()}
        </div>
      )}
      <span
        className={`absolute bottom-0.5 right-0.5 w-5 h-5 rounded-full border-2 border-slate-900 ${
          isHome ? 'bg-emerald-400' : 'bg-slate-500'
        }`}
      />
    </div>
  );
};

export const EntityDetailDrawer: React.FC<EntityDetailDrawerProps> = ({
  entity,
  customization,
  isOpen,
  onClose,
  onCallService,
}) => {
  if (!entity) return null;

  const { domain, entity_id, state, attributes, friendly_name } = entity;
  const displayName = customization?.name || friendly_name;
  const isAvailable = state !== 'unavailable' && state !== 'unknown';

  // Local state for optimistic slider/control changes
  const [targetTemp, setTargetTemp] = useState<number>(() => {
    return attributes.temperature || attributes.current_temperature || 70;
  });
  const [brightness, setBrightness] = useState<number>(() => {
    return attributes.brightness ? Math.round((attributes.brightness / 255) * 100) : 100;
  });
  const [coverPosition, setCoverPosition] = useState<number>(() => {
    return attributes.current_position ?? (state === 'open' ? 100 : 0);
  });
  const [isCallingService, setIsCallingService] = useState(false);

  // Sync with incoming entity updates
  useEffect(() => {
    if (attributes.temperature !== undefined) {
      setTargetTemp(attributes.temperature);
    } else if (attributes.current_temperature !== undefined) {
      setTargetTemp(attributes.current_temperature);
    }

    if (attributes.brightness !== undefined) {
      setBrightness(Math.round((attributes.brightness / 255) * 100));
    }

    if (attributes.current_position !== undefined) {
      setCoverPosition(attributes.current_position);
    }
  }, [entity]);


  const handleAction = async (serviceDomain: string, service: string, serviceData: any = {}) => {
    try {
      setIsCallingService(true);
      await onCallService(serviceDomain, service, { entity_id, ...serviceData });
    } catch (err: any) {
      console.error('Service call error:', err);
      alert(err.message || 'Failed to execute command');
    } finally {
      setIsCallingService(false);
    }
  };

  const renderClimateControls = () => {
    const currentTemp = attributes.current_temperature;
    const hvacModes = attributes.hvac_modes || ['heat', 'cool', 'auto', 'off'];
    const fanModes = attributes.fan_modes || [];
    const minTemp = attributes.min_temp ?? 50;
    const maxTemp = attributes.max_temp ?? 90;
    const step = attributes.target_temp_step ?? 1;
    const hvacAction = attributes.hvac_action;

    return (
      <div className="space-y-6">
        {/* Main Temperature Display Card */}
        <div className="glass-panel p-6 rounded-3xl border border-white/10 flex flex-col items-center justify-center relative overflow-hidden bg-gradient-to-b from-white/5 to-transparent text-center">
          <div className="text-xs uppercase font-bold tracking-wider text-slate-400 mb-1">
            Current Temperature
          </div>
          <div className="text-5xl font-black tracking-tight text-white mb-2">
            {currentTemp !== undefined ? `${Math.round(currentTemp)}°` : `${Math.round(targetTemp)}°`}
            <span className="text-lg font-medium text-slate-400 ml-1">
              {attributes.unit_of_measurement || '°F'}
            </span>
          </div>

          {hvacAction && (
            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold capitalize ${
              hvacAction === 'heating'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : hvacAction === 'cooling'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'bg-white/10 text-slate-300'
            }`}>
              {hvacAction === 'heating' && <Flame className="w-3.5 h-3.5" />}
              {hvacAction === 'cooling' && <Snowflake className="w-3.5 h-3.5" />}
              {hvacAction}
            </div>
          )}

          {attributes.current_humidity !== undefined && (
            <div className="mt-3 text-xs text-slate-400 flex items-center gap-1">
              <span>Indoor Humidity:</span>
              <span className="font-semibold text-slate-200">{attributes.current_humidity}%</span>
            </div>
          )}
        </div>

        {/* Target Temperature Setpoint Controls */}
        <div className="glass-panel p-5 rounded-3xl border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Target Temperature
            </span>
            <span className="text-2xl font-black text-emerald-400">
              {Math.round(targetTemp)}°
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                const next = Math.max(minTemp, targetTemp - step);
                setTargetTemp(next);
                handleAction('climate', 'set_temperature', { temperature: next });
              }}
              className="w-12 h-12 rounded-2xl bg-white/10 hover:bg-white/15 text-white flex items-center justify-center font-bold text-2xl active:scale-95 transition-all cursor-pointer border border-white/10"
              title="Decrease temperature"
            >
              -
            </button>

            <input
              type="range"
              min={minTemp}
              max={maxTemp}
              step={step}
              value={targetTemp}
              onChange={(e) => setTargetTemp(parseFloat(e.target.value))}
              onMouseUp={() => handleAction('climate', 'set_temperature', { temperature: targetTemp })}
              onTouchEnd={() => handleAction('climate', 'set_temperature', { temperature: targetTemp })}
              className="flex-1 h-3 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />

            <button
              type="button"
              onClick={() => {
                const next = Math.min(maxTemp, targetTemp + step);
                setTargetTemp(next);
                handleAction('climate', 'set_temperature', { temperature: next });
              }}
              className="w-12 h-12 rounded-2xl bg-white/10 hover:bg-white/15 text-white flex items-center justify-center font-bold text-2xl active:scale-95 transition-all cursor-pointer border border-white/10"
              title="Increase temperature"
            >
              +
            </button>
          </div>
        </div>

        {/* HVAC Mode Selection */}
        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            System Mode
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {hvacModes.map((mode) => {
              const isSelected = state === mode;
              let icon = <Power className="w-4 h-4" />;
              let activeClass = 'bg-white/15 text-white border-white/30';

              if (mode === 'heat') {
                icon = <Flame className="w-4 h-4" />;
                activeClass = 'bg-amber-500/25 text-amber-300 border-amber-500/40 font-bold';
              } else if (mode === 'cool') {
                icon = <Snowflake className="w-4 h-4" />;
                activeClass = 'bg-cyan-500/25 text-cyan-300 border-cyan-500/40 font-bold';
              } else if (mode === 'auto' || mode === 'heat_cool') {
                icon = <RotateCcw className="w-4 h-4" />;
                activeClass = 'bg-emerald-500/25 text-emerald-300 border-emerald-500/40 font-bold';
              } else if (mode === 'off') {
                activeClass = 'bg-slate-700/50 text-slate-300 border-white/20';
              }

              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => handleAction('climate', 'set_hvac_mode', { hvac_mode: mode })}
                  className={`p-3 rounded-2xl border flex items-center justify-center gap-2 capitalize text-xs transition-all cursor-pointer ${
                    isSelected ? activeClass : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10'
                  }`}
                >
                  {icon}
                  <span>{mode.replace('_', '/')}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Fan Mode Selection (if available) */}
        {fanModes.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Fan Mode
            </span>
            <div className="flex flex-wrap gap-2">
              {fanModes.map((fMode) => (
                <button
                  key={fMode}
                  type="button"
                  onClick={() => handleAction('climate', 'set_fan_mode', { fan_mode: fMode })}
                  className={`px-3 py-2 rounded-xl border text-xs capitalize transition-all cursor-pointer ${
                    attributes.fan_mode === fMode
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold'
                      : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10'
                  }`}
                >
                  {fMode}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderLightControls = () => {
    const isOn = state === 'on';

    return (
      <div className="space-y-6">
        {/* Master Power Toggle Button */}
        <div className="glass-panel p-6 rounded-3xl border border-white/10 flex flex-col items-center justify-center text-center">
          <button
            type="button"
            onClick={() => handleAction('light', isOn ? 'turn_off' : 'turn_on')}
            className={`w-24 h-24 rounded-3xl flex items-center justify-center transition-all cursor-pointer shadow-xl ${
              isOn
                ? 'bg-amber-400 text-slate-950 shadow-amber-500/30 scale-105 ring-4 ring-amber-400/20'
                : 'bg-white/10 text-slate-400 hover:text-white border border-white/10'
            }`}
          >
            <Lightbulb className={`w-10 h-10 ${isOn ? 'fill-slate-950 stroke-[2.5]' : ''}`} />
          </button>
          <div className="mt-4 text-base font-bold text-white capitalize">
            {isOn ? `Light is On (${brightness}%)` : 'Light is Off'}
          </div>
        </div>

        {/* Brightness Slider */}
        <div className="glass-panel p-5 rounded-3xl border border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Sun className="w-4 h-4 text-amber-400" />
              Brightness
            </span>
            <span className="text-sm font-bold text-amber-400">{brightness}%</span>
          </div>

          <input
            type="range"
            min="1"
            max="100"
            value={brightness}
            onChange={(e) => setBrightness(parseInt(e.target.value, 10))}
            onMouseUp={() => handleAction('light', 'turn_on', { brightness: Math.round((brightness / 100) * 255) })}
            onTouchEnd={() => handleAction('light', 'turn_on', { brightness: Math.round((brightness / 100) * 255) })}
            className="w-full h-3 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
          />

          <div className="flex justify-between text-[11px] text-slate-400 pt-1">
            <button
              type="button"
              onClick={() => {
                setBrightness(25);
                handleAction('light', 'turn_on', { brightness: Math.round(0.25 * 255) });
              }}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer"
            >
              25%
            </button>
            <button
              type="button"
              onClick={() => {
                setBrightness(50);
                handleAction('light', 'turn_on', { brightness: Math.round(0.5 * 255) });
              }}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer"
            >
              50%
            </button>
            <button
              type="button"
              onClick={() => {
                setBrightness(75);
                handleAction('light', 'turn_on', { brightness: Math.round(0.75 * 255) });
              }}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer"
            >
              75%
            </button>
            <button
              type="button"
              onClick={() => {
                setBrightness(100);
                handleAction('light', 'turn_on', { brightness: 255 });
              }}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer"
            >
              100%
            </button>
          </div>
        </div>

        {/* Color Temperature Presets */}
        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Tone Presets
          </span>
          <div className="grid grid-cols-2 gap-2">
            {[
              { name: 'Warm Sunset', kelvin: 2700, bg: 'from-amber-500/20 to-orange-500/20', text: 'text-amber-300' },
              { name: 'Soft White', kelvin: 3000, bg: 'from-amber-400/20 to-yellow-500/20', text: 'text-yellow-200' },
              { name: 'Neutral Daylight', kelvin: 4000, bg: 'from-blue-400/20 to-cyan-500/20', text: 'text-cyan-200' },
              { name: 'Crisp Cool', kelvin: 5000, bg: 'from-cyan-400/20 to-blue-500/20', text: 'text-blue-300' },
            ].map((tone) => (
              <button
                key={tone.name}
                type="button"
                onClick={() => handleAction('light', 'turn_on', { color_temp_kelvin: tone.kelvin })}
                className={`p-3 rounded-2xl border border-white/10 bg-gradient-to-r ${tone.bg} hover:scale-[1.02] transition-all text-left cursor-pointer`}
              >
                <div className={`text-xs font-bold ${tone.text}`}>{tone.name}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{tone.kelvin}K</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderCoverControls = () => {
    const isGarage = attributes.device_class === 'garage' || entity_id.toLowerCase().includes('garage') || friendly_name.toLowerCase().includes('garage');
    const isOpenState = state === 'open';

    return (
      <div className="space-y-6">
        <div className="glass-panel p-6 rounded-3xl border border-white/10 flex flex-col items-center justify-center text-center">
          <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-3 ${
            isOpenState
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
          }`}>
            {isGarage ? <Warehouse className="w-10 h-10" /> : <Blinds className="w-10 h-10" />}
          </div>
          <div className="text-xl font-bold text-white capitalize">{state}</div>
          <p className="text-xs text-slate-400 mt-1">
            {isGarage ? 'Garage Door' : 'Cover / Blinds'}
          </p>
        </div>

        {/* 3-Button Control Bar */}
        <div className="grid grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => handleAction('cover', 'open_cover')}
            className="p-4 rounded-2xl bg-white/10 hover:bg-emerald-500/20 text-slate-200 hover:text-emerald-300 border border-white/10 hover:border-emerald-500/30 flex flex-col items-center gap-1.5 transition-all cursor-pointer"
          >
            <ArrowUp className="w-5 h-5" />
            <span className="text-xs font-bold">Open</span>
          </button>

          <button
            type="button"
            onClick={() => handleAction('cover', 'stop_cover')}
            className="p-4 rounded-2xl bg-white/10 hover:bg-rose-500/20 text-slate-200 hover:text-rose-300 border border-white/10 hover:border-rose-500/30 flex flex-col items-center gap-1.5 transition-all cursor-pointer"
          >
            <Square className="w-5 h-5" />
            <span className="text-xs font-bold">Stop</span>
          </button>

          <button
            type="button"
            onClick={() => handleAction('cover', 'close_cover')}
            className="p-4 rounded-2xl bg-white/10 hover:bg-blue-500/20 text-slate-200 hover:text-blue-300 border border-white/10 hover:border-blue-500/30 flex flex-col items-center gap-1.5 transition-all cursor-pointer"
          >
            <ArrowDown className="w-5 h-5" />
            <span className="text-xs font-bold">Close</span>
          </button>
        </div>

        {/* Position Slider (for blinds/shades) */}
        {!isGarage && (
          <div className="glass-panel p-5 rounded-3xl border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Position
              </span>
              <span className="text-sm font-bold text-emerald-400">{coverPosition}%</span>
            </div>

            <input
              type="range"
              min="0"
              max="100"
              value={coverPosition}
              onChange={(e) => setCoverPosition(parseInt(e.target.value, 10))}
              onMouseUp={() => handleAction('cover', 'set_cover_position', { position: coverPosition })}
              onTouchEnd={() => handleAction('cover', 'set_cover_position', { position: coverPosition })}
              className="w-full h-3 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
          </div>
        )}
      </div>
    );
  };

  const renderLockControls = () => {
    const isUnavailable = state === 'unavailable' || state === 'unknown';
    const isLocked = state === 'locked';
    const isUnlocked = state === 'unlocked' || state === 'open';

    return (
      <div className="space-y-6">
        <div className="glass-panel p-6 rounded-3xl border border-white/10 flex flex-col items-center justify-center text-center">
          <div className={`w-24 h-24 rounded-3xl flex items-center justify-center mb-3 shadow-xl transition-all ${
            isUnavailable
              ? 'bg-slate-800/60 text-slate-500 border border-white/5'
              : isLocked
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-emerald-500/10'
              : 'bg-rose-500/20 text-rose-400 border border-rose-500/30 shadow-rose-500/10'
          }`}>
            {isLocked ? <Lock className="w-10 h-10" /> : <Unlock className="w-10 h-10" />}
          </div>
          <div className={`text-2xl font-black capitalize ${
            isUnavailable ? 'text-slate-400' : 'text-white'
          }`}>
            {isUnavailable ? 'Unavailable / Offline' : state}
          </div>
          <p className="text-xs text-slate-400 mt-1">Smart Door Lock / Access Control</p>
        </div>

        {/* Unavailable notice */}
        {isUnavailable && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold block">Entity is Offline in Home Assistant</span>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {attributes.restored
                  ? 'This entity is marked as "restored" from cache, meaning the physical device or integration is no longer reporting it live. If this is a 2N intercom trigger, check if the integration provides a Button or Switch entity instead.'
                  : 'Home Assistant cannot reach this device. Check that your lock or intercom station is powered and connected to your local network.'}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={isUnavailable || isLocked}
            onClick={() => handleAction('lock', 'lock')}
            className={`p-4 rounded-2xl border flex items-center justify-center gap-2 font-bold text-sm transition-all cursor-pointer ${
              isUnavailable || isLocked
                ? 'opacity-40 bg-white/5 border-white/5 text-slate-400 cursor-not-allowed'
                : 'bg-emerald-500 text-slate-950 border-emerald-400 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20'
            }`}
          >
            <Lock className="w-4 h-4" />
            Lock
          </button>

          <button
            type="button"
            disabled={isUnavailable || isUnlocked}
            onClick={() => {
              if (confirm(`Unlock ${friendly_name}?`)) {
                handleAction('lock', 'unlock');
              }
            }}
            className={`p-4 rounded-2xl border flex items-center justify-center gap-2 font-bold text-sm transition-all cursor-pointer ${
              isUnavailable || isUnlocked
                ? 'opacity-40 bg-white/5 border-white/5 text-slate-400 cursor-not-allowed'
                : 'bg-rose-500 text-white border-rose-400 hover:bg-rose-600 shadow-lg shadow-rose-500/20'
            }`}
          >
            <Unlock className="w-4 h-4" />
            Unlock
          </button>
        </div>

        {/* Pulse / Buzz Trigger button for momentary door strikes */}
        <div className="pt-2">
          <button
            type="button"
            disabled={isUnavailable}
            onClick={() => {
              if (confirm(`Buzz / pulse trigger for ${friendly_name}?`)) {
                handleAction('lock', 'unlock');
              }
            }}
            className={`w-full p-3.5 rounded-2xl border flex items-center justify-center gap-2 text-xs font-bold transition-all ${
              isUnavailable
                ? 'opacity-30 bg-white/5 border-white/5 text-slate-500 cursor-not-allowed'
                : 'bg-white/5 hover:bg-white/10 text-amber-300 border-amber-500/30 hover:border-amber-500/50 cursor-pointer'
            }`}
          >
            <Zap className="w-4 h-4 text-amber-400" />
            <span>Pulse Trigger (Buzz Door)</span>
          </button>
        </div>
      </div>
    );
  };

  const renderSensorDetails = () => {
    const unit = attributes.unit_of_measurement || '';
    const deviceClass = attributes.device_class || 'sensor';

    return (
      <div className="space-y-6">
        <div className="glass-panel p-6 rounded-3xl border border-white/10 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/25 flex items-center justify-center mb-3">
            <Activity className="w-8 h-8" />
          </div>
          <div className="text-4xl font-black text-white">
            {state} {unit}
          </div>
          <p className="text-xs text-slate-400 mt-1 capitalize">{deviceClass}</p>
        </div>

        {/* Attributes Inspection Table */}
        <div className="glass-panel p-5 rounded-3xl border border-white/10 space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
            Sensor Details
          </span>

          <div className="space-y-2 text-xs">
            {attributes.battery_level !== undefined && (
              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Battery className="w-3.5 h-3.5 text-emerald-400" /> Battery
                </span>
                <span className="font-semibold text-white">{attributes.battery_level}%</span>
              </div>
            )}

            {entity.last_changed && (
              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" /> Last Updated
                </span>
                <span className="font-semibold text-white">
                  {new Date(entity.last_changed).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )}

            <div className="flex justify-between py-1.5">
              <span className="text-slate-400">Entity ID</span>
              <span className="font-mono text-[11px] text-slate-300">{entity_id}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };


  const renderPersonDetails = () => {
    const isHome = state === 'home';
    const photo = attributes.entity_picture;
    const source = attributes.source;
    const lastChanged = entity.last_changed;

    return (
      <div className="space-y-6">
        <div className="glass-panel p-6 rounded-3xl border border-white/10 flex flex-col items-center justify-center text-center">
          <PersonDrawerAvatar entity={entity} customName={displayName} />
          <div className="text-xl font-bold text-white capitalize">{isHome ? 'At Home' : state === 'not_home' ? 'Away' : state}</div>
          <p className="text-xs text-slate-400 mt-1">{displayName}</p>
        </div>

        <div className="glass-panel p-5 rounded-3xl border border-white/10 space-y-3 text-xs">
          <div className="flex justify-between py-1.5 border-b border-white/5">
            <span className="text-slate-400">Status</span>
            <span className={`font-semibold capitalize ${isHome ? 'text-emerald-400' : 'text-slate-300'}`}>
              {isHome ? 'Home' : state === 'not_home' ? 'Away' : state}
            </span>
          </div>
          {source && (
            <div className="flex justify-between py-1.5 border-b border-white/5">
              <span className="text-slate-400">Tracking Device</span>
              <span className="text-slate-300 font-mono text-[11px]">{source}</span>
            </div>
          )}
          {lastChanged && (
            <div className="flex justify-between py-1.5 border-b border-white/5">
              <span className="text-slate-400">Updated</span>
              <span className="text-slate-300">
                {new Date(lastChanged).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </span>
            </div>
          )}
          <div className="flex justify-between py-1.5">
            <span className="text-slate-400">Entity ID</span>
            <span className="font-mono text-[11px] text-slate-300">{entity_id}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={displayName}
      subtitle={`Home Assistant • ${domain}`}
      badge={
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
          isAvailable
            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            : 'bg-slate-700/50 text-slate-400 border border-white/10'
        }`}>
          {state}
        </span>
      }
    >
      <div className="space-y-6">

        {domain === 'climate' && renderClimateControls()}
        {domain === 'light' && renderLightControls()}
        {domain === 'cover' && renderCoverControls()}
        {domain === 'lock' && renderLockControls()}
        {(domain === 'sensor' || domain === 'binary_sensor') && renderSensorDetails()}
        {domain === 'person' && renderPersonDetails()}

        {/* Fallback for other domains */}
        {domain !== 'climate' && domain !== 'light' && domain !== 'cover' && domain !== 'lock' && domain !== 'sensor' && domain !== 'binary_sensor' && domain !== 'person' && (
          <div className="space-y-4">
            <div className="glass-panel p-5 rounded-3xl border border-white/10">
              <span className="text-xs text-slate-400">Current State</span>
              <div className="text-2xl font-bold text-white mt-1 capitalize">{state}</div>
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
};
