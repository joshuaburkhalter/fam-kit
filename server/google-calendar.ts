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

function getGoogleCredentials() {
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
    prompt: 'consent',
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

    const { householdId, userId, redirectUri } = state;
    if (!householdId || !userId) {
      throw new Error('Missing householdId or userId in OAuth state.');
    }

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
      throw new Error(`Google token exchange failed: ${tokenRes.statusText}`);
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
      'SELECT * FROM user_google_sync WHERE userId = ? AND householdId = ?',
      [userId, householdId]
    );

    if (!refreshToken && existing?.refreshToken) {
      refreshToken = existing.refreshToken;
    }

    if (!refreshToken) {
      throw new Error('No refresh token received from Google. Please reconnect and grant permissions.');
    }

    if (existing) {
      execute(
        `UPDATE user_google_sync
         SET googleEmail = ?,
             accessToken = ?,
             refreshToken = ?,
             tokenExpiry = ?,
             lastSyncedAt = ?
         WHERE userId = ? AND householdId = ?`,
        [userEmail || existing.googleEmail, accessToken, refreshToken, expiryMs, now, userId, householdId]
      );
    } else {
      const id = `gsync_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      execute(
        `INSERT INTO user_google_sync (id, userId, householdId, googleEmail, accessToken, refreshToken, tokenExpiry, selectedCalendarId, selectedCalendarIds, calendarMemberMap, syncToken, lastSyncedAt, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'primary', '["primary"]', null, null, ?, ?)`,
        [id, userId, householdId, userEmail, accessToken, refreshToken, expiryMs, now, now]
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
  const record = queryOne<GoogleSyncRecord>(
    'SELECT * FROM user_google_sync WHERE userId = ? AND householdId = ?',
    [userId, householdId]
  );

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

    const calendars: GoogleCalendarEntry[] = (data.items || []).map((cal) => {
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
    const record = queryOne<GoogleSyncRecord>(
      'SELECT * FROM user_google_sync WHERE userId = ? AND householdId = ?',
      [userId, householdId]
    );

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
  const record = queryOne<GoogleSyncRecord>(
    'SELECT * FROM user_google_sync WHERE userId = ? AND householdId = ?',
    [userId, householdId]
  );

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
        if (!item.id) continue;

        if (item.status === 'cancelled') {
          execute(
            'DELETE FROM calendar_events WHERE householdId = ? AND googleEventId = ?',
            [householdId, item.id]
          );
          continue;
        }

        const title = item.summary?.trim() || '(Untitled Event)';
        const description = item.description?.trim() || null;
        const location = item.location?.trim() || null;

        let date = '';
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

        const existingEvent = queryOne<{ id: string }>(
          'SELECT id FROM calendar_events WHERE householdId = ? AND googleEventId = ?',
          [householdId, item.id]
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
                 isGoogleEvent = 1
             WHERE id = ? AND householdId = ?`,
            [title, description, date, startTime, endTime, location, assignedMemberId, calId, existingEvent.id, householdId]
          );
        } else {
          const id = `gcal_${item.id.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 60)}`;
          execute(
            `INSERT INTO calendar_events (id, title, description, date, startTime, endTime, category, location, assignedMemberId, householdId, isGoogleEvent, googleEventId, googleCalendarId, createdAt)
             VALUES (?, ?, ?, ?, ?, ?, 'Google Calendar', ?, ?, ?, 1, ?, ?, ?)`,
            [id, title, description, date, startTime, endTime, location, assignedMemberId, householdId, item.id, calId, nowIso]
          );
        }
        totalSynced++;
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
    execute('DELETE FROM user_google_sync WHERE householdId = ? AND userId = ?', [householdId, userId]);
    execute(
      'DELETE FROM calendar_events WHERE householdId = ? AND isGoogleEvent = 1',
      [householdId]
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
  const records = queryAll<GoogleSyncRecord>(
    'SELECT userId, googleEmail, selectedCalendarIds, selectedCalendarId, lastSyncedAt FROM user_google_sync WHERE householdId = ?',
    [householdId]
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
