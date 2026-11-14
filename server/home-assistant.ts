import { queryOne, queryAll, execute, saveDb } from './db.js';

export interface EntityCustomization {
  name?: string;
  icon?: string;
  category?: string;
}

export type EntityCustomizationsMap = Record<string, EntityCustomization>;

export interface HomeAssistantConfigRow {
  id: string;
  householdId: string;
  haUrl: string;
  haToken: string;
  enabled: number;
  lastConnectedAt: string | null;
  entityCount: number;
  visibleEntityIds?: string | null;
  entityCustomizations?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HomeAssistantEntity {
  entity_id: string;
  state: string;
  domain: string;
  friendly_name: string;
  icon?: string;
  needsDrawer: boolean;
  attributes: Record<string, any>;
  last_changed?: string;
  last_updated?: string;
}

export const ALLOWED_DOMAINS = new Set([
  'climate',
  'lock',
  'cover',
  'light',
  'switch',
  'button',
  'input_button',
  'fan',
  'scene',
  'script',
  'sensor',
  'binary_sensor',
  'person',
  'media_player',
]);

export function normalizeHaUrl(rawUrl: string): string {
  let url = (rawUrl || '').trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) {
    if (
      url.includes('.local') ||
      url.includes('192.168.') ||
      url.includes('10.') ||
      url.includes(':8123') ||
      url.startsWith('localhost') ||
      url.startsWith('127.0.0.1')
    ) {
      url = `http://${url}`;
    } else {
      url = `https://${url}`;
    }
  }
  return url.replace(/\/+$/, '');
}

/**
 * Convert an HTTP/HTTPS Home Assistant URL to a WebSocket URL
 */
