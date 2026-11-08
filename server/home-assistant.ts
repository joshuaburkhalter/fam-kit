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

export function normalizeHaUrl(rawUrl: string): string {
  let url = (rawUrl || '').trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  return url.replace(/\/+$/, '');
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

  // Allowed domains for smart home dashboard
  const ALLOWED_DOMAINS = new Set([
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

  // Filter out internal noisy entities (e.g. updater, analytics, diagnostics)
  const filtered: HomeAssistantEntity[] = [];

  for (const item of rawStates) {
    if (!item.entity_id || typeof item.entity_id !== 'string') continue;
    const domain = item.entity_id.split('.')[0];
    if (!ALLOWED_DOMAINS.has(domain)) continue;

    // Filter out internal system sensors
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
      continue;
    }

    const attrs = item.attributes || {};
    const friendlyName = attrs.friendly_name || item.entity_id.split('.')[1].replace(/_/g, ' ');

    // Determine if entity requires a slide-out drawer (multi-button / complex controls)
    let needsDrawer = false;

    if (domain === 'climate') {
      // Thermostats need temperature adjustments, mode selection (heat, cool, auto, off), fan speed
      needsDrawer = true;
    } else if (domain === 'cover') {
      // Garage doors and window blinds need open, close, stop, and position sliders
      needsDrawer = true;
    } else if (domain === 'lock') {
      // Smart locks have lock/unlock actions, security state, battery
      needsDrawer = true;
    } else if (domain === 'fan') {
      // Fans have speed percentages, oscillation, presets
      needsDrawer = true;
    } else if (domain === 'media_player') {
      // Media players have volume, play/pause, source
      needsDrawer = true;
    } else if (domain === 'light') {
      // Dimmable or color lights need brightness/color drawer; simple on/off lights can toggle directly
      const supportedModes = attrs.supported_color_modes || [];
      const hasBrightness =
        supportedModes.includes('brightness') ||
        supportedModes.includes('color_temp') ||
        supportedModes.includes('hs') ||
        supportedModes.includes('rgb') ||
        attrs.brightness !== undefined;
      needsDrawer = Boolean(hasBrightness);
    } else if (domain === 'sensor' || domain === 'binary_sensor') {
      // Sensors have attributes, unit of measurement, history
      needsDrawer = true;
    }

    filtered.push({
      entity_id: item.entity_id,
      state: String(item.state || ''),
      domain,
      friendly_name: friendlyName,
      icon: attrs.icon,
      needsDrawer,
      attributes: attrs,
      last_changed: item.last_changed,
      last_updated: item.last_updated,
    });
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
