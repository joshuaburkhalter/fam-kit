import { queryOne, queryAll, execute, saveDb } from './db.js';

export interface GoogleSyncRecord {
  id: string;
  userId: string;
  householdId: string;
  googleEmail: string | null;
  accessToken: string | null;
  refreshToken: string;
  tokenExpiry: number | null;
  selectedCalendarId: string | null;
  selectedCalendarIds: string | null;
  calendarMemberMap: string | null;
  syncToken: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
}

export interface GoogleCalendarEntry {
  id: string;
  summary: string;
  description?: string;
  primary?: boolean;
  backgroundColor?: string;
  foregroundColor?: string;
  selected: boolean;
  assignedMemberId?: string | null;
}

export const calendarTimeZoneCache = new Map<string, string>();
export const calendarAccessRoleCache = new Map<string, string>();

/**
 * Checks if a calendar is known to be writable (owner or writer)
 */
export function isCalendarWritable(calendarId: string): boolean {
  const role = calendarAccessRoleCache.get(calendarId);
  if (role) {
    return role === 'owner' || role === 'writer';
  }
  // Secondary group calendars that end in @group.calendar.google.com are often read-only subscriptions
  // Primary email calendars or 'primary' are user-owned and writable by default
  return calendarId === 'primary' || !calendarId.includes('@group.calendar.google.com');
}

export function getGoogleCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const defaultRedirectUri =
    process.env.GOOGLE_REDIRECT_URI?.trim() || 'https://homebase.skyy.studio/api/auth/google/callback';

  return { clientId, clientSecret, defaultRedirectUri };
}

/**
 * Determine the matching redirect URI based on client host or defaults
 */
export function resolveRedirectUri(host?: string): string {
  const { defaultRedirectUri } = getGoogleCredentials();
  if (!host) return defaultRedirectUri;

  if (host.includes('localhost:3001')) {
    return 'http://localhost:3001/api/auth/google/callback';
  }
  if (host.includes('localhost:5173')) {
    return 'http://localhost:5173/api/auth/google/callback';
  }
  return defaultRedirectUri;
}

/**
 * Generate Google OAuth Consent URL
 */