export function getWebSocketUrl(rawUrl: string): string {
  const normalized = normalizeHaUrl(rawUrl);
  if (!normalized) return '';
  const wsProto = normalized.startsWith('https://') ? 'wss://' : 'ws://';
  const withoutProto = normalized.replace(/^https?:\/\//i, '');
  return `${wsProto}${withoutProto}/api/websocket`;
}

/**
 * Format a raw Home Assistant state object into a typed, filtered HomeAssistantEntity
 */
export function formatHaStateToEntity(item: any): HomeAssistantEntity | null {
  if (!item || !item.entity_id || typeof item.entity_id !== 'string') return null;
  const domain = item.entity_id.split('.')[0];
  if (!ALLOWED_DOMAINS.has(domain)) return null;

  // Filter out dead/ghost restored entities from HA cache that are offline
  if (item.attributes?.restored && (item.state === 'unavailable' || item.state === 'unknown')) {
    return null;
  }

  // Filter out internal system sensors & network diagnostics noise
  const entityId = item.entity_id.toLowerCase();
  if (
    entityId.includes('uptime') ||
    entityId.includes('update_available') ||
    entityId.includes('processor_use') ||
    entityId.includes('memory_use') ||
    entityId.includes('ip_address') ||
    entityId.includes('certificate_expiry') ||
    entityId.includes('internet_speed') ||
    entityId.includes('last_boot') ||
    entityId.includes('power_cycle') ||
    entityId.includes('_restart') ||
    entityId.includes('_reboot') ||
    entityId.includes('_identify')
  ) {
    return null;
  }

  const attrs = item.attributes || {};
  const friendlyName = attrs.friendly_name || item.entity_id.split('.')[1].replace(/_/g, ' ');

  // Determine if entity requires a slide-out drawer (multi-button / complex controls)
  let needsDrawer = false;

  if (domain === 'climate') {
    needsDrawer = true;
  } else if (domain === 'cover') {
    needsDrawer = true;
  } else if (domain === 'lock') {
    needsDrawer = true;
  } else if (domain === 'fan') {
    const hasSpeed =
      attrs.percentage !== undefined ||
      (typeof attrs.supported_features === 'number' && (attrs.supported_features & 1) !== 0) ||
      Array.isArray(attrs.preset_modes);
    needsDrawer = Boolean(hasSpeed);
  } else if (domain === 'media_player') {
    needsDrawer = true;
  } else if (domain === 'light') {
    const supportedModes = attrs.supported_color_modes || [];
    const hasBrightness =
      supportedModes.includes('brightness') ||
      supportedModes.includes('color_temp') ||
      supportedModes.includes('hs') ||
      supportedModes.includes('rgb') ||
      attrs.brightness !== undefined;
    needsDrawer = Boolean(hasBrightness);
  } else if (domain === 'sensor' || domain === 'binary_sensor' || domain === 'person') {
    needsDrawer = true;
  } else if (domain === 'button' || domain === 'input_button') {
    // Buttons are momentary trigger actions - no drawer needed
    needsDrawer = false;
  }

  return {
    entity_id: item.entity_id,
    state: String(item.state || ''),
    domain,
    friendly_name: friendlyName,
    icon: attrs.icon,
    needsDrawer,
    attributes: attrs,
    last_changed: item.last_changed,
    last_updated: item.last_updated,
  };
}

/**
 * Test connectivity and token against a Home Assistant instance
 */
export async function testHomeAssistantConnection(
  rawUrl: string,
  rawToken: string
): Promise<{ success: boolean; message: string; entityCount: number }> {
  const url = normalizeHaUrl(rawUrl);
  const token = (rawToken || '').trim();

  if (!url) throw new Error('Home Assistant URL is required.');
  if (!token) throw new Error('Home Assistant Long-Lived Access Token is required.');

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  try {
    // 1. Ping the basic API root
    const rootRes = await fetch(`${url}/api/`, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(9000),
    });

    if (!rootRes.ok) {
      if (rootRes.status === 401 || rootRes.status === 403) {
        throw new Error('Authentication failed: Invalid Long-Lived Access Token.');
      }
      throw new Error(`Home Assistant responded with status ${rootRes.status}: ${rootRes.statusText}`);
    }

    // 2. Fetch states to check entity count
    const statesRes = await fetch(`${url}/api/states`, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(10000),
    });

    if (!statesRes.ok) {
      throw new Error(`Connected to API but states endpoint failed with status ${statesRes.status}`);
    }

    const states = (await statesRes.json()) as any[];
    const count = Array.isArray(states) ? states.length : 0;

    return {
      success: true,
      message: `Connected successfully! Found ${count} entities.`,
      entityCount: count,
    };
  } catch (err: any) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      throw new Error('Connection timed out. Check that your Home Assistant external URL is reachable over HTTPS.');
    }
    throw new Error(err.message || 'Failed to connect to Home Assistant.');
  }
}

/**
 * Get the saved Home Assistant config for a household
 */
export function getHomeAssistantConfig(householdId: string) {
  if (!householdId) return { configured: false };

  const row = queryOne<HomeAssistantConfigRow>(
    'SELECT * FROM home_assistant_config WHERE householdId = ?',
    [householdId]
  );

  if (!row) {
    return { configured: false };
  }

  // Mask token for client security
  const maskedToken = row.haToken && row.haToken.length > 8
    ? `••••••••${row.haToken.slice(-4)}`
    : '••••••••';

  let visibleEntityIds: string[] = [];
  try {
    if (row.visibleEntityIds) {
      const parsed = JSON.parse(row.visibleEntityIds);
      if (Array.isArray(parsed)) visibleEntityIds = parsed;
    }
  } catch {}

  let entityCustomizations: Record<string, EntityCustomization> = {};
  try {
    if (row.entityCustomizations) {
      const parsed = JSON.parse(row.entityCustomizations);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        entityCustomizations = parsed;
      }
    }
  } catch {}

  return {
    configured: true,
    haUrl: row.haUrl,
    maskedToken,
    enabled: Boolean(row.enabled),
    lastConnectedAt: row.lastConnectedAt,
    entityCount: row.entityCount || 0,
    visibleEntityIds,
    entityCustomizations,
    updatedAt: row.updatedAt,
  };
}

/**
 * Save or update Home Assistant config for a household
 */
