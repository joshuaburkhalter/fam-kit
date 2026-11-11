import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Gauge,
  Lock,
  Unlock,
  Lightbulb,
  ToggleLeft,
  ToggleRight,
  Power,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Sliders,
  SlidersHorizontal,
  Plus,
  Warehouse,
  Blinds,
  Activity,
  Sparkles,
  Zap,
  Check,
  Flame,
  Snowflake,
  Fan,
  RotateCcw,
  Thermometer,
  Settings,
  Search,
  User,
  Droplets,
  Battery,
  DoorClosed,
  DoorOpen,
} from 'lucide-react';
import { api } from '../lib/api';
import { usePWA } from '../context/PWAContext';
import { HomeAssistantEntity } from '../types';
import { EntityDetailDrawer } from '../components/smart-home/EntityDetailDrawer';
import { ManageControlsModal } from '../components/smart-home/ManageControlsModal';
import { EditEntityModal, getCustomIconComponent } from '../components/smart-home/EditEntityModal';
import { EntityCustomization } from '../types';
import { useRegisterFab } from '../context/ActionFabContext';

export const isDataOnlyEntity = (e: HomeAssistantEntity): boolean => {
  return e.domain === 'sensor' || e.domain === 'binary_sensor' || e.domain === 'person';
};

const CONTROL_GROUPS = [
  { id: 'climate', title: 'Climate', icon: Gauge, iconColor: 'bg-amber-500/15 text-amber-400', match: (e: HomeAssistantEntity) => e.domain === 'climate' },
  { id: 'lights', title: 'Lights', icon: Lightbulb, iconColor: 'bg-amber-400/15 text-amber-400', match: (e: HomeAssistantEntity) => e.domain === 'light' },
  { id: 'locks', title: 'Locks', icon: Lock, iconColor: 'bg-emerald-500/15 text-emerald-400', match: (e: HomeAssistantEntity) => e.domain === 'lock' },
  { id: 'covers', title: 'Covers & Doors', icon: Warehouse, iconColor: 'bg-blue-500/15 text-blue-400', match: (e: HomeAssistantEntity) => e.domain === 'cover' },
  { id: 'switches', title: 'Switches', icon: Power, iconColor: 'bg-emerald-500/15 text-emerald-400', match: (e: HomeAssistantEntity) => e.domain === 'switch' },
  { id: 'fans', title: 'Fans', icon: Fan, iconColor: 'bg-cyan-500/15 text-cyan-400', match: (e: HomeAssistantEntity) => e.domain === 'fan' },
  { id: 'triggers', title: 'Triggers & Scenes', icon: Zap, iconColor: 'bg-amber-500/15 text-amber-400', match: (e: HomeAssistantEntity) => ['button', 'input_button', 'scene', 'script'].includes(e.domain) },
  { id: 'media', title: 'Media Players', icon: Sliders, iconColor: 'bg-indigo-500/15 text-indigo-400', match: (e: HomeAssistantEntity) => e.domain === 'media_player' },
  { id: 'other', title: 'Other Controls', icon: Sliders, iconColor: 'bg-slate-800 text-slate-300', match: (e: HomeAssistantEntity) => !['climate', 'light', 'lock', 'cover', 'switch', 'fan', 'button', 'input_button', 'scene', 'script', 'media_player'].includes(e.domain) },
];


