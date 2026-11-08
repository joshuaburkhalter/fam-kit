import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Thermometer,
  Lock,
  Unlock,
  Lightbulb,
  ToggleLeft,
  ToggleRight,
  Power,
  ChevronRight,
  RefreshCw,
  Sliders,
  SlidersHorizontal,
  Plus,
  Shield,
  Activity,
  Sparkles,
  Zap,
  Check,
  Flame,
  Snowflake,
  Fan,
  Home,
  AlertCircle,
  Settings,
  Search,
} from 'lucide-react';
import { api } from '../lib/api';
import { usePWA } from '../context/PWAContext';
import { HomeAssistantEntity } from '../types';
import { EntityDetailDrawer } from '../components/smart-home/EntityDetailDrawer';
import { ManageControlsModal } from '../components/smart-home/ManageControlsModal';

export const SmartHomePage: React.FC = () => {
  const { household } = usePWA();
  const [entities, setEntities] = useState<HomeAssistantEntity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedEntityForDrawer, setSelectedEntityForDrawer] = useState<HomeAssistantEntity | null>(null);
  const [optimisticStates, setOptimisticStates] = useState<Record<string, string>>({});
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [triggeredButtons, setTriggeredButtons] = useState<Record<string, boolean>>({});
  const [visibleEntityIds, setVisibleEntityIds] = useState<string[]>([]);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);

  const loadConfig = useCallback(async () => {
    try {
      const cfg = await api.getHomeAssistantConfig();
      if (cfg?.visibleEntityIds && Array.isArray(cfg.visibleEntityIds)) {
        setVisibleEntityIds(cfg.visibleEntityIds);
      }
    } catch (err) {
      console.error('Failed to load HA config:', err);
    }
  }, []);

  const loadStates = useCallback(async (quiet = false) => {
    try {
      if (!quiet) setIsRefreshing(true);
      const res = await api.getHomeAssistantStates();
      setEntities(res.states || []);
      setErrorMessage(null);
    } catch (err: any) {
      console.error('Failed to load Home Assistant states:', err);
      if (!quiet) {
        setErrorMessage(err.message || 'Unable to connect to Home Assistant. Check your settings.');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch for fast first render
    loadStates(false);
    loadConfig();

    // Live WebSocket / SSE push connection to Home Assistant
    const eventsUrl = api.getHomeAssistantEventsUrl(household?.id);
    let eventSource: EventSource | null = null;

    try {
      eventSource = new EventSource(eventsUrl);

      eventSource.onopen = () => {
        setIsLiveConnected(true);
      };

      eventSource.addEventListener('status', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          if (data?.status === 'connected') {
            setIsLiveConnected(true);
            setErrorMessage(null);
          } else if (data?.status === 'auth_failed') {
            setIsLiveConnected(false);
            setErrorMessage('Home Assistant authentication failed. Check your Long-Lived Access Token in Settings.');
          } else if (data?.status === 'disconnected') {
            setIsLiveConnected(false);
          }
        } catch {}
      });

      // Real-time synchronization when any family member adds or removes controls
      eventSource.addEventListener('config_updated', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload?.visibleEntityIds && Array.isArray(payload.visibleEntityIds)) {
            setVisibleEntityIds(payload.visibleEntityIds);
          }
        } catch (err) {
          console.error('Failed to parse live config update:', err);
        }
      });

      eventSource.addEventListener('state_changed', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload?.entity) {
            const updated: HomeAssistantEntity = payload.entity;
            setEntities((prev) => {
              const index = prev.findIndex((item) => item.entity_id === updated.entity_id);
              if (index >= 0) {
                const next = [...prev];
                next[index] = updated;
                return next;
              } else {
                return [...prev, updated];
              }
            });

            // Reconcile optimistic override now that real device state has landed
            setOptimisticStates((prev) => {
              if (!prev[updated.entity_id]) return prev;
              const next = { ...prev };
              delete next[updated.entity_id];
              return next;
            });

            // Keep open drawer updated in real time
            setSelectedEntityForDrawer((current) => {
              if (current && current.entity_id === updated.entity_id) {
                return updated;
              }
              return current;
            });
          }
        } catch (err) {
          console.error('Failed to parse live Home Assistant update:', err);
        }
      });

      eventSource.onerror = () => {
        setIsLiveConnected(false);
      };
    } catch (err) {
      console.error('Failed to connect to live smart home stream:', err);
      setIsLiveConnected(false);
    }

    // Fallback background polling every 45 seconds (for mobile sleep recovery)
    const backupInterval = setInterval(() => {
      loadStates(true);
    }, 45000);

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      clearInterval(backupInterval);
    };
  }, [household?.id, loadStates]);

  const handleCallService = async (domain: string, service: string, serviceData: any) => {
    const entityId = serviceData?.entity_id;

    // Optimistic state flip for toggle actions
    if (entityId) {
      if (service === 'turn_on') {
        setOptimisticStates((prev) => ({ ...prev, [entityId]: 'on' }));
      } else if (service === 'turn_off') {
        setOptimisticStates((prev) => ({ ...prev, [entityId]: 'off' }));
      } else if (service === 'toggle') {
        const current = optimisticStates[entityId] || entities.find((e) => e.entity_id === entityId)?.state;
        setOptimisticStates((prev) => ({ ...prev, [entityId]: current === 'on' ? 'off' : 'on' }));
      } else if (service === 'lock') {
        setOptimisticStates((prev) => ({ ...prev, [entityId]: 'locked' }));
      } else if (service === 'unlock') {
        setOptimisticStates((prev) => ({ ...prev, [entityId]: 'unlocked' }));
      }
    }

    try {
      await api.callHomeAssistantService(domain, service, serviceData);
      // Re-fetch states shortly after service execution to ensure sync
      setTimeout(() => loadStates(true), 600);
    } catch (err: any) {
      // Revert optimistic state
      if (entityId) {
        setOptimisticStates((prev) => {
          const next = { ...prev };
          delete next[entityId];
          return next;
        });
      }
      throw err;
    }
  };

  // Quick single-tap handler for simple tiles
  const handleTileQuickAction = async (e: React.MouseEvent, entity: HomeAssistantEntity) => {
    e.stopPropagation();
    const currentState = optimisticStates[entity.entity_id] || entity.state;
    if (currentState === 'unavailable' || currentState === 'unknown') return;

    if (entity.domain === 'switch' || entity.domain === 'light') {
      const nextService = currentState === 'on' ? 'turn_off' : 'turn_on';
      await handleCallService(entity.domain, nextService, { entity_id: entity.entity_id });
    } else if (entity.domain === 'scene' || entity.domain === 'script') {
      await handleCallService(entity.domain, 'turn_on', { entity_id: entity.entity_id });
    } else if (entity.domain === 'button' || entity.domain === 'input_button') {
      setTriggeredButtons((prev) => ({ ...prev, [entity.entity_id]: true }));
      try {
        await handleCallService(entity.domain, 'press', { entity_id: entity.entity_id });
      } finally {
        setTimeout(() => {
          setTriggeredButtons((prev) => {
            const next = { ...prev };
            delete next[entity.entity_id];
            return next;
          });
        }, 1200);
      }
    } else if (entity.domain === 'lock') {
      // Toggle or pulse unlock
      const nextService = currentState === 'locked' ? 'unlock' : 'lock';
      await handleCallService('lock', nextService, { entity_id: entity.entity_id });
    }
  };

  // Entities chosen by the user to appear on the dashboard
  const activeEntities = useMemo(() => {
    if (visibleEntityIds.length === 0) return [];
    const visibleSet = new Set(visibleEntityIds);
    return entities.filter((e) => visibleSet.has(e.entity_id));
  }, [entities, visibleEntityIds]);

  // Helper to detect access-related entities (doors, locks, gates, intercom relays)
  const isAccessEntity = (e: HomeAssistantEntity) => {
    if (e.domain === 'lock' || e.domain === 'cover') return true;
    const s = (e.entity_id + ' ' + e.friendly_name).toLowerCase();
    return (
      (e.domain === 'button' || e.domain === 'input_button' || e.domain === 'switch') &&
      (s.includes('door') || s.includes('gate') || s.includes('lock') || s.includes('relay') || s.includes('verso') || s.includes('intercom') || s.includes('strike'))
    );
  };

  // Grouping categories based on active controls
  const categories = useMemo(() => {
    const cats = [
      { id: 'all', label: 'All', count: activeEntities.length },
      { id: 'access', label: 'Locks & Entry', count: activeEntities.filter(isAccessEntity).length },
      { id: 'lights', label: 'Lights', count: activeEntities.filter((e) => e.domain === 'light').length },
      { id: 'switches', label: 'Switches', count: activeEntities.filter((e) => e.domain === 'switch').length },
      { id: 'climate', label: 'Climate', count: activeEntities.filter((e) => e.domain === 'climate').length },
      { id: 'triggers', label: 'Triggers & Buttons', count: activeEntities.filter((e) => e.domain === 'button' || e.domain === 'input_button' || e.domain === 'scene' || e.domain === 'script').length },
      { id: 'sensors', label: 'Sensors', count: activeEntities.filter((e) => e.domain === 'sensor' || e.domain === 'binary_sensor').length },
    ];
    return cats.filter((c) => c.id === 'all' || c.count > 0);
  }, [activeEntities]);

  // Filtered entities on the dashboard
  const filteredEntities = useMemo(() => {
    return activeEntities.filter((entity) => {
      // Category filter
      if (selectedCategory === 'access' && !isAccessEntity(entity)) return false;
      if (selectedCategory === 'lights' && entity.domain !== 'light') return false;
      if (selectedCategory === 'switches' && entity.domain !== 'switch') return false;
      if (selectedCategory === 'climate' && entity.domain !== 'climate') return false;
      if (selectedCategory === 'triggers' && entity.domain !== 'button' && entity.domain !== 'input_button' && entity.domain !== 'scene' && entity.domain !== 'script') return false;
      if (selectedCategory === 'sensors' && entity.domain !== 'sensor' && entity.domain !== 'binary_sensor') return false;

      // Search filter
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
  }, [activeEntities, selectedCategory, searchQuery]);

  const handleSaveVisibleControls = async (newIds: string[]) => {
    setVisibleEntityIds(newIds);
    await api.saveHomeAssistantVisibleControls(newIds);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6 pb-24 md:pb-12 min-h-[calc(100vh-8rem)] flex flex-col w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Home className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                Home
              </h1>
              <p className="text-xs text-slate-400">
                {visibleEntityIds.length > 0 ? (
                  <span>{visibleEntityIds.length} active controls on dashboard • Home Assistant</span>
                ) : (
                  <span>Connected Smart Home • No controls added yet</span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Live WebSocket Status Badge */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-semibold transition-all border ${
              isLiveConnected
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25 shadow-sm shadow-emerald-500/10'
                : 'bg-white/5 text-slate-400 border-white/10'
            }`}
            title={
              isLiveConnected
                ? 'Live WebSocket Connected: devices update instantly in real time'
                : 'Connecting to Home Assistant WebSocket...'
            }
          >
            <span className="relative flex h-2 w-2">
              {isLiveConnected && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  isLiveConnected ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
                }`}
              />
            </span>
            <span className="text-[11px] font-bold">
              {isLiveConnected ? 'Live' : 'Connecting...'}
            </span>
          </div>

          {/* Manage Controls Button */}
          <button
            type="button"
            onClick={() => setIsManageModalOpen(true)}
            className="p-2 sm:px-3 sm:py-2 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-all flex items-center gap-2 text-xs font-semibold cursor-pointer"
            title="Add or remove controls from your dashboard"
          >
            <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">
              {visibleEntityIds.length === 0 ? 'Add Controls' : 'Manage Controls'}
            </span>
            {visibleEntityIds.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
                {visibleEntityIds.length}
              </span>
            )}
          </button>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => loadStates(false)}
            disabled={isRefreshing}
            className="p-2 sm:px-3 sm:py-2 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-all flex items-center gap-2 text-xs font-semibold cursor-pointer"
            title="Refresh device states"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
          <div className="flex-1">
            <span className="font-bold">Home Assistant Notice: </span>
            {errorMessage}
          </div>
          <button
            type="button"
            onClick={() => loadStates(false)}
            className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 font-bold transition-all cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Search & Category Filter Bar (only when controls are added) */}
      {visibleEntityIds.length > 0 && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search active lights, climate, locks, triggers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-900/60 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 transition-all"
            />
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedCategory === cat.id
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                    : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 border border-white/5'
                }`}
              >
                <span>{cat.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  selectedCategory === cat.id ? 'bg-slate-950/20 text-slate-950 font-black' : 'bg-white/10 text-slate-400'
                }`}>
                  {cat.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-32 rounded-3xl bg-white/5 border border-white/5 animate-pulse" />
          ))}
        </div>
      )}

      {/* Initial Zero-Controls State (Centered Vertically) */}
      {!isLoading && visibleEntityIds.length === 0 && (
        <div className="flex-1 flex items-center justify-center py-8 sm:py-16 animate-fade-in my-auto">
          <div className="glass-panel p-8 sm:p-12 rounded-3xl border border-white/10 text-center space-y-4 max-w-lg w-full shadow-2xl">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
              <SlidersHorizontal className="w-8 h-8" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-xl font-black text-white">Add Your Smart Home Controls</h3>
              <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
                Your Home Assistant is connected! Choose which controls (switches, door triggers, lights, locks, or sensors) you want to display for your family.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsManageModalOpen(true)}
              className="px-6 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-all shadow-xl shadow-emerald-500/20 cursor-pointer inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add Controls</span>
            </button>
          </div>
        </div>
      )}

      {/* Filtered Empty State (when controls exist but search or filter yields nothing) */}
      {!isLoading && visibleEntityIds.length > 0 && filteredEntities.length === 0 && (
        <div className="glass-panel p-10 rounded-3xl border border-white/10 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-white/5 text-slate-400 flex items-center justify-center mx-auto">
            <Sliders className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">No matching controls</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {searchQuery
              ? 'No smart home devices matched your search query.'
              : 'No devices found under this category filter.'}
          </p>
          <button
            type="button"
            onClick={() => setIsManageModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400" />
            <span>Manage Controls</span>
          </button>
        </div>
      )}

      {/* Tiles Grid: 4 wide on desktop, 2 wide on mobile */}
      {!isLoading && filteredEntities.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {filteredEntities.map((entity) => {
            const currentEffectiveState = optimisticStates[entity.entity_id] || entity.state;
            const isUnavailable = currentEffectiveState === 'unavailable' || currentEffectiveState === 'unknown';
            const isOn = currentEffectiveState === 'on';
            const isLocked = currentEffectiveState === 'locked';
            const isClosed = currentEffectiveState === 'closed';
            const isTriggered = Boolean(triggeredButtons[entity.entity_id]);

            // Determine tile visual style and icon based on domain and state
            let iconComponent = <Sliders className="w-5 h-5" />;
            let stateDisplay = isUnavailable ? 'Unavailable' : currentEffectiveState;
            let tileBg = 'bg-slate-900/60 border-white/10 hover:border-white/20';
            let iconBg = 'bg-white/5 text-slate-400';

            if (entity.domain === 'climate') {
              const currentTemp = entity.attributes.current_temperature;
              const targetTemp = entity.attributes.temperature;
              const hvacAction = entity.attributes.hvac_action;

              iconComponent = hvacAction === 'cooling' ? (
                <Snowflake className="w-5 h-5 text-cyan-400" />
              ) : (
                <Flame className="w-5 h-5 text-amber-400" />
              );

              stateDisplay = targetTemp ? `${Math.round(targetTemp)}° • ${currentEffectiveState}` : currentEffectiveState;
              if (currentTemp) {
                stateDisplay = `${Math.round(currentTemp)}° (${stateDisplay})`;
              }

              tileBg = 'bg-gradient-to-b from-slate-900/80 to-slate-950/80 border-white/10 hover:border-white/25';
              iconBg = 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
            } else if (entity.domain === 'light') {
              iconComponent = <Lightbulb className={`w-5 h-5 ${isOn ? 'fill-amber-400 text-amber-400' : 'text-slate-400'}`} />;
              if (isOn) {
                const bVal = entity.attributes.brightness
                  ? Math.round((entity.attributes.brightness / 255) * 100)
                  : null;
                stateDisplay = bVal ? `On (${bVal}%)` : 'On';
                tileBg = 'bg-gradient-to-b from-amber-500/15 to-slate-900/80 border-amber-500/30 hover:border-amber-400/50 shadow-lg shadow-amber-500/5';
                iconBg = 'bg-amber-400/20 text-amber-300 ring-2 ring-amber-400/30';
              } else {
                stateDisplay = 'Off';
              }
            } else if (entity.domain === 'switch') {
              iconComponent = <Power className={`w-5 h-5 ${isOn ? 'text-emerald-400' : 'text-slate-400'}`} />;
              if (isOn) {
                stateDisplay = 'On';
                tileBg = 'bg-gradient-to-b from-emerald-500/15 to-slate-900/80 border-emerald-500/30 hover:border-emerald-400/50 shadow-lg shadow-emerald-500/5';
                iconBg = 'bg-emerald-400/20 text-emerald-300 ring-2 ring-emerald-400/30';
              } else {
                stateDisplay = 'Off';
              }
            } else if (entity.domain === 'lock') {
              if (isUnavailable) {
                iconComponent = <Lock className="w-5 h-5 text-slate-500" />;
                stateDisplay = 'Offline / Unavailable';
                tileBg = 'bg-slate-900/40 border-white/5 opacity-60 hover:opacity-85';
                iconBg = 'bg-white/5 text-slate-500';
              } else if (isLocked) {
                iconComponent = <Lock className="w-5 h-5 text-emerald-400" />;
                stateDisplay = 'Locked';
                tileBg = 'bg-slate-900/60 border-emerald-500/20 hover:border-emerald-500/40';
                iconBg = 'bg-emerald-500/15 text-emerald-400';
              } else {
                iconComponent = <Unlock className="w-5 h-5 text-rose-400" />;
                stateDisplay = currentEffectiveState === 'open' ? 'Open' : 'Unlocked';
                tileBg = 'bg-rose-500/10 border-rose-500/30 hover:border-rose-500/50 shadow-lg shadow-rose-500/5';
                iconBg = 'bg-rose-500/20 text-rose-400 ring-2 ring-rose-500/30';
              }
            } else if (entity.domain === 'button' || entity.domain === 'input_button') {
              iconComponent = isTriggered ? <Check className="w-5 h-5 text-emerald-300" /> : <Zap className="w-5 h-5 text-amber-400" />;
              if (isUnavailable) {
                stateDisplay = 'Offline';
                tileBg = 'bg-slate-900/40 border-white/5 opacity-60';
                iconBg = 'bg-white/5 text-slate-500';
              } else if (isTriggered) {
                stateDisplay = 'Triggered!';
                tileBg = 'bg-emerald-500/15 border-emerald-500/35 shadow-lg shadow-emerald-500/10';
                iconBg = 'bg-emerald-500/20 text-emerald-300 ring-2 ring-emerald-500/30';
              } else {
                stateDisplay = 'Tap to Trigger';
                tileBg = 'bg-slate-900/60 border-amber-500/20 hover:border-amber-500/40 hover:bg-slate-900/80';
                iconBg = 'bg-amber-500/15 text-amber-400';
              }
            } else if (entity.domain === 'cover') {
              iconComponent = <Shield className="w-5 h-5 text-blue-400" />;
              stateDisplay = isClosed ? 'Closed' : currentEffectiveState;
              tileBg = 'bg-slate-900/60 border-white/10 hover:border-white/25';
              iconBg = 'bg-blue-500/15 text-blue-400';
            } else if (entity.domain === 'scene' || entity.domain === 'script') {
              iconComponent = <Sparkles className="w-5 h-5 text-purple-400" />;
              stateDisplay = 'Tap to Activate';
              tileBg = 'bg-slate-900/60 border-purple-500/20 hover:border-purple-500/40';
              iconBg = 'bg-purple-500/15 text-purple-400';
            } else if (entity.domain === 'sensor' || entity.domain === 'binary_sensor') {
              iconComponent = <Activity className="w-5 h-5 text-cyan-400" />;
              const unit = entity.attributes.unit_of_measurement || '';
              stateDisplay = `${currentEffectiveState} ${unit}`.trim();
              tileBg = 'bg-slate-900/60 border-white/10 hover:border-white/20';
              iconBg = 'bg-cyan-500/15 text-cyan-400';
            }

            return (
              <div
                key={entity.entity_id}
                onClick={() => {
                  if (entity.needsDrawer) {
                    setSelectedEntityForDrawer(entity);
                  } else {
                    // For single-action buttons, tile click toggles directly
                    handleTileQuickAction({ stopPropagation: () => {} } as any, entity);
                  }
                }}
                className={`p-4 rounded-3xl border transition-all duration-200 cursor-pointer flex flex-col justify-between select-none relative group ${tileBg}`}
              >
                {/* Top Row: Icon + Right Arrow (if needsDrawer) OR Toggle Button */}
                <div className="flex items-center justify-between gap-2">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-all ${iconBg}`}>
                    {iconComponent}
                  </div>

                  {/* Multi-button control: Show Arrow pointing right */}
                  {entity.needsDrawer ? (
                    <div className="w-7 h-7 rounded-full bg-white/5 group-hover:bg-white/15 flex items-center justify-center text-slate-400 group-hover:text-white transition-all shrink-0">
                      <ChevronRight className="w-4 h-4 stroke-[2.5]" />
                    </div>
                  ) : (entity.domain === 'button' || entity.domain === 'input_button') ? (
                    /* Momentary trigger button */
                    <button
                      type="button"
                      disabled={isUnavailable}
                      onClick={(e) => handleTileQuickAction(e, entity)}
                      className={`px-2.5 py-1 rounded-xl border text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                        isUnavailable
                          ? 'opacity-30 bg-white/5 border-white/5 text-slate-500 cursor-not-allowed'
                          : isTriggered
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/20 font-black'
                          : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30'
                      }`}
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>{isTriggered ? 'Triggered' : 'Press'}</span>
                    </button>
                  ) : (
                    /* Single action toggle button */
                    <button
                      type="button"
                      disabled={isUnavailable}
                      onClick={(e) => handleTileQuickAction(e, entity)}
                      className={`p-1 rounded-xl hover:bg-white/10 transition-all cursor-pointer shrink-0 ${
                        isUnavailable ? 'opacity-30 cursor-not-allowed text-slate-600' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {isOn ? (
                        <ToggleRight className="w-7 h-7 text-emerald-400" />
                      ) : (
                        <ToggleLeft className="w-7 h-7 text-slate-500" />
                      )}
                    </button>
                  )}
                </div>

                {/* Bottom Info: Friendly Name and Live State */}
                <div className="pt-3 min-w-0">
                  <h4 className="text-xs font-bold text-white truncate block group-hover:text-emerald-300 transition-colors">
                    {entity.friendly_name}
                  </h4>
                  <div className="text-[11px] font-medium text-slate-400 truncate mt-0.5 capitalize">
                    {stateDisplay}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Slide Drawer from the Right Side for Multi-Button Controls */}
      <EntityDetailDrawer
        isOpen={Boolean(selectedEntityForDrawer)}
        entity={selectedEntityForDrawer}
        onClose={() => setSelectedEntityForDrawer(null)}
        onCallService={handleCallService}
      />

      {/* Manage / Show-Hide Controls Modal */}
      <ManageControlsModal
        isOpen={isManageModalOpen}
        onClose={() => setIsManageModalOpen(false)}
        allEntities={entities}
        initialVisibleIds={visibleEntityIds}
        onSave={handleSaveVisibleControls}
      />
    </div>
  );
};
