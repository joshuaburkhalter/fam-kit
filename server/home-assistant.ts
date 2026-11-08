import { queryOne, queryAll, execute, saveDb } from './db.js';

export interface HomeAssistantConfigRow {
  id: string;
  householdId: string;
  haUrl: string;
  haToken: string;
  enabled: number;
  lastConnectedAt: string | null;
  entityCount: number;
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
    url = `https://${url}`;
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

  // Filter out internal system sensors & diagnostic noise
  const entityId = item.entity_id.toLowerCase();
  if (
    entityId.includes('uptime') ||
    entityId.includes('update_available') ||
    entityId.includes('processor_use') ||
    entityId.includes('memory_use') ||
    entityId.includes('ip_address') ||
    entityId.includes('certificate_expiry') ||
    entityId.includes('internet_speed') ||
    entityId.includes('last_boot')
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
    needsDrawer = true;
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
  } else if (domain === 'sensor' || domain === 'binary_sensor') {
    needsDrawer = true;
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

  return {
    configured: true,
    haUrl: row.haUrl,
    maskedToken,
    enabled: Boolean(row.enabled),
    lastConnectedAt: row.lastConnectedAt,
    entityCount: row.entityCount || 0,
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
 * Fetch and categorize all active controllable & readable entities from Home Assistant
 */
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

  // Domain sort priority for logical dashboard grouping
  const DOMAIN_ORDER: Record<string, number> = {
    climate: 1,
    lock: 2,
    cover: 3,
    light: 4,
    switch: 5,
    fan: 6,
    scene: 7,
    script: 8,
    person: 9,
    sensor: 10,
    binary_sensor: 11,
    media_player: 12,
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
    if (!this.isConnected && !this.isConnecting) {
      this.connect();
    } else if (this.isConnected) {
      listener({ event: 'status', data: { status: 'connected' } });
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

  private broadcast(event: string, data: any) {
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