const PersonAvatar: React.FC<{ entity: HomeAssistantEntity; householdId?: string; customName?: string }> = ({ entity, householdId, customName }) => {
  const [imgError, setImgError] = useState(false);
  const photo = entity.attributes?.entity_picture;
  const isHome = (entity.state || '').toLowerCase() === 'home';
  const name = customName || entity.friendly_name || '';

  const photoUrl = photo && !imgError ? api.getHomeAssistantImageUrl(photo, householdId) : null;

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        onError={() => setImgError(true)}
        className="w-5 h-5 rounded-full object-cover ring-1 ring-emerald-400/40"
      />
    );
  }

  return (
    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
      isHome ? 'bg-emerald-500/30 text-emerald-300' : 'bg-slate-700/60 text-slate-300'
    }`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
};

const GhostSmartHomeSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-pulse select-none pointer-events-none">
      {/* Ghost Statuses (Sensors & Status Row) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-cyan-500/15 flex items-center justify-center shrink-0">
              <Activity className="w-3.5 h-3.5 text-cyan-400/50" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400/80">
                Sensors & Status
              </span>
              <div className="w-6 h-4 rounded-full bg-white/10" />
            </div>
          </div>
        </div>

        {/* Horizontal Ghost Status Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 px-0.5">
          {[
            { w1: 'w-16', w2: 'w-10' },
            { w1: 'w-20', w2: 'w-12' },
            { w1: 'w-14', w2: 'w-8' },
            { w1: 'w-18', w2: 'w-11' },
          ].map((pill, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 px-3 py-1.5 sm:py-2 rounded-2xl bg-slate-900/60 border border-white/5 shrink-0 shadow-sm"
            >
              <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center shrink-0" />
              <div className="min-w-0 pr-1 space-y-1.5">
                <div className={`h-2.5 ${pill.w1} bg-white/20 rounded`} />
                <div className={`h-2 ${pill.w2} bg-white/10 rounded`} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Ghost Carousels for Controls */}
      <div className="space-y-6">
        {[
          { titleWidth: 'w-20', iconBg: 'bg-amber-500/15', count: 3 },
          { titleWidth: 'w-24', iconBg: 'bg-emerald-500/15', count: 4 },
        ].map((group, gIdx) => (
          <div key={gIdx} className="space-y-2">
            {/* Ghost Carousel Header */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-lg ${group.iconBg} flex items-center justify-center shrink-0`}>
                  <SlidersHorizontal className="w-3.5 h-3.5 text-white/30" />
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={`h-3.5 ${group.titleWidth} bg-white/20 rounded-md`} />
                  <div className="w-5 h-3.5 bg-white/10 rounded-full" />
                </div>
              </div>
            </div>

            {/* Horizontal Track of Ghost Control Cards */}
            <div className="flex gap-2.5 sm:gap-3.5 overflow-x-auto no-scrollbar py-1 px-0.5">
              {Array.from({ length: group.count }).map((_, cIdx) => (
                <div
                  key={cIdx}
                  className="w-[155px] sm:w-[195px] shrink-0"
                >
                  <div className="p-3 sm:p-4 rounded-2xl sm:rounded-3xl border border-white/5 bg-slate-900/60 min-h-[5.5rem] sm:min-h-[7.5rem] flex flex-col justify-between shadow-sm">
                    {/* Top Row: Ghost Icon + Ghost Action Button */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-white/10" />
                      <div className="w-6 h-6 rounded-full bg-white/5" />
                    </div>

                    {/* Bottom Area: Device Name & Status */}
                    <div className="space-y-1.5 mt-2">
                      <div className="h-3 w-3/4 bg-white/20 rounded-md" />
                      <div className="h-2.5 w-1/2 bg-white/10 rounded-md" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Module-level cache for instant zero-latency page transitions
interface SmartHomeCache {
  householdId: string;
  entities: HomeAssistantEntity[];
  visibleEntityIds: string[];
  entityCustomizations: Record<string, EntityCustomization>;
}

let smartHomeCache: SmartHomeCache | null = null;

export const clearSmartHomeCache = () => {
  smartHomeCache = null;
};

export const SmartHomePage: React.FC = () => {
  const { household } = usePWA();
  const [entities, setEntities] = useState<HomeAssistantEntity[]>(() => {
    if (smartHomeCache && household && smartHomeCache.householdId === household.id) {
      return smartHomeCache.entities;
    }
    return [];
  });
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    return Boolean(!smartHomeCache || (household && smartHomeCache.householdId !== household.id));
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedEntityForDrawer, setSelectedEntityForDrawer] = useState<HomeAssistantEntity | null>(null);

  const activeDrawerEntity = useMemo(() => {
    if (!selectedEntityForDrawer) return null;
    return entities.find((e) => e.entity_id === selectedEntityForDrawer.entity_id) || selectedEntityForDrawer;
  }, [selectedEntityForDrawer, entities]);
  const [optimisticStates, setOptimisticStates] = useState<Record<string, string>>({});
  const [isLiveConnected, setIsLiveConnected] = useState(true);
  const [hasConnectionError, setHasConnectionError] = useState(false);
  const [triggeredButtons, setTriggeredButtons] = useState<Record<string, boolean>>({});
  const [visibleEntityIds, setVisibleEntityIds] = useState<string[]>(() => {
    return smartHomeCache?.visibleEntityIds || [];
  });
  const [entityCustomizations, setEntityCustomizations] = useState<Record<string, EntityCustomization>>(() => {
    return smartHomeCache?.entityCustomizations || {};
  });
  const [editingEntity, setEditingEntity] = useState<HomeAssistantEntity | null>(null);

  // Long press tracking refs
  const longPressTimerRef = useRef<any>(null);
  const isLongPressActiveRef = useRef<boolean>(false);
  const touchStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);

  const loadConfig = useCallback(async () => {
    try {
      const cfg = await api.getHomeAssistantConfig();
      if (cfg?.visibleEntityIds && Array.isArray(cfg.visibleEntityIds)) {
        setVisibleEntityIds(cfg.visibleEntityIds);
        if (smartHomeCache) smartHomeCache.visibleEntityIds = cfg.visibleEntityIds;
      }
      if (cfg?.entityCustomizations && typeof cfg.entityCustomizations === 'object') {
        setEntityCustomizations(cfg.entityCustomizations);
        if (smartHomeCache) smartHomeCache.entityCustomizations = cfg.entityCustomizations;
      }
    } catch (err) {
      console.error('Failed to load HA config:', err);
    }
  }, []);

  const loadStates = useCallback(async (quiet = false) => {
    try {
      if (!quiet && !smartHomeCache) setIsRefreshing(true);
      const res = await api.getHomeAssistantStates();
      const loadedStates = res.states || [];
      setEntities(loadedStates);
      setIsLiveConnected(true);
      setHasConnectionError(false);
      if (household?.id) {
        smartHomeCache = {
          householdId: household.id,
          entities: loadedStates,
          visibleEntityIds: smartHomeCache?.visibleEntityIds || [],
          entityCustomizations: smartHomeCache?.entityCustomizations || {},
        };
      }
    } catch (err: any) {
      console.warn('Failed to load Home Assistant states:', err?.message || err);
      setIsLiveConnected(false);
      setEntities((currentEntities) => {
        if (!currentEntities || currentEntities.length === 0) {
          setHasConnectionError(true);
        }
        return currentEntities;
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [household?.id]);

  // Register bottom speed-dial FAB actions for Control (home)
  useRegisterFab(
    'home',
    useMemo(
      () => ({
        pillLabel: 'Manage',
        icon: SlidersHorizontal,
        actions: [
          {
            id: 'edit-controls',
            label: 'Edit Controls',
            description: visibleEntityIds.length > 0 ? `${visibleEntityIds.length} on dashboard` : 'Add or remove devices',
            icon: SlidersHorizontal,
            color: 'emerald',
            onClick: () => setIsManageModalOpen(true),
          },
          {
            id: 'refresh-controls',
            label: 'Refresh Devices',
            description: 'Sync latest states',
            icon: RefreshCw,
            color: 'teal',
            onClick: () => loadStates(false),
          },
        ],
      }),
      [visibleEntityIds.length, loadStates]
    ),
    [visibleEntityIds.length, loadStates]
  );

  // Global action dispatcher listener for Smart Home actions
  useEffect(() => {
    const handleAction = (e: any) => {
      if (e.detail === 'edit-controls') setIsManageModalOpen(true);
      if (e.detail === 'refresh-controls') loadStates(false);
    };
    window.addEventListener('famkit:action', handleAction as EventListener);
    return () => window.removeEventListener('famkit:action', handleAction as EventListener);
  }, [loadStates]);

  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false);
  const optionsMenuRef = useRef<HTMLDivElement>(null);

  // Close options dropdown on outside click or Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (optionsMenuRef.current && !optionsMenuRef.current.contains(event.target as Node)) {
        setIsOptionsMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOptionsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    // Initial fetch for fast first render
    loadStates(false);
    loadConfig();

    // Live WebSocket / SSE push connection to Home Assistant
    const eventsUrl = api.getHomeAssistantEventsUrl(household?.id);
    let eventSource: EventSource | null = null;
    let disconnectTimer: any = null;

    const clearDisconnectTimer = () => {
      if (disconnectTimer) {
        clearTimeout(disconnectTimer);
        disconnectTimer = null;
      }
    };

    const scheduleDisconnectError = (delayMs = 4000) => {
      clearDisconnectTimer();
      disconnectTimer = setTimeout(() => {
        setHasConnectionError(true);
      }, delayMs);
    };

    try {
      eventSource = new EventSource(eventsUrl);

      eventSource.addEventListener('status', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          if (data?.status === 'connected') {
            clearDisconnectTimer();
            setIsLiveConnected(true);
            setHasConnectionError(false);
          } else if (data?.status === 'auth_failed') {
            clearDisconnectTimer();
            setIsLiveConnected(false);
            setHasConnectionError(true);
          } else if (data?.status === 'disconnected') {
            setIsLiveConnected(false);
            // Debounce transient reconnections: only flag error if disconnected for > 4s
            scheduleDisconnectError(4000);
          } else if (data?.status === 'connecting') {
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
          if (payload?.entityCustomizations && typeof payload.entityCustomizations === 'object') {
            setEntityCustomizations(payload.entityCustomizations);
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
        scheduleDisconnectError(4000);
      };
    } catch (err) {
      console.error('Failed to connect to live smart home stream:', err);
      setIsLiveConnected(false);
      scheduleDisconnectError(4000);
    }

    // Fallback background polling every 45 seconds (for mobile sleep recovery)
    const backupInterval = setInterval(() => {
      loadStates(true);
    }, 45000);

    return () => {
      clearDisconnectTimer();
      if (eventSource) {
        eventSource.close();
      }
      clearInterval(backupInterval);
    };
  }, [household?.id, loadStates, loadConfig]);

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
      } else if (service === 'set_hvac_mode' && serviceData.hvac_mode) {
        setOptimisticStates((prev) => ({ ...prev, [entityId]: serviceData.hvac_mode }));
      } else if (service === 'set_temperature' && serviceData.hvac_mode) {
        setOptimisticStates((prev) => ({ ...prev, [entityId]: serviceData.hvac_mode }));
      }
    }

    try {
      await api.callHomeAssistantService(domain, service, serviceData);
      setTimeout(() => loadStates(true), 600);
    } catch (err: any) {
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

    if (entity.domain === 'switch' || entity.domain === 'light' || entity.domain === 'fan') {
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
      const nextService = currentState === 'locked' ? 'unlock' : 'lock';
      await handleCallService('lock', nextService, { entity_id: entity.entity_id });
    }
  };


  const handleTouchStart = (entity: HomeAssistantEntity, e: React.TouchEvent | React.MouseEvent) => {
    isLongPressActiveRef.current = false;
    if ('touches' in e && e.touches[0]) {
      touchStartPosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if ('clientX' in e) {
      touchStartPosRef.current = { x: (e as React.MouseEvent).clientX, y: (e as React.MouseEvent).clientY };
    }

    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);

    longPressTimerRef.current = setTimeout(() => {
      isLongPressActiveRef.current = true;
      try {
        if (navigator.vibrate) navigator.vibrate(40);
      } catch {}
      setEditingEntity(entity);
    }, 450);
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!longPressTimerRef.current) return;
    let currentX = 0;
    let currentY = 0;
    if ('touches' in e && e.touches[0]) {
      currentX = e.touches[0].clientX;
      currentY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      currentX = (e as React.MouseEvent).clientX;
      currentY = (e as React.MouseEvent).clientY;
    }
    const dx = Math.abs(currentX - touchStartPosRef.current.x);
    const dy = Math.abs(currentY - touchStartPosRef.current.y);
    if (dx > 10 || dy > 10) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleSaveCustomization = async (entityId: string, custom: EntityCustomization | null) => {
    setEntityCustomizations((prev) => {
      const next = { ...prev };
      if (!custom) {
        delete next[entityId];
      } else {
        next[entityId] = custom;
      }
      return next;
    });

    await api.saveHomeAssistantEntityCustomization(entityId, custom);
  };

  // Entities chosen by the user to appear on the dashboard (preserves visibleEntityIds order)
  const activeEntities = useMemo(() => {
    if (visibleEntityIds.length === 0) return [];
    const entityMap = new Map(entities.map((e) => [e.entity_id, e]));
    return visibleEntityIds
      .map((id) => entityMap.get(id))
      .filter((e): e is HomeAssistantEntity => Boolean(e));
  }, [entities, visibleEntityIds]);

  // Data-only entities (sensors, binary sensors, presence)
  const activeDataEntities = useMemo(() => {
    return activeEntities.filter(isDataOnlyEntity).filter((entity) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const customName = entityCustomizations[entity.entity_id]?.name || entity.friendly_name;
      return (
        customName.toLowerCase().includes(q) ||
        entity.entity_id.toLowerCase().includes(q) ||
        entity.domain.toLowerCase().includes(q)
      );
    });
  }, [activeEntities, searchQuery, entityCustomizations]);

  // Interactive controls
  const activeControlEntities = useMemo(() => {
    return activeEntities.filter((e) => !isDataOnlyEntity(e));
  }, [activeEntities]);

  // Grouped controls for carousels
  const controlGroupsWithEntities = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return CONTROL_GROUPS.map((group) => {
      // Category filter
      if (selectedCategory !== 'all' && selectedCategory !== group.id) {
        return { ...group, entities: [] };
      }

      const matching = activeControlEntities.filter((e) => {
        const custom = entityCustomizations[e.entity_id];
        // If customized category exists, check if it matches this group
        if (custom?.category) {
          if (custom.category !== group.id) return false;
        } else {
          if (!group.match(e)) return false;
        }

        if (q) {
          const effectiveName = (custom?.name || e.friendly_name).toLowerCase();
          return (
            effectiveName.includes(q) ||
            e.entity_id.toLowerCase().includes(q) ||
            e.domain.toLowerCase().includes(q)
          );
        }
        return true;
      });

      return {
        ...group,
        entities: matching,
      };
    }).filter((g) => g.entities.length > 0);
  }, [activeControlEntities, selectedCategory, searchQuery, entityCustomizations]);

  // Categories for the filter bar
  const categories = useMemo(() => {
    return [
      { id: 'all', label: 'All Controls', count: activeControlEntities.length },
      ...CONTROL_GROUPS.map((g) => ({
        id: g.id,
        label: g.title,
        count: activeControlEntities.filter((e) => {
          const custom = entityCustomizations[e.entity_id];
          if (custom?.category) return custom.category === g.id;
          return g.match(e);
        }).length,
      })).filter((c) => c.count > 0),
    ];
  }, [activeControlEntities, entityCustomizations]);

  const handleSaveVisibleControls = async (newIds: string[]) => {
    setVisibleEntityIds(newIds);
    await api.saveHomeAssistantVisibleControls(newIds);
  };

  // Helper for sensor formatting in the top sensor row
  const getSensorDisplay = (entity: HomeAssistantEntity, effectiveState: string) => {
    const isUnavailable = effectiveState === 'unavailable' || effectiveState === 'unknown';
    const s = (entity.entity_id + ' ' + entity.friendly_name).toLowerCase();
    const dc = (entity.attributes?.device_class || '').toLowerCase();

    if (entity.domain === 'person') {
      const isHome = effectiveState === 'home';
      const custom = entityCustomizations[entity.entity_id];
      const icon = <PersonAvatar entity={entity} householdId={household?.id} customName={custom?.name} />;
      const color = isHome ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700/50 text-slate-400';
      const displayState = isHome ? 'Home' : effectiveState === 'not_home' ? 'Away' : effectiveState;
      return { icon, color, displayState };
    }

    if (dc === 'temperature' || s.includes('temp')) {
      const unit = entity.attributes?.unit_of_measurement || '°';
      return {
        icon: <Gauge className="w-3.5 h-3.5" />,
        color: 'bg-amber-500/15 text-amber-400',
        displayState: isUnavailable ? 'Offline' : `${effectiveState}${unit}`,
      };
    }

    if (dc === 'humidity' || s.includes('humidity')) {
      return {
        icon: <Droplets className="w-3.5 h-3.5" />,
        color: 'bg-cyan-500/15 text-cyan-400',
        displayState: isUnavailable ? 'Offline' : `${effectiveState}%`,
      };
    }

    if (dc === 'power' || dc === 'energy' || s.includes('power') || s.includes('watt')) {
      const unit = entity.attributes?.unit_of_measurement || 'W';
      return {
        icon: <Zap className="w-3.5 h-3.5" />,
        color: 'bg-amber-500/15 text-amber-400',
        displayState: isUnavailable ? 'Offline' : `${effectiveState} ${unit}`,
      };
    }

    if (dc === 'battery' || s.includes('battery')) {
      return {
        icon: <Battery className="w-3.5 h-3.5" />,
        color: 'bg-emerald-500/15 text-emerald-400',
        displayState: isUnavailable ? 'Offline' : `${effectiveState}%`,
      };
    }

    if (dc === 'door' || dc === 'window' || dc === 'garage_door' || s.includes('door') || s.includes('window') || s.includes('contact')) {
      const isOpen = effectiveState === 'on' || effectiveState === 'open';
      return {
        icon: isOpen ? <DoorOpen className="w-3.5 h-3.5" /> : <DoorClosed className="w-3.5 h-3.5" />,
        color: isOpen ? 'bg-rose-500/15 text-rose-400' : 'bg-emerald-500/15 text-emerald-400',
        displayState: isUnavailable ? 'Offline' : isOpen ? 'Open' : 'Closed',
      };
    }

    const unit = entity.attributes?.unit_of_measurement || '';
    return {
      icon: <Activity className="w-3.5 h-3.5" />,
      color: 'bg-cyan-500/15 text-cyan-400',
      displayState: isUnavailable ? 'Offline' : `${effectiveState} ${unit}`.trim(),
    };
  };

  // Compute position of entity currently being customized in its row
  const editingEntityPositionInfo = useMemo(() => {
    if (!editingEntity) return undefined;
    if (isDataOnlyEntity(editingEntity)) {
      const idx = activeDataEntities.findIndex((e) => e.entity_id === editingEntity.entity_id);
      if (idx === -1) return undefined;
      return {
        index: idx,
        total: activeDataEntities.length,
        groupTitle: 'Sensors & Status',
      };
    }

    for (const group of controlGroupsWithEntities) {
      const idx = group.entities.findIndex((e) => e.entity_id === editingEntity.entity_id);
      if (idx !== -1) {
        return {
          index: idx,
          total: group.entities.length,
          groupTitle: group.title,
        };
      }
    }
    return undefined;
  }, [editingEntity, activeDataEntities, controlGroupsWithEntities]);

  // Handle re-ordering entity within its carousel row
  const handleReorderEntity = async (direction: 'front' | 'left' | 'right' | 'end') => {
    if (!editingEntity) return;
    const entityId = editingEntity.entity_id;

    // 1. Identify peer entity IDs in the same row
    let peers: string[] = [];
    const isData = activeDataEntities.some((e) => e.entity_id === entityId);
    if (isData) {
      peers = activeDataEntities.map((e) => e.entity_id);
    } else {
      for (const group of controlGroupsWithEntities) {
        if (group.entities.some((e) => e.entity_id === entityId)) {
          peers = group.entities.map((e) => e.entity_id);
          break;
        }
      }
    }

    const peerIndex = peers.indexOf(entityId);
    if (peerIndex === -1 || peers.length <= 1) return;

    let targetPeerId: string | null = null;
    let insertBefore = true;

    if (direction === 'left') {
      if (peerIndex === 0) return;
      targetPeerId = peers[peerIndex - 1];
      insertBefore = true;
    } else if (direction === 'right') {
      if (peerIndex === peers.length - 1) return;
      targetPeerId = peers[peerIndex + 1];
      insertBefore = false;
    } else if (direction === 'front') {
      if (peerIndex === 0) return;
      targetPeerId = peers[0];
      insertBefore = true;
    } else if (direction === 'end') {
      if (peerIndex === peers.length - 1) return;
      targetPeerId = peers[peers.length - 1];
      insertBefore = false;
    }

    if (!targetPeerId || targetPeerId === entityId) return;

    // 2. Reorder in visibleEntityIds
    const nextVisibleIds = visibleEntityIds.filter((id) => id !== entityId);
    const targetIndex = nextVisibleIds.indexOf(targetPeerId);
    if (targetIndex === -1) return;

    const insertIndex = insertBefore ? targetIndex : targetIndex + 1;
    nextVisibleIds.splice(insertIndex, 0, entityId);

    // 3. Save & update
    setVisibleEntityIds(nextVisibleIds);
    await api.saveHomeAssistantVisibleControls(nextVisibleIds);
  };

  // Render a compact control tile inside a carousel
  const renderControlTile = (entity: HomeAssistantEntity) => {
    const custom = entityCustomizations[entity.entity_id];
    const displayName = custom?.name || entity.friendly_name;
    const CustomIcon = getCustomIconComponent(custom?.icon);
    const currentEffectiveState = optimisticStates[entity.entity_id] || entity.state;
    const isUnavailable = currentEffectiveState === 'unavailable' || currentEffectiveState === 'unknown';
    const isOn = currentEffectiveState === 'on';
    const isLocked = currentEffectiveState === 'locked';
    const isClosed = currentEffectiveState === 'closed';
    const isTriggered = Boolean(triggeredButtons[entity.entity_id]);

    let iconComponent = <Sliders className="w-4 h-4 sm:w-5 sm:h-5" />;
    let stateDisplay = isUnavailable ? 'Unavailable' : currentEffectiveState;
    let tileBg = 'bg-slate-900/60 border-white/10 hover:border-white/20';
    let iconBg = 'bg-white/5 text-slate-400';

    if (CustomIcon) {
      iconComponent = <CustomIcon className="w-4 h-4 sm:w-5 sm:h-5" />;
    } else if (entity.domain === 'climate') {
      const currentTemp = entity.attributes.current_temperature;
      const targetTemp = entity.attributes.temperature;
      const targetLow = entity.attributes.target_temp_low;
      const targetHigh = entity.attributes.target_temp_high;
      const hvacAction = entity.attributes.hvac_action;
      const effectiveMode = currentEffectiveState;
      const isDual =
        effectiveMode === 'heat_cool' ||
        (effectiveMode === 'auto' && (targetLow != null || targetHigh != null));
      const isCooling = hvacAction === 'cooling' || effectiveMode === 'cool';
      const isHeating = hvacAction === 'heating' || effectiveMode === 'heat';
      const isAuto = effectiveMode === 'heat_cool' || effectiveMode === 'auto';
      const isOff = effectiveMode === 'off';

      if (isHeating) {
        iconComponent = <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />;
      } else if (isCooling) {
        iconComponent = <Snowflake className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />;
      } else if (isAuto) {
        iconComponent = <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />;
      } else if (isOff) {
        iconComponent = <Power className="w-4 h-4 sm:w-5 sm:h-5 text-slate-500" />;
      } else {
        iconComponent = <Gauge className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300" />;
      }

      if (isUnavailable) {
        stateDisplay = 'Unavailable';
      } else if (isOff) {
        stateDisplay = currentTemp != null ? `${Math.round(currentTemp)}° (Off)` : 'Off';
      } else if (isDual && targetLow != null && targetHigh != null) {
        const modeLabel = effectiveMode === 'auto' ? 'Auto' : 'Heat/Cool';
        const rangeText = `${Math.round(targetLow)}°-${Math.round(targetHigh)}°`;
        stateDisplay = currentTemp != null
          ? `${Math.round(currentTemp)}° (${rangeText} • ${modeLabel})`
          : `${rangeText} • ${modeLabel}`;
      } else if (targetTemp != null) {
        const modeLabel = effectiveMode === 'heat' ? 'Heat' : effectiveMode === 'cool' ? 'Cool' : effectiveMode.charAt(0).toUpperCase() + effectiveMode.slice(1);
        stateDisplay = currentTemp != null
          ? `${Math.round(currentTemp)}° (${Math.round(targetTemp)}° • ${modeLabel})`
          : `${Math.round(targetTemp)}° • ${modeLabel}`;
      } else {
        const modeLabel = effectiveMode === 'heat' ? 'Heat' : effectiveMode === 'cool' ? 'Cool' : effectiveMode.replace('_', '/');
        stateDisplay = currentTemp != null
          ? `${Math.round(currentTemp)}° (${modeLabel})`
          : modeLabel;
      }

      if (isUnavailable) {
        tileBg = 'bg-slate-900/40 border-white/5 opacity-60';
        iconBg = 'bg-white/5 text-slate-500';
      } else if (isOff) {
        tileBg = 'bg-slate-900/50 border-white/5 opacity-70 hover:opacity-100 hover:border-white/15';
        iconBg = 'bg-white/5 text-slate-500';
      } else if (isHeating) {
        tileBg = 'bg-gradient-to-b from-amber-500/15 to-slate-900/80 border-amber-500/30 hover:border-amber-400/50 shadow-lg shadow-amber-500/5';
        iconBg = 'bg-amber-500/20 text-amber-300 ring-2 ring-amber-500/30';
      } else if (isCooling) {
        tileBg = 'bg-gradient-to-b from-cyan-500/15 to-slate-900/80 border-cyan-500/30 hover:border-cyan-400/50 shadow-lg shadow-cyan-500/5';
        iconBg = 'bg-cyan-500/20 text-cyan-300 ring-2 ring-cyan-500/30';
      } else if (isAuto) {
        tileBg = 'bg-gradient-to-b from-emerald-500/15 to-slate-900/80 border-emerald-500/30 hover:border-emerald-400/50 shadow-lg shadow-emerald-500/5';
        iconBg = 'bg-emerald-500/20 text-emerald-300 ring-2 ring-emerald-500/30';
      } else {
        tileBg = 'bg-gradient-to-b from-slate-900/80 to-slate-950/80 border-white/10 hover:border-white/25';
        iconBg = 'bg-white/10 text-slate-300';
      }
    } else if (entity.domain === 'light') {
      iconComponent = <Lightbulb className={`w-4 h-4 sm:w-5 sm:h-5 ${isOn ? 'fill-amber-400 text-amber-400' : 'text-slate-400'}`} />;
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
      iconComponent = <Power className={`w-4 h-4 sm:w-5 sm:h-5 ${isOn ? 'text-emerald-400' : 'text-slate-400'}`} />;
      if (isOn) {
        stateDisplay = 'On';
        tileBg = 'bg-gradient-to-b from-emerald-500/15 to-slate-900/80 border-emerald-500/30 hover:border-emerald-400/50 shadow-lg shadow-emerald-500/5';
        iconBg = 'bg-emerald-400/20 text-emerald-300 ring-2 ring-emerald-400/30';
      } else {
        stateDisplay = 'Off';
      }
    } else if (entity.domain === 'lock') {
      if (isUnavailable) {
        iconComponent = <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-slate-500" />;
        stateDisplay = 'Offline';
        tileBg = 'bg-slate-900/40 border-white/5 opacity-60 hover:opacity-85';
        iconBg = 'bg-white/5 text-slate-500';
      } else if (isLocked) {
        iconComponent = <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />;
        stateDisplay = 'Locked';
        tileBg = 'bg-slate-900/60 border-emerald-500/20 hover:border-emerald-500/40';
        iconBg = 'bg-emerald-500/15 text-emerald-400';
      } else {
        iconComponent = <Unlock className="w-4 h-4 sm:w-5 sm:h-5 text-rose-400" />;
        stateDisplay = currentEffectiveState === 'open' ? 'Open' : 'Unlocked';
        tileBg = 'bg-rose-500/10 border-rose-500/30 hover:border-rose-500/50 shadow-lg shadow-rose-500/5';
        iconBg = 'bg-rose-500/20 text-rose-400 ring-2 ring-rose-500/30';
      }
    } else if (entity.domain === 'button' || entity.domain === 'input_button') {
      iconComponent = isTriggered ? <Check className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-300" /> : <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />;
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
      const isGarage =
        entity.attributes?.device_class === 'garage' ||
        entity.entity_id.toLowerCase().includes('garage') ||
        (displayName || entity.friendly_name || '').toLowerCase().includes('garage');
      iconComponent = isGarage ? (
        <Warehouse className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
      ) : (
        <Blinds className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
      );
      stateDisplay = isClosed ? 'Closed' : currentEffectiveState;
      tileBg = 'bg-slate-900/60 border-white/10 hover:border-white/25';
      iconBg = 'bg-blue-500/15 text-blue-400';
    } else if (entity.domain === 'scene' || entity.domain === 'script') {
      iconComponent = <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />;
      stateDisplay = 'Tap to Activate';
      tileBg = 'bg-slate-900/60 border-purple-500/20 hover:border-purple-500/40';
      iconBg = 'bg-purple-500/15 text-purple-400';
    } else if (entity.domain === 'fan') {
      const preset = (entity.attributes?.preset_mode || entity.attributes?.speed || '').toLowerCase();
      const pct = entity.attributes?.percentage;
      let fanSpeedText = 'Off';
      let speedLevel = 0;

      if (isOn) {
        if (preset === '1' || (typeof pct === 'number' && pct > 0 && pct <= 25)) {
          fanSpeedText = 'Speed 1';
          speedLevel = 1;
        } else if (preset === '2' || (typeof pct === 'number' && pct > 25 && pct <= 50)) {
          fanSpeedText = 'Speed 2';
          speedLevel = 2;
        } else if (preset === '3' || (typeof pct === 'number' && pct > 50 && pct <= 75)) {
          fanSpeedText = 'Speed 3';
          speedLevel = 3;
        } else if (preset === '4' || (typeof pct === 'number' && pct > 75)) {
          fanSpeedText = 'Speed 4';
          speedLevel = 4;
        } else {
          fanSpeedText = 'Speed 2';
          speedLevel = 2;
        }
      }

      const isFanOn = isOn && speedLevel > 0;
      const animDuration =
        speedLevel === 1 ? '3.0s' : speedLevel === 2 ? '2.0s' : speedLevel === 3 ? '1.2s' : '0.7s';

      iconComponent = (
        <Fan
          className={`w-4 h-4 sm:w-5 sm:h-5 ${isFanOn ? 'text-cyan-400 animate-spin' : 'text-slate-400'}`}
          style={isFanOn ? { animationDuration: animDuration } : undefined}
        />
      );
      stateDisplay = fanSpeedText;
      tileBg = isFanOn
        ? 'bg-gradient-to-b from-cyan-500/15 to-slate-900/80 border-cyan-500/30'
        : 'bg-slate-900/60 border-white/10';
      iconBg = isFanOn
        ? 'bg-cyan-500/20 text-cyan-300 ring-2 ring-cyan-500/30'
        : 'bg-white/5 text-slate-400';
    }

    return (
      <div
        key={entity.entity_id}
        onClick={() => {
          if (isLongPressActiveRef.current) {
            isLongPressActiveRef.current = false;
            return;
          }
          if (entity.needsDrawer) {
            setSelectedEntityForDrawer(entity);
          } else {
            handleTileQuickAction({ stopPropagation: () => {} } as any, entity);
          }
        }}
        onMouseDown={(e) => handleTouchStart(entity, e)}
        onMouseMove={handleTouchMove}
        onMouseUp={handleTouchEnd}
        onMouseLeave={handleTouchEnd}
        onTouchStart={(e) => handleTouchStart(entity, e)}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onContextMenu={(e) => {
          e.preventDefault();
          setEditingEntity(entity);
        }}
        className={`p-3 sm:p-4 rounded-2xl sm:rounded-3xl border transition-all duration-200 cursor-pointer flex flex-col justify-between select-none relative group min-h-[5.5rem] sm:min-h-[7.5rem] w-full active:scale-[0.98] ${tileBg}`}
      >
        {/* Top Row: Icon + Right Arrow (if needsDrawer) OR Toggle Button */}
        <div className="flex items-center justify-between gap-1.5 sm:gap-2">
          <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 transition-all ${iconBg}`}>
            {iconComponent}
          </div>

          {/* Multi-button control: Show Arrow pointing right */}
          {entity.needsDrawer ? (
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white/5 group-hover:bg-white/15 flex items-center justify-center text-slate-400 group-hover:text-white transition-all shrink-0">
              <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
            </div>
          ) : (entity.domain === 'button' || entity.domain === 'input_button') ? (
            /* Momentary trigger button */
            <button
              type="button"
              disabled={isUnavailable}
              onClick={(e) => handleTileQuickAction(e, entity)}
              className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg sm:rounded-xl border text-[10px] sm:text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                isUnavailable
                  ? 'opacity-30 bg-white/5 border-white/5 text-slate-500 cursor-not-allowed'
                  : isTriggered
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/20 font-black'
                  : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30'
              }`}
            >
              <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>{isTriggered ? 'Triggered' : 'Press'}</span>
            </button>
          ) : (
            /* Single action toggle button */
            <button
              type="button"
              disabled={isUnavailable}
              onClick={(e) => handleTileQuickAction(e, entity)}
              className={`p-0.5 sm:p-1 rounded-xl hover:bg-white/10 transition-all cursor-pointer shrink-0 ${
                isUnavailable ? 'opacity-30 cursor-not-allowed text-slate-600' : 'text-slate-400 hover:text-white'
              }`}
            >
              {isOn ? (
                <ToggleRight className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-400" />
              ) : (
                <ToggleLeft className="w-6 h-6 sm:w-7 sm:h-7 text-slate-500" />
              )}
            </button>
          )}
        </div>

        {/* Bottom Info: Friendly Name and Live State */}
        <div className="pt-2 sm:pt-3 min-w-0">
          <h4 className="text-[11px] sm:text-xs font-bold text-white truncate block group-hover:text-emerald-300 transition-colors leading-tight">
            {displayName}
          </h4>
          <div className="text-[10px] sm:text-[11px] font-medium text-slate-400 truncate mt-0.5 capitalize">
            {stateDisplay}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-3 pb-28 md:pb-20 space-y-4 min-h-[calc(100vh-8rem)] flex flex-col w-full">
      {/* Mobile Disconnected Floating Banner (Overlay: never shifts page layout or controls) */}
      {hasConnectionError && !isLiveConnected && (
        <div className="md:hidden fixed top-[4.25rem] left-3 right-3 z-30 flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-slate-900/95 backdrop-blur-md border border-amber-500/30 text-amber-400 text-xs font-semibold shadow-2xl shadow-slate-950/80 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>{isRefreshing ? 'Reconnecting to Home Assistant...' : 'Home Assistant is disconnected'}</span>
          </div>
          <button
            type="button"
            onClick={() => loadStates(false)}
            className="text-[11px] font-bold underline hover:text-amber-300 cursor-pointer shrink-0 ml-2"
          >
            Reconnect
          </button>
        </div>
      )}

      {/* Header Bar - Hidden on mobile, shown on desktop */}
      <div className="hidden md:flex items-center justify-between mb-0.5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-md shadow-emerald-500/20 text-slate-950 shrink-0">
            <SlidersHorizontal className="w-5 h-5 stroke-[2.2]" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
            Control
          </h1>
        </div>

        {/* Options & Status Dropdown Actions */}
        <div className="flex items-center gap-2">
          {/* Status Badge - Only shown when disconnected or reconnecting */}
          {hasConnectionError && !isLiveConnected && (
            <button
              type="button"
              onClick={() => loadStates(false)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all border cursor-pointer active:scale-95 bg-amber-500/10 text-amber-400 border-amber-500/25 hover:bg-amber-500/20"
              title="Disconnected from Home Assistant. Tap to reconnect."
            >
              <span className="relative flex h-2 w-2">
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400 animate-pulse" />
              </span>
              <span className="text-[11px] font-bold">
                {isRefreshing ? 'Connecting...' : 'HA Disconnected'}
              </span>
            </button>
          )}

          {/* Manage Dropdown Menu */}
          <div className="relative" ref={optionsMenuRef}>
            <button
              type="button"
              onClick={() => setIsOptionsMenuOpen((prev) => !prev)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 text-xs font-bold transition-all shadow-md shadow-emerald-500/20 active:scale-95 cursor-pointer shrink-0"
              title="Options"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Manage</span>
              <ChevronDown
                className={`w-3.5 h-3.5 stroke-[2.5] transition-transform duration-200 ${
                  isOptionsMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isOptionsMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 bg-slate-900/95 backdrop-blur-xl border border-white/15 rounded-2xl p-1.5 shadow-2xl shadow-slate-950/80 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-1">
                {/* Edit Controls */}
                <button
                  type="button"
                  onClick={() => {
                    setIsOptionsMenuOpen(false);
                    setIsManageModalOpen(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:text-white hover:bg-white/10 transition-colors text-left cursor-pointer group"
                >
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-400 group-hover:bg-emerald-500/25 flex items-center justify-center shrink-0 transition-colors">
                    <SlidersHorizontal className="w-4 h-4 stroke-[2]" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-white">Edit Controls</div>
                    <div className="text-[10px] text-slate-400">
                      {visibleEntityIds.length > 0 ? `${visibleEntityIds.length} on dashboard` : 'Add or remove devices'}
                    </div>
                  </div>
                </button>

                {/* Refresh */}
                <button
                  type="button"
                  onClick={() => {
                    setIsOptionsMenuOpen(false);
                    loadStates(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:text-white hover:bg-white/10 transition-colors text-left cursor-pointer group"
                >
                  <div className="w-7 h-7 rounded-lg bg-teal-500/15 text-teal-400 group-hover:bg-teal-500/25 flex items-center justify-center shrink-0 transition-colors">
                    <RefreshCw className={`w-4 h-4 stroke-[2] ${isRefreshing ? 'animate-spin' : ''}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-white">Refresh</div>
                    <div className="text-[10px] text-slate-400">Sync latest states</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SENSOR ROW JUST UNDER THE HEADER (Only rendered if data-only entities have been added to the screen) */}
      {!isLoading && activeDataEntities.length > 0 && (
        <div className="space-y-1.5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 bg-cyan-500/15 text-cyan-400">
                <Activity className="w-3.5 h-3.5 stroke-[2.2]" />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                <span>Sensors & Status</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/10 text-slate-400 font-semibold">
                  {activeDataEntities.length}
                </span>
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 px-0.5 snap-x">
            {activeDataEntities.map((entity) => {
              const currentEffectiveState = optimisticStates[entity.entity_id] || entity.state;
              const custom = entityCustomizations[entity.entity_id];
              const displayName = custom?.name || entity.friendly_name;
              const { icon, color, displayState } = getSensorDisplay(entity, currentEffectiveState);

              return (
                <div
                  key={entity.entity_id}
                  onClick={() => {
                    if (isLongPressActiveRef.current) {
                      isLongPressActiveRef.current = false;
                      return;
                    }
                    setSelectedEntityForDrawer(entity);
                  }}
                  onMouseDown={(e) => handleTouchStart(entity, e)}
                  onMouseMove={handleTouchMove}
                  onMouseUp={handleTouchEnd}
                  onMouseLeave={handleTouchEnd}
                  onTouchStart={(e) => handleTouchStart(entity, e)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setEditingEntity(entity);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 sm:py-2 rounded-2xl bg-slate-900/80 hover:bg-slate-900 border border-white/10 hover:border-white/20 transition-all cursor-pointer shrink-0 snap-start active:scale-95 group shadow-sm"
                >
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                    {icon}
                  </div>
                  <div className="min-w-0 pr-1">
                    <div className="text-[11px] font-bold text-white truncate max-w-[130px] group-hover:text-cyan-300 transition-colors">
                      {displayName}
                    </div>
                    <div className="text-[10px] font-semibold text-slate-400 truncate">
                      {displayState}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Search & Category Filter Bar (Desktop only, hidden on mobile) */}
      {visibleEntityIds.length > 0 && (
        <div className="hidden md:block space-y-3">
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

      {/* Ghost Statuses & Controls Skeleton */}
      {isLoading && <GhostSmartHomeSkeleton />}

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
      {!isLoading && visibleEntityIds.length > 0 && controlGroupsWithEntities.length === 0 && activeDataEntities.length === 0 && (
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

      {/* CAROUSEL GROUPS FOR CONTROLS */}
      {!isLoading && controlGroupsWithEntities.length > 0 && (
        <div className="space-y-6">
          {controlGroupsWithEntities.map((group) => {
            const GroupIcon = group.icon;
            return (
              <div key={group.id} className="space-y-2">
                {/* Carousel Group Header */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${group.iconColor}`}>
                      <GroupIcon className="w-3.5 h-3.5 stroke-[2.2]" />
                    </div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                      <span>{group.title}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/10 text-slate-400 font-semibold">
                        {group.entities.length}
                      </span>
                    </h3>
                  </div>

                  {group.entities.length > 2 && (
                    <span className="text-[10px] text-slate-500 font-medium hidden sm:inline">
                      Swipe for more →
                    </span>
                  )}
                </div>

                {/* Horizontal Swipeable Track */}
                <div className="flex gap-2.5 sm:gap-3.5 overflow-x-auto no-scrollbar py-1 px-0.5 snap-x scroll-smooth">
                  {group.entities.map((entity) => (
                    <div
                      key={entity.entity_id}
                      className="w-[155px] sm:w-[195px] shrink-0 snap-start"
                    >
                      {renderControlTile(entity)}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Slide Drawer from the Right Side for Multi-Button / Sensor Details */}
      <EntityDetailDrawer
        isOpen={Boolean(selectedEntityForDrawer)}
        entity={activeDrawerEntity}
        customization={activeDrawerEntity ? entityCustomizations[activeDrawerEntity.entity_id] : undefined}
        onClose={() => setSelectedEntityForDrawer(null)}
        onCallService={handleCallService}
      />

      {/* Manage / Show-Hide Controls Modal */}
      {/* Edit Entity Customization Modal (Triggered on Long Press or Right Click) */}
      <EditEntityModal
        isOpen={Boolean(editingEntity)}
        entity={editingEntity}
        currentCustomization={editingEntity ? entityCustomizations[editingEntity.entity_id] : undefined}
        positionInfo={editingEntityPositionInfo}
        onMove={handleReorderEntity}
        onClose={() => setEditingEntity(null)}
        onSave={handleSaveCustomization}
      />

      <ManageControlsModal
        isOpen={isManageModalOpen}
        onClose={() => setIsManageModalOpen(false)}
        allEntities={entities}
        customizations={entityCustomizations}
        initialVisibleIds={visibleEntityIds}
        onSave={handleSaveVisibleControls}
      />
    </div>
  );
};