export async function saveHomeAssistantConfig(
  householdId: string,
  rawUrl: string,
  rawToken: string,
  enabled: boolean = true
) {
  if (!householdId) throw new Error('householdId is required');

  const url = normalizeHaUrl(rawUrl);
  let token = (rawToken || '').trim();

  // If token is masked, keep existing token from database
  const existing = queryOne<HomeAssistantConfigRow>(
    'SELECT * FROM home_assistant_config WHERE householdId = ?',
    [householdId]
  );

  if ((!token || token.startsWith('•••')) && existing) {
    token = existing.haToken;
  }

  // Verify connection before saving
  const testResult = await testHomeAssistantConnection(url, token);

  const now = new Date().toISOString();
  const id = existing ? existing.id : `ha_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  execute(
    `INSERT OR REPLACE INTO home_assistant_config (
      id, householdId, haUrl, haToken, enabled, lastConnectedAt, entityCount, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      householdId,
      url,
      token,
      enabled ? 1 : 0,
      now,
      testResult.entityCount,
      existing ? existing.createdAt : now,
      now,
    ]
  );
  saveDb();

  // Reset WebSocket bridge with new credentials
  disconnectHouseholdWebSocket(householdId);

  return {
    configured: true,
    haUrl: url,
    enabled,
    lastConnectedAt: now,
    entityCount: testResult.entityCount,
    message: testResult.message,
  };
}

/**
 * Delete Home Assistant config for a household
 */
export function deleteHomeAssistantConfig(householdId: string) {
  if (!householdId) return;
  disconnectHouseholdWebSocket(householdId);
  execute('DELETE FROM home_assistant_config WHERE householdId = ?', [householdId]);
  saveDb();
  return { success: true };
}

/**
 * Save the user-selected list of visible controls/entities for the dashboard
 */
export function saveHomeAssistantVisibleEntities(
  householdId: string,
  visibleEntityIds: string[]
) {
  if (!householdId) throw new Error('householdId is required');

  const cleanList = Array.isArray(visibleEntityIds)
    ? Array.from(new Set(visibleEntityIds.filter((id) => typeof id === 'string' && id.trim())))
    : [];

  const now = new Date().toISOString();
  execute(
    'UPDATE home_assistant_config SET visibleEntityIds = ?, updatedAt = ? WHERE householdId = ?',
    [JSON.stringify(cleanList), now, householdId]
  );
  saveDb();

  // Instantly sync dashboard controls to all connected family members
  const bridge = householdBridges.get(householdId);
  if (bridge) {
    bridge.broadcast('config_updated', { visibleEntityIds: cleanList });
  }

  return {
    success: true,
    visibleEntityIds: cleanList,
  };
}

/**
 * Fetch and categorize all active controllable & readable entities from Home Assistant
 */

/**
 * Save custom name, icon, or category override for an entity
 */
export function saveHomeAssistantEntityCustomization(
  householdId: string,
  entityId: string,
  customization: EntityCustomization | null
) {
  if (!householdId) throw new Error('householdId is required');
  if (!entityId) throw new Error('entityId is required');

  const row = queryOne<HomeAssistantConfigRow>(
    'SELECT * FROM home_assistant_config WHERE householdId = ?',
    [householdId]
  );
  if (!row) throw new Error('Home Assistant is not configured for this household');

  let currentMap: Record<string, EntityCustomization> = {};
  try {
    if (row.entityCustomizations) {
      const parsed = JSON.parse(row.entityCustomizations);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) currentMap = parsed;
    }
  } catch {}

  if (!customization || (!customization.name && !customization.icon && !customization.category)) {
    delete currentMap[entityId];
  } else {
    currentMap[entityId] = {
      ...(customization.name?.trim() ? { name: customization.name.trim() } : {}),
      ...(customization.icon?.trim() ? { icon: customization.icon.trim() } : {}),
      ...(customization.category?.trim() ? { category: customization.category.trim() } : {}),
    };
  }

  const now = new Date().toISOString();
  execute(
    'UPDATE home_assistant_config SET entityCustomizations = ?, updatedAt = ? WHERE householdId = ?',
    [JSON.stringify(currentMap), now, householdId]
  );
  saveDb();

  // Instantly broadcast to all connected family members
  const bridge = householdBridges.get(householdId);
  if (bridge) {
    bridge.broadcast('config_updated', { entityCustomizations: currentMap });
  }

  return {
    success: true,
    entityCustomizations: currentMap,
  };
}