export function getGoogleAuthUrl(householdId: string, userId: string, host?: string): string {
  const { clientId } = getGoogleCredentials();
  if (!clientId) {
    throw new Error('Google Calendar integration is not configured. Missing GOOGLE_CLIENT_ID.');
  }

  const redirectUri = resolveRedirectUri(host);
  const stateObj = {
    householdId,
    userId,
    redirectUri,
    timestamp: Date.now(),
  };
  const state = Buffer.from(JSON.stringify(stateObj)).toString('base64url');

  const scopes = [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
  ].join(' ');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes,
    access_type: 'offline',
    prompt: 'consent select_account',
    include_granted_scopes: 'true',
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Handle OAuth redirect callback, exchange code for tokens, save to DB, and initial sync
 */
export async function handleGoogleAuthCallback(
  code: string,
  stateStr: string
): Promise<{ success: boolean; householdId: string; userId: string; email?: string; error?: string }> {
  try {
    const { clientId, clientSecret } = getGoogleCredentials();
    if (!clientId || !clientSecret) {
      throw new Error('Google OAuth credentials not configured on server.');
    }

    let state: { householdId: string; userId: string; redirectUri: string };
    try {
      state = JSON.parse(Buffer.from(stateStr, 'base64url').toString('utf8'));
    } catch {
      throw new Error('Invalid state parameter in Google callback.');
    }

    const { householdId: rawHouseholdId, userId, redirectUri } = state;
    if (!rawHouseholdId || !userId) {
      throw new Error('Missing householdId or userId in OAuth state.');
    }

    // Resolve householdId from the user's primary record if exists
    const userRow = queryOne<{ householdId: string }>('SELECT householdId FROM users WHERE id = ?', [userId]);
    const householdId = userRow?.householdId || rawHouseholdId;

    // Exchange auth code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      console.error('Google token exchange failed:', errorText);
      let errorDesc = tokenRes.statusText;
      try {
        const parsed = JSON.parse(errorText);
        errorDesc = parsed.error_description || parsed.error || errorText;
      } catch {
        errorDesc = errorText || tokenRes.statusText;
      }
      throw new Error(`Google token exchange failed: ${errorDesc}`);
    }

    const tokenData = (await tokenRes.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      token_type: string;
    };

    const accessToken = tokenData.access_token;
    let refreshToken = tokenData.refresh_token;

    // Fetch user profile email
    let userEmail: string | null = null;
    try {
      const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (userRes.ok) {
        const userInfo = (await userRes.json()) as { email?: string };
        userEmail = userInfo.email || null;
      }
    } catch (e) {
      console.warn('Could not fetch Google userinfo email:', e);
    }

    const expiryMs = Date.now() + tokenData.expires_in * 1000;
    const now = new Date().toISOString();

    const existing = queryOne<GoogleSyncRecord>(
      'SELECT * FROM user_google_sync WHERE userId = ? OR (userId = ? AND householdId = ?)',
      [userId, userId, householdId]
    );

    if (!refreshToken && existing?.refreshToken) {
      refreshToken = existing.refreshToken;
    }

    const safeRefreshToken = refreshToken || existing?.refreshToken || '';
    if (!safeRefreshToken) {
      console.warn(`[GoogleSync] User ${userId} connected without a refresh token. Initial sync will proceed with accessToken.`);
    }

    if (existing) {
      execute(
        `UPDATE user_google_sync
         SET householdId = ?,
             googleEmail = ?,
             accessToken = ?,
             refreshToken = ?,
             tokenExpiry = ?,
             lastSyncedAt = ?
         WHERE id = ?`,
        [householdId, userEmail || existing.googleEmail, accessToken, safeRefreshToken, expiryMs, now, existing.id]
      );
    } else {
      const id = `gsync_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      execute(
        `INSERT INTO user_google_sync (id, userId, householdId, googleEmail, accessToken, refreshToken, tokenExpiry, selectedCalendarId, selectedCalendarIds, calendarMemberMap, syncToken, lastSyncedAt, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'primary', '["primary"]', null, null, ?, ?)`,
        [id, userId, householdId, userEmail, accessToken, safeRefreshToken, expiryMs, now, now]
      );
    }
    saveDb();

    try {
      await syncUserGoogleCalendar(householdId, userId);
    } catch (syncErr) {
      console.error('Initial Google Calendar sync error:', syncErr);
    }

    return { success: true, householdId, userId, email: userEmail || undefined };
  } catch (err: any) {
    console.error('handleGoogleAuthCallback error:', err);
    return { success: false, householdId: '', userId: '', error: err.message || 'OAuth callback failed' };
  }
}

/**
 * Get a guaranteed valid access token (refreshes via refreshToken if expired)
 */
async function getValidAccessToken(record: GoogleSyncRecord): Promise<string | null> {
  const { clientId, clientSecret } = getGoogleCredentials();
  if (!clientId || !clientSecret) return null;

  const now = Date.now();
  if (record.accessToken && record.tokenExpiry && record.tokenExpiry - now > 180000) {
    return record.accessToken;
  }

  if (!record.refreshToken) return null;

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: record.refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Failed to refresh Google token:', err);
      return null;
    }

    const data = (await res.json()) as { access_token: string; expires_in: number };
    const newExpiry = Date.now() + data.expires_in * 1000;

    execute(
      'UPDATE user_google_sync SET accessToken = ?, tokenExpiry = ? WHERE id = ?',
      [data.access_token, newExpiry, record.id]
    );
    saveDb();

    return data.access_token;
  } catch (err) {
    console.error('Exception refreshing Google token:', err);
    return null;
  }
}

/**
 * Get all available Google Calendars for a user, indicating which ones are selected and who they are assigned to
 */
export async function getUserGoogleCalendars(
  householdId: string,
  userId: string
): Promise<{ calendars: GoogleCalendarEntry[]; error?: string }> {
  let record = queryOne<GoogleSyncRecord>(
    'SELECT * FROM user_google_sync WHERE userId = ? AND householdId = ?',
    [userId, householdId]
  );

  if (!record) {
    record = queryOne<GoogleSyncRecord>(
      'SELECT * FROM user_google_sync WHERE userId = ?',
      [userId]
    );
    if (record) {
      execute('UPDATE user_google_sync SET householdId = ? WHERE id = ?', [householdId, record.id]);
      saveDb();
    }
  }

  if (!record) {
    return { calendars: [], error: 'User is not connected to Google Calendar' };
  }

  const accessToken = await getValidAccessToken(record);
  if (!accessToken) {
    return { calendars: [], error: 'Could not acquire valid Google access token' };
  }

  try {
    const res = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Failed to fetch calendarList from Google:', err);
      return { calendars: [], error: 'Failed to retrieve calendars from Google' };
    }

    const data = (await res.json()) as {
      items?: Array<{
        id: string;
        summary: string;
        description?: string;
        primary?: boolean;
        backgroundColor?: string;
        foregroundColor?: string;
      }>;
    };

    let selectedIds: string[] = ['primary'];
    if (record.selectedCalendarIds) {
      try {
        selectedIds = JSON.parse(record.selectedCalendarIds);
      } catch {}
    } else if (record.selectedCalendarId) {
      selectedIds = [record.selectedCalendarId];
    }

    let memberMap: Record<string, string | null> = {};
    if (record.calendarMemberMap) {
      try {
        memberMap = JSON.parse(record.calendarMemberMap);
      } catch {}
    }

    const selectedSet = new Set(selectedIds);

    const calendars: GoogleCalendarEntry[] = (data.items || []).map((cal: any) => {
      if (cal.id && cal.timeZone) {
        calendarTimeZoneCache.set(cal.id, cal.timeZone);
      }
      if (cal.id && cal.accessRole) {
        calendarAccessRoleCache.set(cal.id, cal.accessRole);
      }
      const isSelected = selectedSet.has(cal.id) || (Boolean(cal.primary) && selectedSet.has('primary'));
      const assigned = memberMap[cal.id] !== undefined ? memberMap[cal.id] : userId;

      return {
        id: cal.id,
        summary: cal.summary || '(Untitled Calendar)',
        description: cal.description,
        primary: Boolean(cal.primary),
        backgroundColor: cal.backgroundColor || '#10b981',
        foregroundColor: cal.foregroundColor || '#ffffff',
        selected: isSelected,
        assignedMemberId: assigned,
      };
    });

    return { calendars };
  } catch (err: any) {
    console.error('getUserGoogleCalendars error:', err);
    return { calendars: [], error: err.message || 'Failed to get calendars' };
  }
}

/**
 * Update which Google Calendars should sync for a user, their member assignments, and re-sync
 */
export async function updateUserSelectedCalendars(
  householdId: string,
  userId: string,
  calendarSelections: Array<{ calendarId: string; assignedMemberId?: string | null }> | string[],
  memberMapParam?: Record<string, string | null>
): Promise<{ success: boolean; syncedCount: number; error?: string }> {
  try {
    let record = queryOne<GoogleSyncRecord>(
      'SELECT * FROM user_google_sync WHERE userId = ? AND householdId = ?',
      [userId, householdId]
    );

    if (!record) {
      record = queryOne<GoogleSyncRecord>(
        'SELECT * FROM user_google_sync WHERE userId = ?',
        [userId]
      );
      if (record) {
        execute('UPDATE user_google_sync SET householdId = ? WHERE id = ?', [householdId, record.id]);
        saveDb();
      }
    }

    if (!record) {
      return { success: false, syncedCount: 0, error: 'User is not connected' };
    }

    let cleanIds: string[] = [];
    let memberMap: Record<string, string | null> = {};

    if (Array.isArray(calendarSelections) && calendarSelections.length > 0 && typeof calendarSelections[0] === 'object') {
      const typedSelections = calendarSelections as Array<{ calendarId: string; assignedMemberId?: string | null }>;
      cleanIds = Array.from(new Set(typedSelections.map((s) => s.calendarId.trim()).filter(Boolean)));
      for (const s of typedSelections) {
        memberMap[s.calendarId] = s.assignedMemberId ?? null;
      }
    } else {
      cleanIds = Array.from(new Set((calendarSelections as string[]).map((id) => id.trim()).filter(Boolean)));
      if (memberMapParam) memberMap = memberMapParam;
    }

    const idsJson = JSON.stringify(cleanIds);
    const mapJson = JSON.stringify(memberMap);

    execute(
      'UPDATE user_google_sync SET selectedCalendarIds = ?, calendarMemberMap = ? WHERE id = ?',
      [idsJson, mapJson, record.id]
    );
    saveDb();

    // Purge events from unselected calendars for this user
    if (cleanIds.length === 0) {
      execute(
        'DELETE FROM calendar_events WHERE householdId = ? AND assignedMemberId = ? AND isGoogleEvent = 1',
        [householdId, userId]
      );
    } else {
      const existingEvents = queryAll<{ id: string; googleCalendarId: string | null }>(
        'SELECT id, googleCalendarId FROM calendar_events WHERE householdId = ? AND isGoogleEvent = 1',
        [householdId]
      );
      const keepSet = new Set(cleanIds);
      for (const ev of existingEvents) {
        if (ev.googleCalendarId && !keepSet.has(ev.googleCalendarId)) {
          execute('DELETE FROM calendar_events WHERE id = ?', [ev.id]);
        }
      }
    }
    saveDb();

    // Trigger sync for the newly selected calendars
    const syncRes = await syncUserGoogleCalendar(householdId, userId);
    return { success: true, syncedCount: syncRes.syncedCount };
  } catch (err: any) {
    console.error('updateUserSelectedCalendars error:', err);
    return { success: false, syncedCount: 0, error: err.message || 'Failed to update calendars' };
  }
}

/**
 * Sync events for a specific user from their selected Google Calendars, applying member assignments
 * Window: 30 days in the past to 90 days in the future
 */
export async function syncUserGoogleCalendar(
  householdId: string,
  userId: string
): Promise<{ syncedCount: number; error?: string }> {
  let record = queryOne<GoogleSyncRecord>(
    'SELECT * FROM user_google_sync WHERE userId = ? AND householdId = ?',
    [userId, householdId]
  );

  if (!record) {
    record = queryOne<GoogleSyncRecord>(
      'SELECT * FROM user_google_sync WHERE userId = ?',
      [userId]
    );
    if (record) {
      execute('UPDATE user_google_sync SET householdId = ? WHERE id = ?', [householdId, record.id]);
      saveDb();
    }
  }

  if (!record) {
    return { syncedCount: 0, error: 'User is not connected to Google Calendar' };
  }

  const accessToken = await getValidAccessToken(record);
  if (!accessToken) {
    return { syncedCount: 0, error: 'Could not acquire valid Google access token' };
  }

  let calendarIds: string[] = ['primary'];
  if (record.selectedCalendarIds) {
    try {
      calendarIds = JSON.parse(record.selectedCalendarIds);
    } catch {}
  } else if (record.selectedCalendarId) {
    calendarIds = [record.selectedCalendarId];
  }

  let memberMap: Record<string, string | null> = {};
  if (record.calendarMemberMap) {
    try {
      memberMap = JSON.parse(record.calendarMemberMap);
    } catch {}
  }

  if (calendarIds.length === 0) {
    return { syncedCount: 0 };
  }

  const now = new Date();
  const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const future90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const timeMin = past30.toISOString();
  const timeMax = future90.toISOString();
  let totalSynced = 0;
  const nowIso = new Date().toISOString();

  // Prime timezones and access roles
  try {
    const listRes = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (listRes.ok) {
      const listData = (await listRes.json()) as { items?: any[] };
      (listData.items || []).forEach((cal) => {
        if (cal.id && cal.timeZone) calendarTimeZoneCache.set(cal.id, cal.timeZone);
        if (cal.id && cal.accessRole) calendarAccessRoleCache.set(cal.id, cal.accessRole);
      });
    }
  } catch {}

  for (const calId of calendarIds) {
    // Determine which member this calendar belongs to
    let assignedMemberId: string | null = userId;
    if (memberMap[calId] !== undefined) {
      assignedMemberId = memberMap[calId] && memberMap[calId] !== 'family' ? memberMap[calId] : null;
    }

    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      calId
    )}/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(
      timeMax
    )}&singleEvents=true&orderBy=startTime&maxResults=250`;

    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`Google Calendar ${calId} error (${res.status}):`, errText);
        continue;
      }

      const data = (await res.json()) as {
        items?: Array<{
          id: string;
          status?: string;
          summary?: string;
          description?: string;
          location?: string;
          start?: { date?: string; dateTime?: string };
          end?: { date?: string; dateTime?: string };
        }>;
      };

      const items = data.items || [];

      for (const item of items) {
        try {
          if (!item.id || item.status === 'cancelled') {
            // Delete cancelled event if it exists in Homebase
            if (item.id) {
              execute(
                'DELETE FROM calendar_events WHERE householdId = ? AND googleEventId = ?',
                [householdId, item.id]
              );
            }
            continue;
          }

          const title = item.summary?.trim() || '(No Title)';
          const description = item.description?.trim() || null;
          const location = item.location?.trim() || null;

          let date: string | null = null;
          let startTime: string | null = null;
          let endTime: string | null = null;

          if (item.start?.date) {
            date = item.start.date;
            startTime = null;
            endTime = null;
          } else if (item.start?.dateTime) {
            date = item.start.dateTime.split('T')[0];
            startTime = item.start.dateTime.split('T')[1]?.substring(0, 5) || null;
            if (item.end?.dateTime) {
              endTime = item.end.dateTime.split('T')[1]?.substring(0, 5) || null;
            }
          }

          if (!date) continue;

          const id = `gcal_${item.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

          const existingEvent = queryOne<{ id: string }>(
            'SELECT id FROM calendar_events WHERE id = ? OR (householdId = ? AND googleEventId = ?)',
            [id, householdId, item.id]
          );

          if (existingEvent) {
            execute(
              `UPDATE calendar_events
               SET title = ?,
                   description = ?,
                   date = ?,
                   startTime = ?,
                   endTime = ?,
                   location = ?,
                   assignedMemberId = ?,
                   googleCalendarId = ?,
                   googleEventId = ?,
                   isGoogleEvent = 1
               WHERE id = ?`,
              [title, description, date, startTime, endTime, location, assignedMemberId, calId, item.id, existingEvent.id]
            );
          } else {
            execute(
              `INSERT OR REPLACE INTO calendar_events (id, title, description, date, startTime, endTime, category, location, assignedMemberId, householdId, isGoogleEvent, googleEventId, googleCalendarId, createdAt)
               VALUES (?, ?, ?, ?, ?, ?, 'Google Calendar', ?, ?, ?, 1, ?, ?, ?)`,
              [id, title, description, date, startTime, endTime, location, assignedMemberId, householdId, item.id, calId, nowIso]
            );
          }
          totalSynced++;
        } catch (itemErr) {
          console.warn(`Error syncing event ${item.id}:`, itemErr);
        }
      }
    } catch (calErr) {
      console.warn(`Error syncing calendar ${calId}:`, calErr);
    }
  }

  execute(
    'UPDATE user_google_sync SET lastSyncedAt = ? WHERE id = ?',
    [nowIso, record.id]
  );
  saveDb();

  return { syncedCount: totalSynced };
}

/**
 * Sync all connected Google Calendar accounts across all households
 */
export async function syncAllConnectedHouseholdCalendars(
  targetHouseholdId?: string
): Promise<{ totalSynced: number }> {
  try {
    const records = targetHouseholdId
      ? queryAll<GoogleSyncRecord>('SELECT * FROM user_google_sync WHERE householdId = ?', [targetHouseholdId])
      : queryAll<GoogleSyncRecord>('SELECT * FROM user_google_sync');

    let totalSynced = 0;
    for (const rec of records) {
      try {
        const res = await syncUserGoogleCalendar(rec.householdId, rec.userId);
        totalSynced += res.syncedCount;
      } catch (err) {
        console.error(`Failed to sync calendar for user ${rec.userId}:`, err);
      }
    }

    // Bidirectional sync: push any local events that haven't been pushed to Google yet
    try {
      await pushUnsyncedLocalEventsToGoogle(targetHouseholdId);
    } catch (pushErr) {
      console.warn('Failed to push unsynced local events in syncAllConnectedHouseholdCalendars:', pushErr);
    }

    return { totalSynced };
  } catch (err) {
    console.error('syncAllConnectedHouseholdCalendars error:', err);
    return { totalSynced: 0 };
  }
}

/**
 * Disconnect a user's Google Calendar and purge their synced Google events
 */
export function disconnectUserGoogleCalendar(householdId: string, userId: string): { success: boolean } {
  try {
    execute('DELETE FROM user_google_sync WHERE userId = ?', [userId]);
    execute(
      'DELETE FROM calendar_events WHERE (householdId = ? OR 1=1) AND assignedMemberId = ? AND isGoogleEvent = 1',
      [householdId, userId]
    );
    saveDb();
    return { success: true };
  } catch (err) {
    console.error('disconnectUserGoogleCalendar error:', err);
    return { success: false };
  }
}

/**
 * Get sync status for all users in a household
 */
export function getHouseholdGoogleSyncStatus(householdId: string): Array<{
  userId: string;
  connected: boolean;
  googleEmail: string | null;
  selectedCalendarCount: number;
  lastSyncedAt: string | null;
}> {
  // Auto-heal any records where userId belongs to this household
  try {
    execute(
      `UPDATE user_google_sync 
       SET householdId = ? 
       WHERE userId IN (SELECT id FROM users WHERE householdId = ?) 
         AND householdId != ?`,
      [householdId, householdId, householdId]
    );
    saveDb();
  } catch {}

  const records = queryAll<GoogleSyncRecord>(
    `SELECT userId, googleEmail, selectedCalendarIds, selectedCalendarId, lastSyncedAt 
     FROM user_google_sync 
     WHERE householdId = ? 
        OR userId IN (SELECT id FROM users WHERE householdId = ?)`,
    [householdId, householdId]
  );

  return records.map((r) => {
    let count = 1;
    if (r.selectedCalendarIds) {
      try {
        count = JSON.parse(r.selectedCalendarIds).length;
      } catch {}
    }
    return {
      userId: r.userId,
      connected: true,
      googleEmail: r.googleEmail,
      selectedCalendarCount: count,
      lastSyncedAt: r.lastSyncedAt,
    };
  });
}

/**
 * Periodic background sync timer (runs every 10 minutes)
 */
let syncIntervalTimer: NodeJS.Timeout | null = null;

export function initBackgroundGoogleSync(): void {
  if (syncIntervalTimer) return;

  setTimeout(() => {
    syncAllConnectedHouseholdCalendars().catch((e) => console.error('Initial background sync error:', e));
  }, 10000);

  syncIntervalTimer = setInterval(() => {
    syncAllConnectedHouseholdCalendars().catch((e) => console.error('Periodic background sync error:', e));
  }, 10 * 60 * 1000);
}

/**
 * Helper to pick a writable calendar ID from a sync record
 */
function pickFirstCalendarId(rec: GoogleSyncRecord): string {
  let candidates: string[] = [];
  if (rec.selectedCalendarIds) {
    try {
      const ids = JSON.parse(rec.selectedCalendarIds);
      if (Array.isArray(ids)) candidates.push(...ids.filter(Boolean));
    } catch {}
  }
  if (rec.selectedCalendarId && !candidates.includes(rec.selectedCalendarId)) {
    candidates.push(rec.selectedCalendarId);
  }
  if (rec.googleEmail && !candidates.includes(rec.googleEmail)) {
    candidates.push(rec.googleEmail);
  }
  if (!candidates.includes('primary')) {
    candidates.push('primary');
  }

  // 1. Prefer primary or user's email if writable
  const primaryOrEmail = candidates.find(
    (id) => (id === 'primary' || id === rec.googleEmail) && isCalendarWritable(id)
  );
  if (primaryOrEmail) return primaryOrEmail;

  // 2. Otherwise find the first candidate that is writable
  const writableCandidate = candidates.find((id) => isCalendarWritable(id));
  if (writableCandidate) return writableCandidate;

  // 3. Fallback to rec.googleEmail or 'primary'
  return rec.googleEmail || 'primary';
}

/**
 * Resolve target Google Calendar account and calendar ID for an event
 */
export function resolveTargetGoogleCalendar(
  event: any,
  creatorUserId?: string
): { record: GoogleSyncRecord; calendarId: string } | null {
  const householdId = event.householdId;
  if (!householdId) return null;

  const records = queryAll<GoogleSyncRecord>(
    `SELECT * FROM user_google_sync 
     WHERE householdId = ? 
        OR userId IN (SELECT id FROM users WHERE householdId = ?)`,
    [householdId, householdId]
  );

  if (records.length === 0) return null;

  // 1. If assigned to a specific member, check if any calendar is mapped to them
  if (event.assignedMemberId) {
    for (const rec of records) {
      if (rec.calendarMemberMap) {
        try {
          const map = JSON.parse(rec.calendarMemberMap);
          for (const [calId, mappedMemberId] of Object.entries(map)) {
            if (mappedMemberId === event.assignedMemberId && isCalendarWritable(calId)) {
              return { record: rec, calendarId: calId };
            }
          }
        } catch {}
      }
    }

    // Check if the assigned member has their own connected Google account
    const memberRec = records.find((r) => r.userId === event.assignedMemberId);
    if (memberRec) {
      return { record: memberRec, calendarId: pickFirstCalendarId(memberRec) };
    }
  }

  // 2. If creator has a connected Google account, check if they have a mapped family calendar or default
  if (creatorUserId) {
    const creatorRec = records.find((r) => r.userId === creatorUserId);
    if (creatorRec) {
      if (creatorRec.calendarMemberMap) {
        try {
          const map = JSON.parse(creatorRec.calendarMemberMap);
          for (const [calId, mapped] of Object.entries(map)) {
            if ((mapped === 'family' || mapped === null) && isCalendarWritable(calId)) {
              return { record: creatorRec, calendarId: calId };
            }
          }
        } catch {}
      }
      return { record: creatorRec, calendarId: pickFirstCalendarId(creatorRec) };
    }
  }

  // 3. Fallback: check if any connected account has a calendar mapped to "family" (must be writable)
  for (const rec of records) {
    if (rec.calendarMemberMap) {
      try {
        const map = JSON.parse(rec.calendarMemberMap);
        for (const [calId, mapped] of Object.entries(map)) {
          if (mapped === 'family' && isCalendarWritable(calId)) {
            return { record: rec, calendarId: calId };
          }
        }
      } catch {}
    }
  }

  // 4. Fallback to first connected Google account using writable priority
  return { record: records[0], calendarId: pickFirstCalendarId(records[0]) };
}

/**
 * Get the timeZone of a Google Calendar (from cache or Google Calendar API)
 */
export async function getCalendarTimeZone(calendarId: string, accessToken?: string): Promise<string> {
  if (calendarTimeZoneCache.has(calendarId)) {
    return calendarTimeZoneCache.get(calendarId)!;
  }

  if (accessToken) {
    try {
      const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = (await res.json()) as { timeZone?: string };
        if (data.timeZone) {
          calendarTimeZoneCache.set(calendarId, data.timeZone);
          return data.timeZone;
        }
      }
    } catch {}
  }

  return 'America/Chicago';
}

function addDaysToDate(dateStr: string, days: number = 1): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().split('T')[0];
}

function normalizeTimeStr(timeStr?: string | null): string {
  if (!timeStr) return '09:00:00';
  const parts = timeStr.split(':');
  const h = parts[0]?.padStart(2, '0') || '00';
  const m = parts[1]?.padStart(2, '0') || '00';
  const s = parts[2]?.padStart(2, '0') || '00';
  return `${h}:${m}:${s}`;
}

/**
 * Format a Homebase event into a Google Calendar API resource
 */
function buildGoogleEventResource(event: any, targetTimeZone?: string) {
  const summary = event.title?.trim() || '(No Title)';
  const description = event.description?.trim() || undefined;
  const location = event.location?.trim() || undefined;

  const isAllDay =
    Boolean(event.isAllDay) ||
    Boolean(event.is_all_day) ||
    !event.startTime ||
    (event.startTime === '00:00' && (event.endTime === '23:59' || !event.endTime));

  const startDateStr = event.date || new Date().toISOString().split('T')[0];

  if (isAllDay) {
    const endDateStr = addDaysToDate(startDateStr, 1);
    return {
      summary,
      description,
      location,
      start: { date: startDateStr },
      end: { date: endDateStr },
    };
  }

  const cleanStart = normalizeTimeStr(event.startTime);
  let endDateStr = startDateStr;
  let cleanEnd: string;

  if (event.endTime) {
    cleanEnd = normalizeTimeStr(event.endTime);
    if (cleanEnd < cleanStart) {
      // Overnight event (e.g. 23:00 to 03:00 next day)
      endDateStr = addDaysToDate(startDateStr, 1);
    } else if (cleanEnd === cleanStart) {
      // Equal start and end times - Google rejects with timeRangeEmpty, so add 1 hour
      const [h, min] = cleanStart.split(':').map(Number);
      const endH = h + 1;
      if (endH >= 24) {
        endDateStr = addDaysToDate(startDateStr, 1);
        cleanEnd = `${String(endH % 24).padStart(2, '0')}:${String(min || 0).padStart(2, '0')}:00`;
      } else {
        cleanEnd = `${String(endH).padStart(2, '0')}:${String(min || 0).padStart(2, '0')}:00`;
      }
    }
  } else {
    // Default to 1 hour after start
    const [h, min] = cleanStart.split(':').map(Number);
    const endH = h + 1;
    if (endH >= 24) {
      endDateStr = addDaysToDate(startDateStr, 1);
      cleanEnd = `${String(endH % 24).padStart(2, '0')}:${String(min || 0).padStart(2, '0')}:00`;
    } else {
      cleanEnd = `${String(endH).padStart(2, '0')}:${String(min || 0).padStart(2, '0')}:00`;
    }
  }

  // Priority: 1. target calendar's timezone, 2. event's timezone, 3. 'America/Chicago'
  // NEVER use server's UTC as it causes 5-6 hour shifts in US timezones!
  let tz = targetTimeZone || event.timezone;
  if (!tz || tz === 'UTC' || tz === 'Etc/UTC') {
    tz = 'America/Chicago';
  }

  return {
    summary,
    description,
    location,
    start: {
      dateTime: `${startDateStr}T${cleanStart}`,
      timeZone: tz,
    },
    end: {
      dateTime: `${endDateStr}T${cleanEnd}`,
      timeZone: tz,
    },
  };
}

/**
 * Push a new Homebase event immediately to Google Calendar
 */
export async function pushEventToGoogleCalendar(
  event: any,
  creatorUserId?: string,
  clientTimeZone?: string
): Promise<{ googleEventId: string; googleCalendarId: string } | null> {
  if (!event || !event.id || !event.householdId) return null;

  // If already pushed, update it instead
  if (event.googleEventId && event.googleCalendarId) {
    await updateEventInGoogleCalendar(event, clientTimeZone);
    return { googleEventId: event.googleEventId, googleCalendarId: event.googleCalendarId };
  }

  const target = resolveTargetGoogleCalendar(event, creatorUserId);
  if (!target) {
    return null;
  }

  const accessToken = await getValidAccessToken(target.record);
  if (!accessToken) {
    console.warn(`[pushEventToGoogleCalendar] Unable to acquire valid access token for user ${target.record.userId}`);
    return null;
  }

  const calTz = await getCalendarTimeZone(target.calendarId, accessToken);
  const targetTz = calTz || clientTimeZone || event.timezone || 'America/Chicago';
  const resource = buildGoogleEventResource(event, targetTz);
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(target.calendarId)}/events`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(resource),
    });

    if (!res.ok) {
      const errText = await res.text();
      // If target calendar is read-only, cache and retry with user's primary/email calendar
      if (res.status === 403 && (errText.includes('requiredAccessLevel') || errText.includes('writer access'))) {
        calendarAccessRoleCache.set(target.calendarId, 'reader');
        const fallbackCalId = target.record.googleEmail || 'primary';
        if (target.calendarId !== fallbackCalId && target.calendarId !== 'primary') {
          console.warn(
            `[pushEventToGoogleCalendar] Calendar "${target.calendarId}" is read-only. Retrying push with primary "${fallbackCalId}"...`
          );
          const fallbackTz = await getCalendarTimeZone(fallbackCalId, accessToken);
          const fallbackResource = buildGoogleEventResource(event, fallbackTz || targetTz);
          const retryUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(fallbackCalId)}/events`;
          try {
            const retryRes = await fetch(retryUrl, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(fallbackResource),
            });
            if (retryRes.ok) {
              const retryGcal = (await retryRes.json()) as { id?: string };
              if (retryGcal?.id) {
                execute(
                  `UPDATE calendar_events
                   SET googleEventId = ?,
                       googleCalendarId = ?,
                       isGoogleEvent = 1
                   WHERE id = ?`,
                  [retryGcal.id, fallbackCalId, event.id]
                );
                saveDb();
                return { googleEventId: retryGcal.id, googleCalendarId: fallbackCalId };
              }
            } else {
              const retryErr = await retryRes.text();
              console.warn(`[pushEventToGoogleCalendar] Fallback push also failed (${retryRes.status}):`, retryErr);
            }
          } catch (retryErr) {
            console.warn('[pushEventToGoogleCalendar] Network error on retry:', retryErr);
          }
        }
      }

      console.warn(`[pushEventToGoogleCalendar] Google API error (${res.status}) for "${event.title}" (${event.id}):`, errText);
      return null;
    }

    const gcalEvent = (await res.json()) as { id?: string };
    if (!gcalEvent || !gcalEvent.id) return null;

    execute(
      `UPDATE calendar_events
       SET googleEventId = ?,
           googleCalendarId = ?,
           isGoogleEvent = 1
       WHERE id = ?`,
      [gcalEvent.id, target.calendarId, event.id]
    );
    saveDb();

    return { googleEventId: gcalEvent.id, googleCalendarId: target.calendarId };
  } catch (err) {
    console.warn('[pushEventToGoogleCalendar] Network or unexpected error:', err);
    return null;
  }
}

/**
 * Update an existing event in Google Calendar
 */
export async function updateEventInGoogleCalendar(event: any, clientTimeZone?: string): Promise<boolean> {
  if (!event || !event.id) return false;

  const dbEvent = queryOne<any>('SELECT * FROM calendar_events WHERE id = ?', [event.id]);
  const fullEvent = { ...dbEvent, ...event };

  const googleEventId = fullEvent.googleEventId;
  const googleCalendarId = fullEvent.googleCalendarId;

  // If not yet pushed to Google, push now
  if (!googleEventId || !googleCalendarId) {
    const pushed = await pushEventToGoogleCalendar(fullEvent, fullEvent.assignedMemberId, clientTimeZone);
    return Boolean(pushed);
  }

  // Find the sync record that has access to this calendar or in this household
  let record = queryOne<GoogleSyncRecord>(
    `SELECT * FROM user_google_sync 
     WHERE (householdId = ? OR userId IN (SELECT id FROM users WHERE householdId = ?))
       AND (selectedCalendarIds LIKE ? OR selectedCalendarId = ? OR calendarMemberMap LIKE ?)
     LIMIT 1`,
    [fullEvent.householdId, fullEvent.householdId, `%${googleCalendarId}%`, googleCalendarId, `%${googleCalendarId}%`]
  );

  if (!record) {
    record = queryOne<GoogleSyncRecord>(
      `SELECT * FROM user_google_sync 
       WHERE householdId = ? OR userId IN (SELECT id FROM users WHERE householdId = ?)
       LIMIT 1`,
      [fullEvent.householdId, fullEvent.householdId]
    );
  }

  if (!record) return false;

  const accessToken = await getValidAccessToken(record);
  if (!accessToken) return false;

  const calTz = await getCalendarTimeZone(googleCalendarId, accessToken);
  const targetTz = calTz || clientTimeZone || fullEvent.timezone || 'America/Chicago';
  const resource = buildGoogleEventResource(fullEvent, targetTz);
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
    googleCalendarId
  )}/events/${encodeURIComponent(googleEventId)}`;

  try {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(resource),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[updateEventInGoogleCalendar] Google API error (${res.status}) for "${fullEvent.title}" (${fullEvent.id}):`, errText);
      return false;
    }

    return true;
  } catch (err) {
    console.warn('[updateEventInGoogleCalendar] Network or unexpected error:', err);
    return false;
  }
}

/**
 * Delete an event from Google Calendar
 */
export async function deleteEventFromGoogleCalendar(eventId: string, householdId?: string): Promise<boolean> {
  if (!eventId) return false;

  const event = queryOne<any>('SELECT * FROM calendar_events WHERE id = ?', [eventId]);
  if (!event || !event.googleEventId || !event.googleCalendarId) {
    return false;
  }

  const hId = householdId || event.householdId;
  const googleCalendarId = event.googleCalendarId;
  const googleEventId = event.googleEventId;

  let record = queryOne<GoogleSyncRecord>(
    `SELECT * FROM user_google_sync 
     WHERE (householdId = ? OR userId IN (SELECT id FROM users WHERE householdId = ?))
       AND (selectedCalendarIds LIKE ? OR selectedCalendarId = ? OR calendarMemberMap LIKE ?)
     LIMIT 1`,
    [hId, hId, `%${googleCalendarId}%`, googleCalendarId, `%${googleCalendarId}%`]
  );

  if (!record) {
    record = queryOne<GoogleSyncRecord>(
      `SELECT * FROM user_google_sync 
       WHERE householdId = ? OR userId IN (SELECT id FROM users WHERE householdId = ?)
       LIMIT 1`,
      [hId, hId]
    );
  }

  if (!record) return false;

  const accessToken = await getValidAccessToken(record);
  if (!accessToken) return false;

  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
    googleCalendarId
  )}/events/${encodeURIComponent(googleEventId)}`;

  try {
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok && res.status !== 404 && res.status !== 410) {
      const errText = await res.text();
      console.warn(`[deleteEventFromGoogleCalendar] Google API error (${res.status}):`, errText);
      return false;
    }

    return true;
  } catch (err) {
    console.warn('[deleteEventFromGoogleCalendar] Network or unexpected error:', err);
    return false;
  }
}

/**
 * Push all local events that have not been synced to Google yet
 */
export async function pushUnsyncedLocalEventsToGoogle(householdId?: string): Promise<{ pushedCount: number }> {
  try {
    let query = 'SELECT * FROM calendar_events WHERE (googleEventId IS NULL OR googleEventId = "")';
    const params: any[] = [];
    if (householdId) {
      query += ' AND householdId = ?';
      params.push(householdId);
    }
    const unsynced = queryAll<any>(query, params);
    let pushedCount = 0;

    for (const ev of unsynced) {
      try {
        const res = await pushEventToGoogleCalendar(ev, ev.assignedMemberId);
        if (res) pushedCount++;
      } catch (e) {
        console.warn(`[pushUnsyncedLocalEventsToGoogle] Error pushing event ${ev.id}:`, e);
      }
    }
    return { pushedCount };
  } catch (err) {
    console.error('pushUnsyncedLocalEventsToGoogle error:', err);
    return { pushedCount: 0 };
  }
}

