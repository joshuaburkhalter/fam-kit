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
  Wind,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Flame,
  Snowflake,
  Power,
  RotateCcw,
  Thermometer,
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
  const [optimisticHvacMode, setOptimisticHvacMode] = useState<string>(() => state);
  const [targetTemp, setTargetTemp] = useState<number>(() => {
    if (attributes.temperature !== undefined && attributes.temperature !== null) {
      return Number(attributes.temperature);
    }
    if (attributes.current_temperature !== undefined && attributes.current_temperature !== null) {
      return Number(attributes.current_temperature);
    }
    return 70;
  });

  const [targetTempLow, setTargetTempLow] = useState<number>(() => {
    if (attributes.target_temp_low !== undefined && attributes.target_temp_low !== null) {
      return Number(attributes.target_temp_low);
    }
    const base = Number(attributes.temperature ?? attributes.current_temperature ?? 70);
    return Math.max(attributes.min_temp ?? 50, base - 2);
  });

  const [targetTempHigh, setTargetTempHigh] = useState<number>(() => {
    if (attributes.target_temp_high !== undefined && attributes.target_temp_high !== null) {
      return Number(attributes.target_temp_high);
    }
    const base = Number(attributes.temperature ?? attributes.current_temperature ?? 70);
    return Math.min(attributes.max_temp ?? 90, base + 2);
  });

  const [brightness, setBrightness] = useState<number>(() => {
    return attributes.brightness ? Math.round((attributes.brightness / 255) * 100) : 100;
  });
  const [coverPosition, setCoverPosition] = useState<number>(() => {
    return attributes.current_position ?? (state === 'open' ? 100 : 0);
  });
  type FanSpeed = 'off' | '1' | '2' | '3' | '4';

  const getEntitySpeed = (): FanSpeed => {
    if (state === 'off' || state === 'unavailable' || state === 'unknown') return 'off';
    const preset = (attributes?.preset_mode || attributes?.speed || '').toLowerCase();
    if (preset === '1' || preset.includes('low') || preset === 'min') return '1';
    if (preset === '2' || preset.includes('med_low') || preset.includes('med-low')) return '2';
    if (preset === '3' || preset.includes('med_high') || preset.includes('med-high') || (preset.includes('med') && !preset.includes('low'))) return '3';
    if (preset === '4' || preset.includes('high') || preset === 'max') return '4';
    const pct = attributes?.percentage;
    if (typeof pct === 'number') {
      if (pct <= 0) return 'off';
      if (pct <= 25) return '1';
      if (pct <= 50) return '2';
      if (pct <= 75) return '3';
      return '4';
    }
    return '2';
  };

  const [activeSpeed, setActiveSpeed] = useState<FanSpeed>(getEntitySpeed);
  const [isCallingService, setIsCallingService] = useState(false);

  // Sync with incoming entity updates
  useEffect(() => {
    setOptimisticHvacMode(state);

    if (attributes.temperature !== undefined && attributes.temperature !== null) {
      setTargetTemp(Number(attributes.temperature));
    } else if (attributes.current_temperature !== undefined && attributes.current_temperature !== null) {
      setTargetTemp(Number(attributes.current_temperature));
    }

    if (attributes.target_temp_low !== undefined && attributes.target_temp_low !== null) {
      setTargetTempLow(Number(attributes.target_temp_low));
    } else {
      const base = Number(attributes.temperature ?? attributes.current_temperature ?? 70);
      setTargetTempLow((prev) => prev || Math.max(attributes.min_temp ?? 50, base - 2));
    }

    if (attributes.target_temp_high !== undefined && attributes.target_temp_high !== null) {
      setTargetTempHigh(Number(attributes.target_temp_high));
    } else {
      const base = Number(attributes.temperature ?? attributes.current_temperature ?? 70);
      setTargetTempHigh((prev) => prev || Math.min(attributes.max_temp ?? 90, base + 2));
    }

    if (attributes.brightness !== undefined) {
      setBrightness(Math.round((attributes.brightness / 255) * 100));
    }

    if (attributes.current_position !== undefined) {
      setCoverPosition(attributes.current_position);
    }

    setActiveSpeed(getEntitySpeed());
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
    const hvacModes: string[] = attributes.hvac_modes || ['heat', 'cool', 'heat_cool', 'off'];
    const fanModes: string[] = attributes.fan_modes || [];
    const minTemp = attributes.min_temp ?? 50;
    const maxTemp = attributes.max_temp ?? 90;
    const step = attributes.target_temp_step ?? 1;
    const hvacAction = attributes.hvac_action;
    const currentMode = optimisticHvacMode || state;

    const isDualSetpoint =
      currentMode === 'heat_cool' ||
      (currentMode === 'auto' &&
        (attributes.target_temp_low !== undefined ||
          attributes.target_temp_high !== undefined ||
          (typeof attributes.supported_features === 'number' && (attributes.supported_features & 2) !== 0)));

    const formatTemp = (val: number | undefined | null) => {
      if (val == null || isNaN(val)) return '--';
      return step < 1 ? Number(val.toFixed(1)) : Math.round(val);
    };

    const handleSetSingleTemp = async (nextVal: number) => {
      const clamped = Math.min(maxTemp, Math.max(minTemp, Math.round(nextVal * 10) / 10));
      setTargetTemp(clamped);

      const payload: Record<string, any> = { temperature: clamped };
      if (currentMode && currentMode !== 'off') {
        payload.hvac_mode = currentMode;
      }
      await handleAction('climate', 'set_temperature', payload);
    };

    const handleSetDualTemp = async (newLow: number, newHigh: number) => {
      const minGap = Math.max(step, 2);
      let clampedLow = Math.min(maxTemp - minGap, Math.max(minTemp, Math.round(newLow * 10) / 10));
      let clampedHigh = Math.min(maxTemp, Math.max(clampedLow + minGap, Math.round(newHigh * 10) / 10));

      setTargetTempLow(clampedLow);
      setTargetTempHigh(clampedHigh);

      const payload: Record<string, any> = {
        target_temp_low: clampedLow,
        target_temp_high: clampedHigh,
      };
      if (currentMode && currentMode !== 'off') {
        payload.hvac_mode = currentMode;
      }
      await handleAction('climate', 'set_temperature', payload);
    };

    const handleSetHvacMode = async (newMode: string) => {
      setOptimisticHvacMode(newMode);

      if (newMode === 'heat') {
        if (targetTempLow) setTargetTemp(targetTempLow);
      } else if (newMode === 'cool') {
        if (targetTempHigh) setTargetTemp(targetTempHigh);
      } else if (newMode === 'heat_cool' || newMode === 'auto') {
        if (!attributes.target_temp_low && targetTemp) {
          setTargetTempLow(Math.max(minTemp, targetTemp - 2));
        }
        if (!attributes.target_temp_high && targetTemp) {
          setTargetTempHigh(Math.min(maxTemp, targetTemp + 2));
        }
      }

      await handleAction('climate', 'set_hvac_mode', { hvac_mode: newMode });
    };

    return (
      <div className="space-y-6">
        {/* Main Temperature Display Card */}
        <div className="glass-panel p-6 rounded-3xl border border-white/10 flex flex-col items-center justify-center relative overflow-hidden bg-gradient-to-b from-white/5 to-transparent text-center">
          <div className="text-xs uppercase font-bold tracking-wider text-slate-400 mb-1">
            Current Temperature
          </div>
          <div className="text-5xl font-black tracking-tight text-white mb-2">
            {currentTemp !== undefined ? `${formatTemp(currentTemp)}°` : isDualSetpoint ? `${formatTemp(targetTempLow)}°–${formatTemp(targetTempHigh)}°` : `${formatTemp(targetTemp)}°`}
            <span className="text-lg font-medium text-slate-400 ml-1">
              {attributes.unit_of_measurement || '°F'}
            </span>
          </div>

          {/* Status / Running Action Badge */}
          {currentMode === 'off' ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-white/10">
              <Power className="w-3.5 h-3.5" />
              <span>System Off</span>
            </div>
          ) : hvacAction === 'heating' ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <Flame className="w-3.5 h-3.5 animate-pulse" />
              <span>Heating</span>
            </div>
          ) : hvacAction === 'cooling' ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              <Snowflake className="w-3.5 h-3.5 animate-pulse" />
              <span>Cooling</span>
            </div>
          ) : isDualSetpoint ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Auto Range ({formatTemp(targetTempLow)}°–{formatTemp(targetTempHigh)}°)</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-slate-300">
              {currentMode === 'heat' && <Flame className="w-3.5 h-3.5 text-amber-400" />}
              {currentMode === 'cool' && <Snowflake className="w-3.5 h-3.5 text-cyan-400" />}
              <span>{hvacAction || `${currentMode.charAt(0).toUpperCase() + currentMode.slice(1)} (Idle)`}</span>
            </div>
          )}

          {attributes.current_humidity !== undefined && (
            <div className="mt-3 text-xs text-slate-400 flex items-center gap-1">
              <span>Indoor Humidity:</span>
              <span className="font-semibold text-slate-200">{attributes.current_humidity}%</span>
            </div>
          )}
        </div>

        {/* Setpoint Controls based on Active Mode */}
        {currentMode === 'off' ? (
          <div className="glass-panel p-5 rounded-3xl border border-white/10 space-y-3 bg-slate-900/40 text-center">
            <div className="text-sm font-semibold text-slate-300">Thermostat is currently Off</div>
            <div className="text-xs text-slate-400">Choose a mode below to turn it on and adjust temperature:</div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              {hvacModes.filter((m) => m !== 'off').map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleSetHvacMode(m)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                    m === 'heat'
                      ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/40'
                      : m === 'cool'
                      ? 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border-cyan-500/40'
                      : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/40'
                  }`}
                >
                  {m === 'heat' && <Flame className="w-3.5 h-3.5" />}
                  {m === 'cool' && <Snowflake className="w-3.5 h-3.5" />}
                  {(m === 'heat_cool' || m === 'auto') && <RotateCcw className="w-3.5 h-3.5" />}
                  <span>Turn On {m === 'heat_cool' ? 'Heat/Cool' : m.charAt(0).toUpperCase() + m.slice(1)}</span>
                </button>
              ))}
            </div>
          </div>
        ) : isDualSetpoint ? (
          /* DUAL SETPOINT MODE (Heat/Cool or Auto) */
          <div className="space-y-4">
            {/* Dual Range Summary Banner */}
            <div className="glass-panel px-4 py-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-300">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white uppercase tracking-wider">Dual Comfort Range</div>
                  <div className="text-[11px] text-slate-400">
                    Heats below {formatTemp(targetTempLow)}°, cools above {formatTemp(targetTempHigh)}°
                  </div>
                </div>
              </div>
              <div className="text-lg font-black text-emerald-300">
                {formatTemp(targetTempLow)}° – {formatTemp(targetTempHigh)}°
              </div>
            </div>

            {/* Heat To (Lower Setpoint) */}
            <div className="glass-panel p-4 sm:p-5 rounded-3xl border border-amber-500/25 bg-gradient-to-b from-amber-500/10 to-transparent space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400">
                    <Flame className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-200">
                      Heat To (Lower Limit)
                    </span>
                    <p className="text-[11px] text-slate-400">Heats when room drops below this</p>
                  </div>
                </div>
                <span className="text-2xl font-black text-amber-400">
                  {formatTemp(targetTempLow)}°
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const nextLow = Math.max(minTemp, targetTempLow - step);
                    handleSetDualTemp(nextLow, targetTempHigh);
                  }}
                  disabled={targetTempLow <= minTemp}
                  className="w-12 h-12 rounded-2xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 flex items-center justify-center font-bold text-2xl active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Decrease heat setpoint"
                >
                  -
                </button>

                <input
                  type="range"
                  min={minTemp}
                  max={Math.max(minTemp, targetTempHigh - Math.max(step, 2))}
                  step={step}
                  value={targetTempLow}
                  onChange={(e) => setTargetTempLow(parseFloat(e.target.value))}
                  onMouseUp={() => handleSetDualTemp(targetTempLow, targetTempHigh)}
                  onTouchEnd={() => handleSetDualTemp(targetTempLow, targetTempHigh)}
                  className="flex-1 h-3 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />

                <button
                  type="button"
                  onClick={() => {
                    const minGap = Math.max(step, 2);
                    const nextLow = Math.min(targetTempHigh - minGap, targetTempLow + step);
                    handleSetDualTemp(nextLow, targetTempHigh);
                  }}
                  disabled={targetTempLow >= targetTempHigh - Math.max(step, 2)}
                  className="w-12 h-12 rounded-2xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 flex items-center justify-center font-bold text-2xl active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Increase heat setpoint"
                >
                  +
                </button>
              </div>
            </div>

            {/* Cool To (Upper Setpoint) */}
            <div className="glass-panel p-4 sm:p-5 rounded-3xl border border-cyan-500/25 bg-gradient-to-b from-cyan-500/10 to-transparent space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-cyan-500/20 flex items-center justify-center text-cyan-400">
                    <Snowflake className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-cyan-200">
                      Cool To (Upper Limit)
                    </span>
                    <p className="text-[11px] text-slate-400">Cools when room rises above this</p>
                  </div>
                </div>
                <span className="text-2xl font-black text-cyan-400">
                  {formatTemp(targetTempHigh)}°
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const minGap = Math.max(step, 2);
                    const nextHigh = Math.max(targetTempLow + minGap, targetTempHigh - step);
                    handleSetDualTemp(targetTempLow, nextHigh);
                  }}
                  disabled={targetTempHigh <= targetTempLow + Math.max(step, 2)}
                  className="w-12 h-12 rounded-2xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 flex items-center justify-center font-bold text-2xl active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Decrease cool setpoint"
                >
                  -
                </button>

                <input
                  type="range"
                  min={Math.min(maxTemp, targetTempLow + Math.max(step, 2))}
                  max={maxTemp}
                  step={step}
                  value={targetTempHigh}
                  onChange={(e) => setTargetTempHigh(parseFloat(e.target.value))}
                  onMouseUp={() => handleSetDualTemp(targetTempLow, targetTempHigh)}
                  onTouchEnd={() => handleSetDualTemp(targetTempLow, targetTempHigh)}
                  className="flex-1 h-3 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />

                <button
                  type="button"
                  onClick={() => {
                    const nextHigh = Math.min(maxTemp, targetTempHigh + step);
                    handleSetDualTemp(targetTempLow, nextHigh);
                  }}
                  disabled={targetTempHigh >= maxTemp}
                  className="w-12 h-12 rounded-2xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 flex items-center justify-center font-bold text-2xl active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Increase cool setpoint"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        ) : currentMode === 'heat' ? (
          /* SINGLE SETPOINT MODE (Heat) */
          <div className="glass-panel p-5 rounded-3xl border border-amber-500/25 bg-gradient-to-b from-amber-500/10 to-transparent space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400">
                  <Flame className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-200">
                    Heating Setpoint
                  </span>
                  <p className="text-[11px] text-slate-400">Heat turns on if room drops below this</p>
                </div>
              </div>
              <span className="text-3xl font-black text-amber-400">
                {formatTemp(targetTemp)}°
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  const next = Math.max(minTemp, targetTemp - step);
                  handleSetSingleTemp(next);
                }}
                disabled={targetTemp <= minTemp}
                className="w-12 h-12 rounded-2xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 flex items-center justify-center font-bold text-2xl active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
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
                onMouseUp={() => handleSetSingleTemp(targetTemp)}
                onTouchEnd={() => handleSetSingleTemp(targetTemp)}
                className="flex-1 h-3 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />

              <button
                type="button"
                onClick={() => {
                  const next = Math.min(maxTemp, targetTemp + step);
                  handleSetSingleTemp(next);
                }}
                disabled={targetTemp >= maxTemp}
                className="w-12 h-12 rounded-2xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 flex items-center justify-center font-bold text-2xl active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title="Increase temperature"
              >
                +
              </button>
            </div>
          </div>
        ) : currentMode === 'cool' ? (
          /* SINGLE SETPOINT MODE (Cool) */
          <div className="glass-panel p-5 rounded-3xl border border-cyan-500/25 bg-gradient-to-b from-cyan-500/10 to-transparent space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <Snowflake className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-cyan-200">
                    Cooling Setpoint
                  </span>
                  <p className="text-[11px] text-slate-400">A/C turns on if room rises above this</p>
                </div>
              </div>
              <span className="text-3xl font-black text-cyan-400">
                {formatTemp(targetTemp)}°
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  const next = Math.max(minTemp, targetTemp - step);
                  handleSetSingleTemp(next);
                }}
                disabled={targetTemp <= minTemp}
                className="w-12 h-12 rounded-2xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 flex items-center justify-center font-bold text-2xl active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
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
                onMouseUp={() => handleSetSingleTemp(targetTemp)}
                onTouchEnd={() => handleSetSingleTemp(targetTemp)}
                className="flex-1 h-3 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />

              <button
                type="button"
                onClick={() => {
                  const next = Math.min(maxTemp, targetTemp + step);
                  handleSetSingleTemp(next);
                }}
                disabled={targetTemp >= maxTemp}
                className="w-12 h-12 rounded-2xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 flex items-center justify-center font-bold text-2xl active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title="Increase temperature"
              >
                +
              </button>
            </div>
          </div>
        ) : (
          /* OTHER SINGLE SETPOINT MODES (e.g. single auto) */
          <div className="glass-panel p-5 rounded-3xl border border-emerald-500/25 bg-gradient-to-b from-emerald-500/10 to-transparent space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-200">
                    Target Temperature
                  </span>
                  <p className="text-[11px] text-slate-400">Maintains target room temperature</p>
                </div>
              </div>
              <span className="text-3xl font-black text-emerald-400">
                {formatTemp(targetTemp)}°
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  const next = Math.max(minTemp, targetTemp - step);
                  handleSetSingleTemp(next);
                }}
                disabled={targetTemp <= minTemp}
                className="w-12 h-12 rounded-2xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 flex items-center justify-center font-bold text-2xl active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
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
                onMouseUp={() => handleSetSingleTemp(targetTemp)}
                onTouchEnd={() => handleSetSingleTemp(targetTemp)}
                className="flex-1 h-3 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />

              <button
                type="button"
                onClick={() => {
                  const next = Math.min(maxTemp, targetTemp + step);
                  handleSetSingleTemp(next);
                }}
                disabled={targetTemp >= maxTemp}
                className="w-12 h-12 rounded-2xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 flex items-center justify-center font-bold text-2xl active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title="Increase temperature"
              >
                +
              </button>
            </div>
          </div>
        )}

        {/* HVAC Mode Selection */}
        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            System Mode
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {hvacModes.map((mode) => {
              const isSelected = currentMode === mode;
              let icon = <Power className="w-4 h-4" />;
              let activeClass = 'bg-white/15 text-white border-white/30';

              if (mode === 'heat') {
                icon = <Flame className="w-4 h-4" />;
                activeClass = 'bg-amber-500/25 text-amber-300 border-amber-500/50 shadow-md shadow-amber-500/20 font-bold ring-1 ring-amber-500/30';
              } else if (mode === 'cool') {
                icon = <Snowflake className="w-4 h-4" />;
                activeClass = 'bg-cyan-500/25 text-cyan-300 border-cyan-500/50 shadow-md shadow-cyan-500/20 font-bold ring-1 ring-cyan-500/30';
              } else if (mode === 'auto' || mode === 'heat_cool') {
                icon = <RotateCcw className="w-4 h-4" />;
                activeClass = 'bg-emerald-500/25 text-emerald-300 border-emerald-500/50 shadow-md shadow-emerald-500/20 font-bold ring-1 ring-emerald-500/30';
              } else if (mode === 'off') {
                activeClass = 'bg-slate-700/60 text-slate-200 border-white/20 font-bold';
              }

              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => handleSetHvacMode(mode)}
                  className={`p-3 rounded-2xl border flex items-center justify-center gap-2 capitalize text-xs transition-all cursor-pointer ${
                    isSelected ? activeClass : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10'
                  }`}
                >
                  {icon}
                  <span>{mode === 'heat_cool' ? 'Heat/Cool' : mode.replace('_', '/')}</span>
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
    const supportsBrightness =
      attributes.brightness !== undefined ||
      (Array.isArray(attributes.supported_color_modes) &&
        attributes.supported_color_modes.some((m: string) => m !== 'onoff'));

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
            {isOn ? (supportsBrightness ? `Light is On (${brightness}%)` : 'Light is On') : 'Light is Off'}
          </div>
        </div>

        {/* Brightness Slider (only when dimming/brightness is supported by the entity) */}
        {supportsBrightness && (
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
        )}
      </div>
    );
  };

  const handleSelectFanSpeed = async (speed: FanSpeed) => {
    const previous = activeSpeed;
    setActiveSpeed(speed);
    try {
      if (speed === 'off') {
        await handleAction('fan', 'turn_off');
      } else {
        const pctMap: Record<'1' | '2' | '3' | '4', number> = {
          '1': 25,
          '2': 50,
          '3': 75,
          '4': 100,
        };
        const pct = pctMap[speed];

        const presetModes: string[] = Array.isArray(attributes.preset_modes) ? attributes.preset_modes : [];
        const matchingPreset = presetModes.find((m) => {
          const lower = m.toLowerCase();
          return (
            lower === speed ||
            lower === `speed ${speed}` ||
            (speed === '1' && lower.includes('low')) ||
            (speed === '4' && lower.includes('high'))
          );
        });

        if (matchingPreset) {
          await handleAction('fan', 'set_preset_mode', { preset_mode: matchingPreset });
        } else {
          await handleAction('fan', 'set_percentage', { percentage: pct });
        }
      }
    } catch (err) {
      setActiveSpeed(previous);
    }
  };

  const renderFanControls = () => {
    const isFanOn = activeSpeed !== 'off';

    const speedOptions: { id: FanSpeed; label: string; sub: string }[] = [
      { id: 'off', label: 'Off', sub: 'Stop' },
      { id: '1', label: '1', sub: 'Low' },
      { id: '2', label: '2', sub: 'Med' },
      { id: '3', label: '3', sub: 'Med-Hi' },
      { id: '4', label: '4', sub: 'High' },
    ];

    return (
      <div className="space-y-6">
        {/* Main Status Display */}
        <div className="glass-panel p-6 rounded-3xl border border-white/10 flex flex-col items-center justify-center text-center">
          <div
            className={`w-24 h-24 rounded-3xl flex items-center justify-center mb-3 shadow-xl transition-all ${
              isFanOn
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-cyan-500/10'
                : 'bg-white/10 text-slate-400 border border-white/10'
            }`}
          >
            <Fan
              className={`w-12 h-12 ${isFanOn ? 'animate-spin stroke-[2.5]' : ''}`}
              style={
                isFanOn
                  ? {
                      animationDuration:
                        activeSpeed === '1'
                          ? '3.0s'
                          : activeSpeed === '2'
                          ? '2.0s'
                          : activeSpeed === '3'
                          ? '1.2s'
                          : '0.7s',
                    }
                  : undefined
              }
            />
          </div>
          <div className="text-2xl font-black text-white capitalize">
            {activeSpeed === 'off' ? 'Fan is Off' : `Speed ${activeSpeed}`}
          </div>
          <p className="text-xs text-slate-400 mt-1">{displayName}</p>
        </div>

        {/* 4 Speeds + Off Selector */}
        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Speed Control (4 Speeds)
          </span>
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
            {speedOptions.map((opt) => {
              const isSelected = activeSpeed === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelectFanSpeed(opt.id)}
                  className={`p-2.5 sm:p-3.5 rounded-2xl border flex flex-col items-center justify-center gap-0.5 sm:gap-1 transition-all cursor-pointer ${
                    isSelected
                      ? opt.id === 'off'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 ring-2 ring-rose-500/20 font-bold'
                        : 'bg-cyan-500 text-slate-950 border-cyan-400 font-black shadow-lg shadow-cyan-500/25 scale-[1.03]'
                      : 'bg-white/5 text-slate-300 hover:text-white border-white/10 hover:bg-white/10'
                  }`}
                >
                  <span className="text-xs sm:text-sm font-bold">{opt.label}</span>
                  <span
                    className={`text-[9px] sm:text-[10px] ${
                      isSelected
                        ? opt.id === 'off'
                          ? 'text-rose-300/80'
                          : 'text-slate-900/80 font-semibold'
                        : 'text-slate-500'
                    }`}
                  >
                    {opt.sub}
                  </span>
                </button>
              );
            })}
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
        {domain === 'fan' && renderFanControls()}
        {domain === 'cover' && renderCoverControls()}
        {domain === 'lock' && renderLockControls()}
        {(domain === 'sensor' || domain === 'binary_sensor') && renderSensorDetails()}
        {domain === 'person' && renderPersonDetails()}

        {/* Fallback for other domains */}
        {domain !== 'climate' && domain !== 'light' && domain !== 'fan' && domain !== 'cover' && domain !== 'lock' && domain !== 'sensor' && domain !== 'binary_sensor' && domain !== 'person' && (
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