export async function fetchHomeAssistantStates(householdId: string): Promise<HomeAssistantEntity[]> {
  const row = queryOne<HomeAssistantConfigRow>(
    'SELECT * FROM home_assistant_config WHERE householdId = ? AND enabled = 1',
    [householdId]
  );

  if (!row) {
    return [];
  }

  const headers = {
    Authorization: `Bearer ${row.haToken}`,
    'Content-Type': 'application/json',
  };

  const res = await fetch(`${row.haUrl}/api/states`, {
    method: 'GET',
    headers,
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Home Assistant states (${res.status}): ${res.statusText}`);
  }

  const rawStates = (await res.json()) as any[];
  if (!Array.isArray(rawStates)) return [];

  const filtered: HomeAssistantEntity[] = [];

  for (const item of rawStates) {
    const formatted = formatHaStateToEntity(item);
    if (formatted) {
      filtered.push(formatted);
    }
  }

  // Debug log for buttons and intercom devices
  const debugIntercoms = rawStates.filter((i: any) => {
    const s = ((i.entity_id || '') + ' ' + (i.attributes?.friendly_name || '')).toLowerCase();
    return s.includes('2n') || s.includes('verso') || s.includes('relay') || (i.entity_id || '').startsWith('button.');
  });
  if (debugIntercoms.length > 0) {
    console.log('[HomeAssistant Intercom/Button Entities]', JSON.stringify(debugIntercoms.map((i: any) => ({
      entity_id: i.entity_id,
      state: i.state,
      friendly_name: i.attributes?.friendly_name,
      restored: i.attributes?.restored
    }))));
  }

  // Domain sort priority for logical dashboard grouping
  const DOMAIN_ORDER: Record<string, number> = {
    climate: 1,
    lock: 2,
    cover: 3,
    light: 4,
    switch: 5,
    button: 6,
    input_button: 7,
    fan: 8,
    scene: 9,
    script: 10,
    person: 11,
    sensor: 12,
    binary_sensor: 13,
    media_player: 14,
  };

  filtered.sort((a, b) => {
    const orderA = DOMAIN_ORDER[a.domain] ?? 99;
    const orderB = DOMAIN_ORDER[b.domain] ?? 99;
    if (orderA !== orderB) return orderA - orderB;
    return a.friendly_name.localeCompare(b.friendly_name);
  });

  // Record stats
  try {
    const now = new Date().toISOString();
    execute(
      'UPDATE home_assistant_config SET lastConnectedAt = ?, entityCount = ? WHERE householdId = ?',
      [now, filtered.length, householdId]
    );
    saveDb();
  } catch {}

  return filtered;
}

/**
 * Call a service on Home Assistant (e.g. light.turn_on, climate.set_temperature)
 */
export async function callHomeAssistantService(
  householdId: string,
  domain: string,
  service: string,
  serviceData: Record<string, any>
) {
  const row = queryOne<HomeAssistantConfigRow>(
    'SELECT * FROM home_assistant_config WHERE householdId = ? AND enabled = 1',
    [householdId]
  );

  if (!row) {
    throw new Error('Home Assistant is not configured or disabled for this household.');
  }

  const cleanDomain = (domain || '').trim().toLowerCase();
  const cleanService = (service || '').trim().toLowerCase();

  const headers = {
    Authorization: `Bearer ${row.haToken}`,
    'Content-Type': 'application/json',
  };

  const res = await fetch(`${row.haUrl}/api/services/${cleanDomain}/${cleanService}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(serviceData || {}),
    signal: AbortSignal.timeout(9000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Home Assistant service call failed (${res.status}): ${errText || res.statusText}`);
  }

  const data = await res.json().catch(() => ({}));
  return { success: true, result: data };
}

// ---------------------------------------------------------------------------
// Real-Time WebSocket Manager
// ---------------------------------------------------------------------------

export type HomeAssistantEventListener = (event: { event: string; data: any }) => void;

class HouseholdSocketBridge {
  private householdId: string;
  private ws: WebSocket | null = null;
  private listeners = new Set<HomeAssistantEventListener>();
  private messageId = 1;
  private pingInterval: any = null;
  private reconnectTimeout: any = null;
  private graceTimeout: any = null;
  private isConnecting = false;
  private isConnected = false;
  private reconnectAttempts = 0;

  constructor(householdId: string) {
    this.householdId = householdId;
  }

  public addListener(listener: HomeAssistantEventListener) {
    this.listeners.add(listener);
    if (this.graceTimeout) {
      clearTimeout(this.graceTimeout);
      this.graceTimeout = null;
    }
    if (this.isConnected) {
      listener({ event: 'status', data: { status: 'connected' } });
    } else if (this.isConnecting) {
      listener({ event: 'status', data: { status: 'connecting' } });
    } else {
      listener({ event: 'status', data: { status: 'connecting' } });
      this.connect();
    }
  }

  public removeListener(listener: HomeAssistantEventListener) {
    this.listeners.delete(listener);
    if (this.listeners.size === 0) {
      // Disconnect socket after 60 seconds if no clients are viewing the dashboard
      this.graceTimeout = setTimeout(() => {
        if (this.listeners.size === 0) {
          this.disconnect();
        }
      }, 60000);
    }
  }

  public broadcast(event: string, data: any) {
    for (const listener of this.listeners) {
      try {
        listener({ event, data });
      } catch (err) {
        console.error('Error broadcasting HA event to listener:', err);
      }
    }
  }

  public connect() {
    if (this.isConnecting || this.isConnected) return;
    this.isConnecting = true;

    // Fetch config for this household
    const row = queryOne<HomeAssistantConfigRow>(
      'SELECT * FROM home_assistant_config WHERE householdId = ? AND enabled = 1',
      [this.householdId]
    );

    if (!row || !row.haUrl || !row.haToken) {
      this.isConnecting = false;
      this.broadcast('status', { status: 'disconnected', reason: 'Not configured or disabled' });
      return;
    }

    const wsUrl = getWebSocketUrl(row.haUrl);
    if (!wsUrl) {
      this.isConnecting = false;
      return;
    }

    try {
      this.ws = new WebSocket(wsUrl);
    } catch (err: any) {
      this.isConnecting = false;
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      // Waiting for auth_required message from Home Assistant
    };

    this.ws.onmessage = (event) => {
      try {
        const raw = typeof event.data === 'string' ? event.data : (event.data as any).toString();
        const msg = JSON.parse(raw);
        this.handleMessage(msg, row.haToken);
      } catch (err) {
        console.error('Error parsing HA websocket message:', err);
      }
    };

    this.ws.onerror = (err) => {
      console.warn(`Home Assistant WebSocket notice for household ${this.householdId}:`, err);
    };

    this.ws.onclose = (event) => {
      this.isConnecting = false;
      this.isConnected = false;
      this.stopPing();
      this.broadcast('status', { status: 'disconnected', code: event.code, reason: event.reason });
      if (this.listeners.size > 0) {
        this.scheduleReconnect();
      }
    };
  }

  private handleMessage(msg: any, token: string) {
    if (msg.type === 'auth_required') {
      // Send token
      this.send({
        type: 'auth',
        access_token: token,
      });
      return;
    }

    if (msg.type === 'auth_ok') {
      this.isConnecting = false;
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.broadcast('status', { status: 'connected', ha_version: msg.ha_version });

      // Subscribe to all state_changed events
      const subId = this.messageId++;
      this.send({
        id: subId,
        type: 'subscribe_events',
        event_type: 'state_changed',
      });

      this.startPing();
      return;
    }

    if (msg.type === 'auth_invalid') {
      this.isConnecting = false;
      this.isConnected = false;
      this.broadcast('status', { status: 'auth_failed', message: msg.message || 'Invalid token' });
      this.disconnect();
      return;
    }

    if (msg.type === 'event' && msg.event?.event_type === 'state_changed') {
      const data = msg.event.data;
      if (data?.new_state) {
        const formatted = formatHaStateToEntity(data.new_state);
        if (formatted) {
          this.broadcast('state_changed', { entity: formatted });
        }
      }
      return;
    }

    if (msg.type === 'pong') {
      // Heartbeat acknowledged
      return;
    }
  }

  private send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private startPing() {
    this.stopPing();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ id: this.messageId++, type: 'ping' });
      }
    }, 30000);
  }

  private stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) return;
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 30000);
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      if (this.listeners.size > 0) {
        this.connect();
      }
    }, delay);
  }

  public disconnect() {
    this.stopPing();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.graceTimeout) {
      clearTimeout(this.graceTimeout);
      this.graceTimeout = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    this.isConnecting = false;
    this.isConnected = false;
  }
}

const householdBridges = new Map<string, HouseholdSocketBridge>();

export function getOrCreateHouseholdBridge(householdId: string): HouseholdSocketBridge {
  let bridge = householdBridges.get(householdId);
  if (!bridge) {
    bridge = new HouseholdSocketBridge(householdId);
    householdBridges.set(householdId, bridge);
  }
  return bridge;
}

/**
 * Subscribe to real-time events for a household from Home Assistant
 */
export function subscribeToHomeAssistantEvents(
  householdId: string,
  listener: HomeAssistantEventListener
): () => void {
  const bridge = getOrCreateHouseholdBridge(householdId);
  bridge.addListener(listener);
  return () => {
    bridge.removeListener(listener);
  };
}

/**
 * Disconnect and clean up the active WebSocket connection for a household
 */
export function disconnectHouseholdWebSocket(householdId: string) {
  const bridge = householdBridges.get(householdId);
  if (bridge) {
    bridge.disconnect();
    householdBridges.delete(householdId);
  }
}


/**
 * Securely proxy images from Home Assistant (e.g. person profile avatars, camera snapshots)
 */
export async function proxyHomeAssistantImage(
  householdId: string,
  rawPath: string
): Promise<{ buffer: Buffer; contentType: string }> {
  if (!householdId) throw new Error('householdId is required');
  if (!rawPath) throw new Error('path is required');

  const row = queryOne<HomeAssistantConfigRow>(
    'SELECT * FROM home_assistant_config WHERE householdId = ? AND enabled = 1',
    [householdId]
  );

  if (!row || !row.haUrl || !row.haToken) {
    throw new Error('Home Assistant is not configured or disabled');
  }

  const cleanUrl = normalizeHaUrl(row.haUrl);
  const base = new URL(cleanUrl);
  let resolved: URL;

  const trimmedPath = rawPath.trim();
  if (/^https?:\/\//i.test(trimmedPath)) {
    try {
      const parsed = new URL(trimmedPath);
      if (parsed.origin !== base.origin) {
        throw new Error('Invalid Home Assistant media path: origin mismatch');
      }
      resolved = parsed;
    } catch (e: any) {
      throw new Error(e?.message || 'Invalid Home Assistant media URL.');
    }
  } else if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmedPath) || trimmedPath.startsWith('//')) {
    throw new Error('Only HTTP/HTTPS or relative Home Assistant media paths are allowed.');
  } else {
    resolved = new URL(trimmedPath.startsWith('/') ? trimmedPath : `/${trimmedPath}`, base);
    if (resolved.origin !== base.origin) {
      throw new Error('Invalid Home Assistant media path.');
    }
  }

  const res = await fetch(resolved.toString(), {
    headers: {
      Authorization: `Bearer ${row.haToken}`,
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch image from Home Assistant (${res.status}): ${res.statusText}`);
  }

  const contentType = res.headers.get('content-type') || 'image/jpeg';
  const arrayBuf = await res.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuf),
    contentType,
  };
}
