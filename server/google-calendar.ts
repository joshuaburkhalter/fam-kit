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
  syncToken: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
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
    prompt: 'consent', // Ensure refresh token is always returned
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

    // Check if record already exists for this user in this household
    const existing = queryOne<GoogleSyncRecord>(
      'SELECT * FROM user_google_sync WHERE userId = ? AND householdId = ?',
      [userId, householdId]
    );

    // If Google didn't supply a new refresh token (already authorized), preserve the previous one
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
        `INSERT INTO user_google_sync (id, userId, householdId, googleEmail, accessToken, refreshToken, tokenExpiry, selectedCalendarId, syncToken, lastSyncedAt, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'primary', null, ?, ?)`,
        [id, userId, householdId, userEmail, accessToken, refreshToken, expiryMs, now, now]
      );
    }
    saveDb();

    // Trigger initial automatic sync immediately
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
  // If accessToken exists and has at least 3 minutes before expiration, use it
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
 * Sync events for a specific user from their primary Google Calendar
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

  const now = new Date();
  const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const future90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const timeMin = past30.toISOString();
  const timeMax = future90.toISOString();

  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(
    timeMin
  )}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=250`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Google Calendar events API returned error:', res.status, errText);
      return { syncedCount: 0, error: `Google API error: ${res.statusText}` };
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
    let syncedCount = 0;
    const nowIso = new Date().toISOString();

    for (const item of items) {
      if (!item.id) continue;

      // Cleanly remove cancelled/deleted events
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
        // All-day event
        date = item.start.date;
        startTime = null;
        endTime = null;
      } else if (item.start?.dateTime) {
        // Timed event
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
               isGoogleEvent = 1
           WHERE id = ? AND householdId = ?`,
          [title, description, date, startTime, endTime, location, userId, existingEvent.id, householdId]
        );
      } else {
        const id = `gcal_${item.id.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 60)}`;
        execute(
          `INSERT INTO calendar_events (id, title, description, date, startTime, endTime, category, location, assignedMemberId, householdId, isGoogleEvent, googleEventId, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, 'Google Calendar', ?, ?, ?, 1, ?, ?)`,
          [id, title, description, date, startTime, endTime, location, userId, householdId, item.id, nowIso]
        );
      }
      syncedCount++;
    }

    // Update lastSyncedAt on the sync record
    execute(
      'UPDATE user_google_sync SET lastSyncedAt = ? WHERE id = ?',
      [nowIso, record.id]
    );
    saveDb();

    return { syncedCount };
  } catch (err: any) {
    console.error('syncUserGoogleCalendar error:', err);
    return { syncedCount: 0, error: err.message || 'Sync failed' };
  }
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
      'DELETE FROM calendar_events WHERE householdId = ? AND assignedMemberId = ? AND isGoogleEvent = 1',
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
  lastSyncedAt: string | null;
}> {
  const records = queryAll<GoogleSyncRecord>(
    'SELECT userId, googleEmail, lastSyncedAt FROM user_google_sync WHERE householdId = ?',
    [householdId]
  );

  return records.map((r) => ({
    userId: r.userId,
    connected: true,
    googleEmail: r.googleEmail,
    lastSyncedAt: r.lastSyncedAt,
  }));
}

/**
 * Periodic background sync timer (runs every 10 minutes)
 */
let syncIntervalTimer: NodeJS.Timeout | null = null;

export function initBackgroundGoogleSync(): void {
  if (syncIntervalTimer) return;

  // Run initial pass after 10 seconds of server boot
  setTimeout(() => {
    syncAllConnectedHouseholdCalendars().catch((e) => console.error('Initial background sync error:', e));
  }, 10000);

  // Repeat every 10 minutes
  syncIntervalTimer = setInterval(() => {
    syncAllConnectedHouseholdCalendars().catch((e) => console.error('Periodic background sync error:', e));
  }, 10 * 60 * 1000);
}
