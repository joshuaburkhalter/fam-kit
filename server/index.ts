import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { getDb, queryAll, queryOne, execute, saveDb, createDefaultAisles, generateSecureVoucherCode } from './db.js';
import { getGeminiModel } from './gemini.js';
import { parseRecipeFromUrl, parseRecipeFromHtml, parseRecipeFromImages, getCuratedFoodImage, findAccurateRecipePhoto, generateRecipeImageWithImagen } from './recipe-parser.js';
import {
  sendPushNotificationToHousehold,
  sendPushNotificationToUser,
  vapidPublicKey,
  getNotificationPreferences,
  saveNotificationPreferences,
} from './push.js';
import { buildSelectiveAssistantContext } from './assistant-context.js';
import {
  getGoogleAuthUrl,
  handleGoogleAuthCallback,
  getHouseholdGoogleSyncStatus,
  getUserGoogleCalendars,
  updateUserSelectedCalendars,
  disconnectUserGoogleCalendar,
  syncAllConnectedHouseholdCalendars,
  initBackgroundGoogleSync,
  getGoogleCredentials,
  pushEventToGoogleCalendar,
  updateEventInGoogleCalendar,
  deleteEventFromGoogleCalendar,
  pushUnsyncedLocalEventsToGoogle,
} from './google-calendar.js';
import { isBasicPantryStaple } from './groceryStaples.js';
import {
  lookupBarcode,
  scanInventoryVision,
  matchRecipeIngredientsAgainstInventory,
  initBackgroundInventoryAlerts,
  InventoryItemRow,
} from './inventory.js';
import {
  calculateExpiryDate,
  getDaysUntilExpiry,
  getFreshnessStatus,
  PantryLocation,
} from './shelfLife.js';
import {
  saveCategoryPreference,
  resolveAisleForGroceryItem,
  getHouseholdGrocerySuggestions,
} from './groceryPreferences.js';

dotenv.config();
dotenv.config({ path: '.env.local' });

import Stripe from 'stripe';

function getStripe(): Stripe | null {
  const rawKey = process.env.STRIPE_SECRET_KEY;
  if (!rawKey || !rawKey.trim()) return null;
  const secretKey = rawKey.trim().replace(/^["']|["']$/g, '');
  if (!secretKey) return null;
  return new Stripe(secretKey, {
    apiVersion: '2025-02-24.acacia' as any,
  });
}

function getCleanOrigin(req: express.Request): string {
  const forwardedHost = req.headers['x-forwarded-host'] as string;
  const forwardedProto = (req.headers['x-forwarded-proto'] as string) || 'https';
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost.split(',')[0].trim()}`.replace(/\/$/, '');
  }

  const raw = req.headers.origin || req.headers.referer;
  if (raw) {
    try {
      return new URL(String(raw)).origin;
    } catch {}
  }

  const host = req.headers.host;
  if (host) {
    const proto = req.secure ? 'https' : 'http';
    return `${proto}://${host}`.replace(/\/$/, '');
  }

  return 'http://localhost:3001';
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();
const PORT = process.env.PORT || 3001;

export const APP_BUILD_ID =
  process.env.RENDER_GIT_COMMIT ||
  process.env.COMMIT_REF ||
  process.env.SOURCE_VERSION ||
  process.env.RENDER_INSTANCE_ID ||
  `build_${Date.now()}`;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.use((_req, res, next) => {
  res.setHeader('X-App-Build', APP_BUILD_ID);
  next();
});

app.get('/api/health', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.json({ status: 'ok', buildId: APP_BUILD_ID, timestamp: new Date().toISOString() });
});

app.get('/api/version', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.json({ buildId: APP_BUILD_ID, timestamp: new Date().toISOString() });
});

// Helper: Get active user from request headers
function getAuthUser(req: express.Request) {
  const authHeader = req.headers['authorization'];
  let userId = req.headers['x-user-id'] as string;
  if (!userId && authHeader?.startsWith('Bearer ')) {
    userId = authHeader.substring(7).trim();
  }
  if (!userId || userId === 'undefined') return null;
  return queryOne<{ id: string; name: string; username: string; email: string; avatar: string; color: string; role: string; householdId: string }>(
    'SELECT id, name, username, email, avatar, color, role, householdId FROM users WHERE id = ?',
    [userId]
  );
}

// Helper: Get active household ID
function getHouseholdId(req: express.Request): string {
  const header = req.headers['x-household-id'] as string;
  if (header && header.trim() && header !== 'undefined') return header.trim();

  const user = getAuthUser(req);
  if (user?.householdId) return user.householdId;

  const row = queryOne<{ id: string }>('SELECT id FROM households LIMIT 1');
  return row?.id || 'fam_default_1';
}

export function generateRandomInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function getUniqueInviteCode(): string {
  while (true) {
    const code = generateRandomInviteCode();
    const existing = queryOne('SELECT id FROM households WHERE inviteCode = ?', [code]);
    if (!existing) return code;
  }
}

function formatHousehold(h: any) {
  if (!h) return null;
  const code = h.inviteCode || h.invite_code || '';
  let status = h.subscriptionStatus || 'unpaid';
  const expiresAt = h.subscriptionExpiresAt || null;

  // Auto-expire if past the expiration timestamp
  if (status === 'active' && expiresAt) {
    const expTime = new Date(expiresAt).getTime();
    if (!isNaN(expTime) && expTime < Date.now()) {
      status = 'expired';
      try {
        execute('UPDATE households SET subscriptionStatus = ? WHERE id = ?', ['expired', h.id]);
      } catch {}
    }
  }

  const hasActiveAccess = status === 'active' || status === 'lifetime_founder';

  return {
    ...h,
    id: h.id,
    name: h.name,
    inviteCode: code,
    invite_code: code,
    subscriptionStatus: status,
    subscriptionPlan: h.subscriptionPlan || null,
    subscriptionExpiresAt: expiresAt,
    promoCodeUsed: h.promoCodeUsed || null,
    hasActiveAccess,
    createdAt: h.createdAt || h.created_at || '',
    created_at: h.createdAt || h.created_at || '',
  };
}

function formatUser(u: any) {
  if (!u) return null;
  const isPhoto = u.avatar && typeof u.avatar === 'string' && (u.avatar.startsWith('data:image') || u.avatar.startsWith('http://') || u.avatar.startsWith('https://'));
  const userColor = u.avatar_color || u.color || u.avatarColor || '#10b981';
  const role = (u.role && typeof u.role === 'string') ? u.role.toLowerCase() : 'member';
  const hid = u.household_id || u.householdId || '';
  return {
    id: u.id,
    household_id: hid,
    householdId: hid,
    name: u.name,
    username: u.username || undefined,
    email: u.email || undefined,
    avatar: isPhoto ? u.avatar : null,
    color: userColor,
    avatar_color: userColor,
    avatarColor: userColor,
    role,
    createdAt: u.createdAt || u.created_at || '',
    created_at: u.createdAt || u.created_at || '',
  };
}

// ---------------- AUTH ROUTES ----------------

// 0. Auth: Login
app.post('/api/auth/login', (req, res) => {
  const { identifier, username, email, password } = req.body;
  const loginInput = (identifier || username || email || '').trim();

  if (!loginInput || !password) {
    return res.status(400).json({ error: 'Username or email and password are required.' });
  }

  const cleanLogin = loginInput.toLowerCase();
  // Strictly match username OR email. No full name guessing!
  const user = queryOne<{ id: string; name: string; username: string; email: string; password: string; avatar: string; color: string; role: string; householdId: string }>(
    `SELECT * FROM users 
     WHERE LOWER(username) = ? 
        OR LOWER(email) = ?
     ORDER BY CASE WHEN id LIKE 'u_%' THEN 1 ELSE 2 END, id DESC`,
    [cleanLogin, cleanLogin]
  );

  if (!user) {
    return res.status(401).json({ error: 'No account found with that username or email.' });
  }

  if (user.password && user.password !== password.trim() && user.password !== 'password123') {
    return res.status(401).json({ error: 'Incorrect password. Please try again.' });
  }

  const household = queryOne('SELECT * FROM households WHERE id = ?', [user.householdId]);

  res.json({
    token: user.id,
    user: formatUser(user),
    household: formatHousehold(household),
  });
});

// 0. Auth: Register (New family or join family)
app.post('/api/auth/register', (req, res) => {
  const { username, name, email, password, avatarColor, role, action, householdName, inviteCode } = req.body;

  const rawUsername = (username || '').trim().toLowerCase();
  if (!rawUsername) {
    return res.status(400).json({ error: 'Username is required.' });
  }

  const cleanUsername = rawUsername.replace(/\s+/g, '');
  if (cleanUsername.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters long.' });
  }

  if (!/^[a-z0-9_-]+$/.test(cleanUsername)) {
    return res.status(400).json({ error: 'Username can only contain letters, numbers, underscores, and hyphens.' });
  }

  // Check if username already exists
  const existingUsername = queryOne<{ id: string }>('SELECT id FROM users WHERE LOWER(username) = ?', [cleanUsername]);
  if (existingUsername) {
    return res.status(400).json({ error: 'Username is already taken. Please choose another.' });
  }

  // Check email uniqueness if email provided
  const cleanEmail = email?.trim().toLowerCase() || null;
  if (cleanEmail) {
    const existingEmail = queryOne<{ id: string }>('SELECT id FROM users WHERE LOWER(email) = ?', [cleanEmail]);
    if (existingEmail) {
      return res.status(400).json({ error: 'An account with that email already exists.' });
    }
  }

  const displayName = (name && name.trim()) || cleanUsername;
  const userPassword = password?.trim() || 'password123';
  let targetHouseholdId: string;
  const now = new Date().toISOString();

  if (action === 'create_household') {
    if (!householdName || !householdName.trim()) {
      return res.status(400).json({ error: 'Household name is required to create a family.' });
    }

    targetHouseholdId = `fam_${Date.now()}`;
    const code = getUniqueInviteCode();

    let initialStatus = 'unpaid';
    let initialPlan: string | null = null;
    let initialExpiresAt: string | null = null;
    let initialPromoUsed: string | null = null;

    const promoInput = (req.body.promoCode || '').trim().toUpperCase();
    if (promoInput) {
      const cleanPromo = promoInput.replace(/[\s\-_]/g, '');
      let promoRow = queryOne<any>(
        'SELECT * FROM promo_codes WHERE UPPER(code) = ? AND (isActive = 1 OR isActive = true)',
        [promoInput]
      );
      if (!promoRow) {
        promoRow = queryOne<any>(
          "SELECT * FROM promo_codes WHERE REPLACE(REPLACE(REPLACE(UPPER(code), '-', ''), ' ', ''), '_', '') = ? AND (isActive = 1 OR isActive = true)",
          [cleanPromo]
        );
      }
      if (promoRow && (!promoRow.maxUses || promoRow.timesUsed < promoRow.maxUses)) {
        initialStatus = 'active';
        initialPlan = promoRow.durationMonths ? `promo_${promoRow.durationMonths}mo` : 'promo_lifetime';
        initialExpiresAt = promoRow.durationMonths
          ? new Date(Date.now() + promoRow.durationMonths * 30 * 24 * 60 * 60 * 1000).toISOString()
          : null;
        initialPromoUsed = promoRow.code;
        execute('UPDATE promo_codes SET timesUsed = timesUsed + 1 WHERE code = ?', [promoRow.code]);
      }
    }

    execute(
      'INSERT INTO households (id, name, inviteCode, createdAt, subscriptionStatus, subscriptionPlan, subscriptionExpiresAt, promoCodeUsed) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [targetHouseholdId, householdName.trim(), code, now, initialStatus, initialPlan, initialExpiresAt, initialPromoUsed]
    );
    createDefaultAisles(targetHouseholdId);
  } else if (action === 'join_household') {
    if (!inviteCode || !inviteCode.trim()) {
      return res.status(400).json({ error: 'Invite code is required to join a family.' });
    }

    const cleanCode = inviteCode.trim().toUpperCase();
    const foundHousehold = queryOne<{ id: string }>('SELECT id FROM households WHERE inviteCode = ?', [cleanCode]);
    if (!foundHousehold) {
      return res.status(404).json({ error: `No household found with invite code "${cleanCode}".` });
    }
    targetHouseholdId = foundHousehold.id;
  } else {
    const existing = queryOne<{ id: string }>('SELECT id FROM households LIMIT 1');
    targetHouseholdId = existing?.id || 'fam_default_1';
  }

  const userId = `u_${Date.now()}`;
  execute(
    'INSERT INTO users (id, name, username, email, avatar, color, role, householdId, password, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [userId, displayName, cleanUsername, cleanEmail, '👤', avatarColor || '#10b981', role || 'Member', targetHouseholdId, userPassword, now]
  );

  if (initialPromoUsed) {
    execute(
      `UPDATE promo_codes 
       SET claimedByUserName = COALESCE(claimedByUserName, ?),
           claimedByUserEmail = COALESCE(claimedByUserEmail, ?),
           claimedByHouseholdName = COALESCE(claimedByHouseholdName, ?),
           claimedAt = COALESCE(claimedAt, ?)
       WHERE code = ?`,
      [displayName, cleanEmail, householdName.trim(), now, initialPromoUsed]
    );
    execute(
      `INSERT OR IGNORE INTO promo_redemptions (id, promoCode, householdId, householdName, userId, userName, userEmail, redeemedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [`red_${initialPromoUsed}_${targetHouseholdId}`, initialPromoUsed, targetHouseholdId, householdName.trim(), userId, displayName, cleanEmail, now]
    );
  }

  const household = queryOne('SELECT * FROM households WHERE id = ?', [targetHouseholdId]);
  const user = {
    id: userId,
    name: displayName,
    username: cleanUsername,
    email: cleanEmail,
    avatar: '👤',
    color: avatarColor || '#10b981',
    role: role || 'Member',
    householdId: targetHouseholdId,
  };

  res.json({
    token: userId,
    user: formatUser(user),
    household: formatHousehold(household),
  });
});

// 0. Auth: Current User / Me
app.get('/api/auth/me', (req, res) => {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const household = queryOne('SELECT * FROM households WHERE id = ?', [user.householdId]);
  res.json({ user: formatUser(user), household: formatHousehold(household) });
});

// 0. Auth: Demo Users across Households
app.get('/api/auth/demo-users', (_req, res) => {
  const demoUsers = queryAll<{ id: string; name: string; username: string; email: string; avatar: string; color: string; role: string; householdId: string }>(
    'SELECT id, name, username, email, avatar, color, role, householdId FROM users WHERE email IS NOT NULL'
  );
  const households = queryAll<{ id: string; name: string; inviteCode: string }>('SELECT * FROM households');

  const formatted = demoUsers.map((u) => {
    const h = households.find((h) => h.id === u.householdId);
    return {
      ...u,
      householdName: h?.name || 'Household',
      inviteCode: h?.inviteCode || '',
    };
  });

  res.json(formatted);
});

// ---------------- SUBSCRIPTION & PROMO CODE ROUTES ----------------

// Rate limiting failed promo code attempts: max 5 failed attempts per 15 minutes
const failedPromoAttempts = new Map<string, { count: number; lastAttempt: number }>();

function checkPromoRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = failedPromoAttempts.get(key);
  if (!entry) return true;
  if (now - entry.lastAttempt > 15 * 60 * 1000) {
    failedPromoAttempts.delete(key);
    return true;
  }
  return entry.count < 5;
}

function recordFailedPromoAttempt(key: string) {
  const now = Date.now();
  const entry = failedPromoAttempts.get(key);
  if (!entry || now - entry.lastAttempt > 15 * 60 * 1000) {
    failedPromoAttempts.set(key, { count: 1, lastAttempt: now });
  } else {
    entry.count += 1;
    entry.lastAttempt = now;
  }
}

function clearFailedPromoAttempts(key: string) {
  failedPromoAttempts.delete(key);
}

// 1. Subscription status for active household
app.get('/api/subscription/status', (req, res) => {
  const householdId = getHouseholdId(req);
  const rawH = queryOne('SELECT * FROM households WHERE id = ?', [householdId]);
  if (!rawH) {
    return res.status(404).json({ error: 'Household not found' });
  }
  const h = formatHousehold(rawH);
  res.json({
    householdId: h.id,
    householdName: h.name,
    subscriptionStatus: h.subscriptionStatus,
    subscriptionPlan: h.subscriptionPlan,
    subscriptionExpiresAt: h.subscriptionExpiresAt,
    promoCodeUsed: h.promoCodeUsed,
    hasActiveAccess: h.hasActiveAccess,
  });
});

// 2. Redeem a free access promo code
app.post('/api/subscription/redeem', (req, res) => {
  const householdId = getHouseholdId(req);
  const { code } = req.body;
  const rawCode = (code || '').trim().toUpperCase();

  if (!rawCode) {
    return res.status(400).json({ error: 'Please enter a beta invite code.' });
  }

  const clientKey = `${req.ip || 'ip'}_${householdId}`;
  if (!checkPromoRateLimit(clientKey)) {
    return res.status(429).json({
      error: 'Too many unsuccessful attempts. Please wait 15 minutes before trying again.',
    });
  }

  const cleanCode = rawCode.replace(/[\s\-_]/g, '');

  try {
    const isDeleted = queryOne<any>(
      'SELECT code FROM deleted_promo_codes WHERE UPPER(code) = ? OR REPLACE(REPLACE(REPLACE(UPPER(code), "-", ""), " ", ""), "_", "") = ?',
      [rawCode, cleanCode]
    );
    if (isDeleted) {
      recordFailedPromoAttempt(clientKey);
      return res.status(400).json({ error: 'This invite code is no longer valid or has been deleted.' });
    }
  } catch {}

  let promo = queryOne<any>(
    'SELECT * FROM promo_codes WHERE UPPER(code) = ?',
    [rawCode]
  );
  if (!promo) {
    promo = queryOne<any>(
      "SELECT * FROM promo_codes WHERE REPLACE(REPLACE(REPLACE(UPPER(code), '-', ''), ' ', ''), '_', '') = ?",
      [cleanCode]
    );
  }

  if (!promo) {
    // Check if the user mistakenly typed their family invite code
    const isInviteCode = queryOne<any>(
      'SELECT id, name FROM households WHERE UPPER(inviteCode) = ?',
      [rawCode]
    );
    if (isInviteCode) {
      return res.status(400).json({
        error: `"${rawCode}" is a family invite code for "${isInviteCode.name}", not a beta access pass. To join that household, tap Sign Out and select "Join Family".`,
      });
    }

    recordFailedPromoAttempt(clientKey);
    return res.status(400).json({ error: 'Invalid or expired beta invite code.' });
  }

  if (promo.isActive !== 1 && promo.isActive !== true && promo.isActive !== '1') {
    recordFailedPromoAttempt(clientKey);
    return res.status(400).json({ error: 'This invite code is currently disabled.' });
  }

  if (promo.maxUses && promo.maxUses > 0 && promo.timesUsed >= promo.maxUses) {
    recordFailedPromoAttempt(clientKey);
    return res.status(400).json({ error: 'This invite code has reached its maximum redemptions.' });
  }

  clearFailedPromoAttempts(clientKey);

  const durationMonths = promo.durationMonths ? Number(promo.durationMonths) : null;
  const expiresAt = durationMonths
    ? new Date(Date.now() + durationMonths * 30 * 24 * 60 * 60 * 1000).toISOString()
    : null;
  const planName = durationMonths ? `promo_${durationMonths}mo` : 'promo_lifetime';

  execute(
    'UPDATE households SET subscriptionStatus = ?, subscriptionPlan = ?, subscriptionExpiresAt = ?, promoCodeUsed = ? WHERE id = ?',
    ['active', planName, expiresAt, promo.code, householdId]
  );

  const authUser = getAuthUser(req);
  const targetHousehold = queryOne<any>('SELECT * FROM households WHERE id = ?', [householdId]);
  const primaryUser = authUser || queryOne<any>('SELECT * FROM users WHERE householdId = ? ORDER BY id ASC LIMIT 1', [householdId]);
  const personName = primaryUser?.name || null;
  const personEmail = primaryUser?.email || null;
  const houseName = targetHousehold?.name || 'Household';
  const nowIso = new Date().toISOString();

  execute(
    `UPDATE promo_codes 
     SET timesUsed = timesUsed + 1,
         claimedByUserName = COALESCE(claimedByUserName, ?),
         claimedByUserEmail = COALESCE(claimedByUserEmail, ?),
         claimedByHouseholdName = COALESCE(claimedByHouseholdName, ?),
         claimedAt = COALESCE(claimedAt, ?)
     WHERE code = ?`,
    [personName, personEmail, houseName, nowIso, promo.code]
  );

  execute(
    `INSERT OR IGNORE INTO promo_redemptions (id, promoCode, householdId, householdName, userId, userName, userEmail, redeemedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [`red_${promo.code}_${householdId}`, promo.code, householdId, houseName, primaryUser?.id || null, personName, personEmail, nowIso]
  );

  const updatedHousehold = queryOne('SELECT * FROM households WHERE id = ?', [householdId]);
  const formatted = formatHousehold(updatedHousehold);

  const durationText = durationMonths
    ? `Beta invite code activated! ${durationMonths} months of beta access unlocked for your household.`
    : 'Beta invite code activated! Full closed beta access unlocked for your household.';

  res.json({
    success: true,
    message: durationText,
    household: formatted,
    durationMonths,
    expiresAt,
  });
});

// 3. Subscribe to a paid plan ($10/mo or $7/mo annually)
app.post('/api/subscription/subscribe', (req, res) => {
  const householdId = getHouseholdId(req);
  const { plan } = req.body; // 'monthly' | 'annual'

  if (plan !== 'monthly' && plan !== 'annual') {
    return res.status(400).json({ error: 'Invalid subscription plan. Choose monthly or annual.' });
  }

  const isAnnual = plan === 'annual';
  const durationDays = isAnnual ? 365 : 30;
  const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

  execute(
    'UPDATE households SET subscriptionStatus = ?, subscriptionPlan = ?, subscriptionExpiresAt = ?, promoCodeUsed = NULL WHERE id = ?',
    ['active', plan, expiresAt, householdId]
  );

  const updatedHousehold = queryOne('SELECT * FROM households WHERE id = ?', [householdId]);
  const formatted = formatHousehold(updatedHousehold);

  res.json({
    success: true,
    message: isAnnual
      ? 'Annual subscription activated ($7/mo billed annually at $84/yr)!'
      : 'Monthly subscription activated ($10/mo)!',
    household: formatted,
  });
});

// 3.1. Create Stripe Checkout Session (Redirects to Stripe hosted checkout)
app.post('/api/subscription/create-checkout-session', async (req, res) => {
  const householdId = getHouseholdId(req);
  const { plan } = req.body; // 'monthly' | 'annual'

  if (plan !== 'monthly' && plan !== 'annual') {
    return res.status(400).json({ error: 'Invalid subscription plan. Choose monthly or annual.' });
  }

  const stripe = getStripe();
  const monthlyPriceId = (process.env.STRIPE_PRICE_MONTHLY || 'price_1UGUN3ENC8h8A0IWVonYj7bF').trim().replace(/^["']|["']$/g, '');
  const annualPriceId = (process.env.STRIPE_PRICE_ANNUAL || 'price_1UGUN3ENC8h8A0IWfTmFAHMM').trim().replace(/^["']|["']$/g, '');
  const priceId = plan === 'annual' ? annualPriceId : monthlyPriceId;

  if (!stripe) {
    // If Stripe secret key is not set, activate in simulated mode
    const isAnnual = plan === 'annual';
    const durationDays = isAnnual ? 365 : 30;
    const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

    execute(
      'UPDATE households SET subscriptionStatus = ?, subscriptionPlan = ?, subscriptionExpiresAt = ?, promoCodeUsed = NULL WHERE id = ?',
      ['active', plan, expiresAt, householdId]
    );

    const updatedHousehold = queryOne('SELECT * FROM households WHERE id = ?', [householdId]);
    return res.json({
      simulated: true,
      message: `${isAnnual ? 'Annual ($7/mo)' : 'Monthly ($10/mo)'} subscription activated (Simulated mode - Add STRIPE_SECRET_KEY to enable live checkout).`,
      household: formatHousehold(updatedHousehold),
    });
  }

  try {
    const origin = getCleanOrigin(req);
    const user = getAuthUser(req);
    const household = queryOne<{ id: string; name: string; stripeCustomerId?: string }>(
      'SELECT id, name, stripeCustomerId FROM households WHERE id = ?',
      [householdId]
    );

    const validUserEmail = user?.email && user.email.includes('@') ? user.email.trim() : undefined;
    let customerId = household?.stripeCustomerId;
    if (!customerId && validUserEmail) {
      try {
        const customer = await stripe.customers.create({
          email: validUserEmail,
          name: user?.name || household?.name || 'Homebase Family',
          metadata: { householdId, userId: user?.id || '' },
        });
        customerId = customer.id;
        execute('UPDATE households SET stripeCustomerId = ? WHERE id = ?', [customerId, householdId]);
      } catch (e) {
        console.warn('Stripe customer creation note:', e);
      }
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer: customerId || undefined,
      customer_email: !customerId ? validUserEmail : undefined,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      client_reference_id: householdId,
      metadata: {
        householdId,
        userId: user?.id || '',
        plan,
      },
      subscription_data: {
        metadata: {
          householdId,
          userId: user?.id || '',
          plan,
        },
      },
      success_url: `${origin}/?stripe_session_id={CHECKOUT_SESSION_ID}&stripe_status=success`,
      cancel_url: `${origin}/pricing?canceled=true`,
    });

    res.json({ checkoutUrl: session.url });
  } catch (err: any) {
    console.error('Stripe checkout session error:', err);
    res.status(500).json({ error: err.message || 'Failed to create checkout session' });
  }
});

// 3.1b. Stripe Integration Health & Diagnostics (Safe for public inspection)
app.get('/api/subscription/stripe-status', (_req, res) => {
  const stripe = getStripe();
  const rawKey = process.env.STRIPE_SECRET_KEY || '';
  const cleanKey = rawKey.trim().replace(/^["']|["']$/g, '');
  const monthlyPriceId = (process.env.STRIPE_PRICE_MONTHLY || 'price_1UGUN3ENC8h8A0IWVonYj7bF').trim().replace(/^["']|["']$/g, '');
  const annualPriceId = (process.env.STRIPE_PRICE_ANNUAL || 'price_1UGUN3ENC8h8A0IWfTmFAHMM').trim().replace(/^["']|["']$/g, '');

  res.json({
    configured: Boolean(stripe),
    mode: stripe ? (cleanKey.startsWith('sk_test_') ? 'test' : 'live') : 'simulated',
    hasPublishableKey: Boolean((process.env.STRIPE_PUBLISHABLE_KEY || '').trim()),
    monthlyPriceId,
    annualPriceId,
  });
});

// 3.2. Verify Stripe Checkout Session on return
app.get('/api/subscription/verify-checkout-session', async (req, res) => {
  const sessionId = req.query.session_id as string;
  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID is required' });
  }

  const stripe = getStripe();
  if (!stripe) {
    return res.status(400).json({ error: 'Stripe is not configured' });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const householdId = session.client_reference_id || session.metadata?.householdId;
    const plan = session.metadata?.plan || 'annual';

    if (session.payment_status === 'paid' || session.status === 'complete') {
      if (householdId) {
        const isAnnual = plan === 'annual';
        const durationDays = isAnnual ? 365 : 30;
        const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
        const subId = typeof session.subscription === 'string' ? session.subscription : (session.subscription as any)?.id || null;
        const custId = typeof session.customer === 'string' ? session.customer : (session.customer as any)?.id || null;

        execute(
          'UPDATE households SET subscriptionStatus = ?, subscriptionPlan = ?, subscriptionExpiresAt = ?, stripeCustomerId = ?, stripeSubscriptionId = ? WHERE id = ?',
          ['active', plan, expiresAt, custId, subId, householdId]
        );

        const updatedHousehold = queryOne('SELECT * FROM households WHERE id = ?', [householdId]);
        return res.json({
          success: true,
          message: 'Payment confirmed! Household access is active.',
          household: formatHousehold(updatedHousehold),
        });
      }
    }

    res.json({ success: false, status: session.status, paymentStatus: session.payment_status });
  } catch (err: any) {
    console.error('Verify checkout session error:', err);
    res.status(500).json({ error: err.message || 'Failed to verify session' });
  }
});

// 3.3. Stripe Webhook Endpoint
app.post('/api/subscription/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const stripe = getStripe();
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: any;

  if (stripe && webhookSecret && sig) {
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
      console.error('Stripe webhook signature error:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  } else {
    event = typeof req.body === 'string' || Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString()) : req.body;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        const householdId = session.client_reference_id || session.metadata?.householdId;
        const plan = session.metadata?.plan || 'annual';
        if (householdId) {
          const isAnnual = plan === 'annual';
          const durationDays = isAnnual ? 365 : 30;
          const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
          execute(
            'UPDATE households SET subscriptionStatus = ?, subscriptionPlan = ?, subscriptionExpiresAt = ?, stripeCustomerId = ?, stripeSubscriptionId = ? WHERE id = ?',
            ['active', plan, expiresAt, session.customer, session.subscription, householdId]
          );
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as any;
        const householdId = sub.metadata?.householdId;
        if (householdId) {
          execute("UPDATE households SET subscriptionStatus = 'expired' WHERE id = ?", [householdId]);
        } else if (sub.id) {
          execute("UPDATE households SET subscriptionStatus = 'expired' WHERE stripeSubscriptionId = ?", [sub.id]);
        }
        break;
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object as any;
        const householdId = sub.metadata?.householdId;
        const status = sub.status === 'active' || sub.status === 'trialing' ? 'active' : 'expired';
        if (householdId) {
          execute("UPDATE households SET subscriptionStatus = ? WHERE id = ?", [status, householdId]);
        }
        break;
      }
    }
    res.json({ received: true });
  } catch (err: any) {
    console.error('Error handling webhook event:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// 4. Generate new secure promo code (Owner/Admin tool)
app.post('/api/subscription/generate-code', (req, res) => {
  const { durationMonths, description, maxUses, assignedTo, customCode } = req.body;
  const parsedDuration = durationMonths === 3 || durationMonths === 6 ? durationMonths : null;
  const assigned = typeof assignedTo === 'string' && assignedTo.trim() ? assignedTo.trim() : null;

  let code = '';
  if (typeof customCode === 'string' && customCode.trim()) {
    const raw = customCode.trim().toUpperCase();
    const clean = raw.replace(/[\s\-_]/g, '');
    const existing = queryOne<any>(
      "SELECT code FROM promo_codes WHERE REPLACE(REPLACE(REPLACE(UPPER(code), '-', ''), ' ', ''), '_', '') = ?",
      [clean]
    );
    if (existing) {
      return res.status(400).json({ error: `Code "${customCode}" already exists. Please choose another code.` });
    }
    code = raw;
  } else {
    const prefix = parsedDuration === 3 ? 'HB3' : parsedDuration === 6 ? 'HB6' : 'HBL';
    code = generateSecureVoucherCode(prefix);
  }

  const now = new Date().toISOString();
  const desc =
    description && description.trim()
      ? description.trim()
      : assigned
      ? `${parsedDuration ? `${parsedDuration} Months` : 'Lifetime'} Access for ${assigned}`
      : parsedDuration
      ? `${parsedDuration} Months Complimentary Family Access`
      : 'Lifetime Complimentary Access';
  const uses = typeof maxUses === 'number' && maxUses > 0 ? maxUses : 1;

  const authUser = getAuthUser(req);

  // If this code was previously deleted, unmark it so it can be used afresh
  try {
    const cleanCode = code.replace(/[\s\-_]/g, '').toUpperCase();
    execute(
      'DELETE FROM deleted_promo_codes WHERE UPPER(code) = ? OR REPLACE(REPLACE(REPLACE(UPPER(code), "-", ""), " ", ""), "_", "") = ?',
      [code.toUpperCase(), cleanCode]
    );
  } catch {}

  execute(
    'INSERT INTO promo_codes (code, description, durationMonths, maxUses, timesUsed, isActive, assignedTo, createdByUserId, createdAt) VALUES (?, ?, ?, ?, 0, 1, ?, ?, ?)',
    [code, desc, parsedDuration, uses, assigned, authUser?.id || null, now]
  );

  res.json({
    code,
    description: desc,
    durationMonths: parsedDuration,
    maxUses: uses,
    timesUsed: 0,
    isActive: true,
    assignedTo: assigned,
    createdAt: now,
  });
});

// 5. List promo codes with assigned household and redemption tracking
app.get('/api/subscription/promo-codes', (_req, res) => {
  try {
    const codes = queryAll<any>(`
      SELECT 
        p.*,
        COALESCE(
          p.claimedByHouseholdName,
          (
            SELECT group_concat(DISTINCT h.name)
            FROM households h
            WHERE REPLACE(REPLACE(REPLACE(UPPER(h.promoCodeUsed), '-', ''), ' ', ''), '_', '') = REPLACE(REPLACE(REPLACE(UPPER(p.code), '-', ''), ' ', ''), '_', '')
          )
        ) as claimedByHouseholdName,
        COALESCE(
          p.claimedByUserName,
          (
            SELECT group_concat(DISTINCT u.name)
            FROM households h
            JOIN users u ON u.householdId = h.id
            WHERE REPLACE(REPLACE(REPLACE(UPPER(h.promoCodeUsed), '-', ''), ' ', ''), '_', '') = REPLACE(REPLACE(REPLACE(UPPER(p.code), '-', ''), ' ', ''), '_', '')
          )
        ) as claimedByUserName,
        COALESCE(
          p.claimedByUserEmail,
          (
            SELECT group_concat(DISTINCT u.email)
            FROM households h
            JOIN users u ON u.householdId = h.id
            WHERE u.email IS NOT NULL AND REPLACE(REPLACE(REPLACE(UPPER(h.promoCodeUsed), '-', ''), ' ', ''), '_', '') = REPLACE(REPLACE(REPLACE(UPPER(p.code), '-', ''), ' ', ''), '_', '')
          )
        ) as claimedByUserEmail,
        COALESCE(
          p.claimedByHouseholdName,
          (
            SELECT group_concat(DISTINCT h.name)
            FROM households h
            WHERE REPLACE(REPLACE(REPLACE(UPPER(h.promoCodeUsed), '-', ''), ' ', ''), '_', '') = REPLACE(REPLACE(REPLACE(UPPER(p.code), '-', ''), ' ', ''), '_', '')
          )
        ) as redeemedBy
      FROM promo_codes p
      WHERE UPPER(p.code) NOT IN (SELECT UPPER(code) FROM deleted_promo_codes)
      ORDER BY p.createdAt DESC
      LIMIT 200
    `);

    let redemptions: any[] = [];
    try {
      redemptions = queryAll<any>('SELECT * FROM promo_redemptions ORDER BY redeemedAt DESC');
    } catch {}

    const redemptionsByCode = new Map<string, any[]>();
    for (const r of redemptions) {
      const key = (r.promoCode || '').toUpperCase().replace(/[\s\-_]/g, '');
      if (!redemptionsByCode.has(key)) redemptionsByCode.set(key, []);
      redemptionsByCode.get(key)!.push(r);
    }

    const enriched = codes.map((c) => {
      const key = (c.code || '').toUpperCase().replace(/[\s\-_]/g, '');
      const items = redemptionsByCode.get(key) || [];
      const isClaimed = items.length > 0 || !!c.claimedByHouseholdName || !!c.claimedByUserName || (c.timesUsed > 0);
      const effectiveTimesUsed = Math.max(c.timesUsed || 0, items.length, isClaimed ? 1 : 0);

      return {
        ...c,
        isActive: c.isActive === 1 || c.isActive === true || c.isActive === '1',
        timesUsed: effectiveTimesUsed,
        redemptions: items,
      };
    });

    res.json(enriched);
  } catch (err: any) {
    console.error('Error fetching promo codes:', err);
    res.status(500).json({ error: 'Failed to fetch promo codes', details: err?.message });
  }
});

// 6. Update promo code (assign recipient or toggle active)
app.patch('/api/subscription/promo-codes/:code', (req, res) => {
  const codeParam = req.params.code;
  const { assignedTo, isActive } = req.body;

  const row = queryOne<any>('SELECT * FROM promo_codes WHERE UPPER(code) = ?', [codeParam.toUpperCase()]);
  if (!row) {
    return res.status(404).json({ error: 'Promo code not found' });
  }

  const updates: string[] = [];
  const params: any[] = [];

  if (assignedTo !== undefined) {
    updates.push('assignedTo = ?');
    params.push(typeof assignedTo === 'string' && assignedTo.trim() ? assignedTo.trim() : null);
  }

  if (isActive !== undefined) {
    updates.push('isActive = ?');
    params.push((isActive === true || isActive === 1 || isActive === '1') ? 1 : 0);
  }

  if (updates.length > 0) {
    params.push(row.code);
    execute(`UPDATE promo_codes SET ${updates.join(', ')} WHERE code = ?`, params);
  }

  const updated = queryOne<any>(`
    SELECT p.*,
      (
        SELECT group_concat(h.name, ', ')
        FROM households h
        WHERE REPLACE(REPLACE(REPLACE(UPPER(h.promoCodeUsed), '-', ''), ' ', ''), '_', '') = REPLACE(REPLACE(REPLACE(UPPER(p.code), '-', ''), ' ', ''), '_', '')
      ) as redeemedBy
    FROM promo_codes p
    WHERE p.code = ?
  `, [row.code]);

  res.json({
    ...updated,
    isActive: updated ? (updated.isActive === 1 || updated.isActive === true || updated.isActive === '1') : true,
  });
});

// 7. Delete promo code permanently
app.delete('/api/subscription/promo-codes/:code', (req, res) => {
  const codeParam = req.params.code;
  const rawCode = (codeParam || '').trim().toUpperCase();
  const cleanCode = rawCode.replace(/[\s\-_]/g, '');

  const row = queryOne<any>(
    'SELECT * FROM promo_codes WHERE UPPER(code) = ? OR REPLACE(REPLACE(REPLACE(UPPER(code), "-", ""), " ", ""), "_", "") = ?',
    [rawCode, cleanCode]
  );

  const targetCode = row ? row.code : rawCode;
  const targetClean = targetCode.toUpperCase().replace(/[\s\-_]/g, '');
  const now = new Date().toISOString();

  // 1. Permanently record in deleted_promo_codes so it never gets resurrected by seeds or background scripts
  try {
    execute('INSERT OR REPLACE INTO deleted_promo_codes (code, deletedAt) VALUES (?, ?)', [targetCode.toUpperCase(), now]);
    if (targetClean !== targetCode.toUpperCase()) {
      execute('INSERT OR REPLACE INTO deleted_promo_codes (code, deletedAt) VALUES (?, ?)', [targetClean, now]);
    }
  } catch (e) {
    console.error('Error tracking deleted promo code:', e);
  }

  // 2. Delete from promo_codes table
  execute(
    'DELETE FROM promo_codes WHERE UPPER(code) = ? OR REPLACE(REPLACE(REPLACE(UPPER(code), "-", ""), " ", ""), "_", "") = ?',
    [targetCode.toUpperCase(), targetClean]
  );

  // 3. Delete from promo_redemptions table
  try {
    execute(
      'DELETE FROM promo_redemptions WHERE UPPER(promoCode) = ? OR REPLACE(REPLACE(REPLACE(UPPER(promoCode), "-", ""), " ", ""), "_", "") = ?',
      [targetCode.toUpperCase(), targetClean]
    );
  } catch {}

  // 4. Detach from households so no background queries or references reconstruct the code
  try {
    execute(
      'UPDATE households SET promoCodeUsed = NULL WHERE UPPER(promoCodeUsed) = ? OR REPLACE(REPLACE(REPLACE(UPPER(promoCodeUsed), "-", ""), " ", ""), "_", "") = ?',
      [targetCode.toUpperCase(), targetClean]
    );
  } catch {}

  res.json({ success: true, message: `Promo code ${targetCode} permanently deleted` });
});

// 6. Test helper to toggle or set subscription state
app.post('/api/subscription/test-set-state', (req, res) => {
  const householdId = getHouseholdId(req);
  const { status, plan, expiresAt } = req.body;
  const validStatus = status === 'active' || status === 'unpaid' || status === 'expired' ? status : 'unpaid';

  execute(
    'UPDATE households SET subscriptionStatus = ?, subscriptionPlan = ?, subscriptionExpiresAt = ? WHERE id = ?',
    [validStatus, plan || null, expiresAt || null, householdId]
  );

  const updatedHousehold = queryOne('SELECT * FROM households WHERE id = ?', [householdId]);
  res.json({
    success: true,
    household: formatHousehold(updatedHousehold),
  });
});

// ---------------- API ROUTES ----------------

// 1. Assistant Route (Gemini Multimodal + Tool Calling)
app.post('/api/assistant', async (req, res) => {
  try {
    const householdId = getHouseholdId(req);
    const {
      prompt,
      imageBase64,
      imageMimeType,
      customApiKey,
      activeMemberId,
      history,
      clientDate,
      clientDay,
      clientTime,
      timezone,
    } = req.body;

    if (!prompt && !imageBase64) {
      return res.status(400).json({ error: 'Please provide a message or image' });
    }

    const members = queryAll<{ id: string; name: string; role: string; color: string }>(
      'SELECT id, name, role, color FROM users WHERE householdId = ?',
      [householdId]
    );
    const aisles = queryAll<{ id: string; name: string; icon: string }>(
      'SELECT id, name, icon FROM aisles WHERE householdId = ? ORDER BY orderIndex ASC',
      [householdId]
    );

    const aisleNames = aisles.map((a) => a.name).join(', ');
    const { contextString, domainsIncluded } = buildSelectiveAssistantContext(
      householdId,
      prompt || '',
      clientDate,
      clientDay,
      clientTime,
      timezone
    );

    console.log(`[Assistant] Context domains included for "${(prompt || '').substring(0, 50)}":`, domainsIncluded);

    const contextAddition = `\nContext Information:
${contextString}
- Household Grocery Aisles (in order): ${aisleNames}
- Household ID: ${householdId}`;

    const model = getGeminiModel(customApiKey);

    // Sanitize and format previous turns for Gemini multi-turn chat
    const rawHistory = Array.isArray(history) ? history : [];
    const sanitizedHistory: Array<{ role: 'user' | 'model'; parts: [{ text: string }] }> = [];

    for (const h of rawHistory) {
      if (!h || typeof h.content !== 'string' || !h.content.trim()) continue;
      const role = h.role === 'assistant' ? 'model' : 'user';
      // First turn in Gemini history must be 'user'
      if (sanitizedHistory.length === 0 && role !== 'user') continue;

      const last = sanitizedHistory[sanitizedHistory.length - 1];
      if (last && last.role === role) {
        last.parts[0].text += `\n${h.content.trim()}`;
      } else {
        sanitizedHistory.push({
          role,
          parts: [{ text: h.content.trim() }],
        });
      }
    }

    // Ensure alternating pattern ending with 'model' before the new 'user' turn
    while (sanitizedHistory.length > 0 && sanitizedHistory[sanitizedHistory.length - 1].role === 'user') {
      sanitizedHistory.pop();
    }

    const parts: any[] = [];
    if (imageBase64) {
      parts.push({
        inlineData: {
          data: imageBase64.replace(/^data:image\/\w+;base64,/, ''),
          mimeType: imageMimeType || 'image/jpeg',
        },
      });
    }

    parts.push({
      text: `${prompt || 'Analyze this image and assist the family accordingly.'}\n${contextAddition}`,
    });

    const chat = model.startChat({
      history: sanitizedHistory,
    });

    const result = await chat.sendMessage(parts);
    const response = result.response;
    const functionCalls = response.functionCalls();

    const actionsExecuted: any[] = [];
    let assistantMessage = response.text() || '';

    if (functionCalls && functionCalls.length > 0) {
      // Avoid repeating pictures across recipes created in this batch or recently
      const recentRecipeImages = queryAll<{ imageUrl: string }>(
        'SELECT imageUrl FROM recipes WHERE householdId = ? AND imageUrl IS NOT NULL ORDER BY createdAt DESC LIMIT 30',
        [householdId]
      ).map((r) => r.imageUrl).filter(Boolean);
      const usedImagesInBatch = new Set<string>(recentRecipeImages);

      for (const call of functionCalls) {
        const { name } = call;
        const toolArgs = (call.args || {}) as any;

        // Tool: add_grocery_items
        if (name === 'add_grocery_items' && toolArgs.items) {
          const itemsToAdd = toolArgs.items as Array<{
            name: string;
            category?: string;
            quantity?: string;
            note?: string;
          }>;

          const createdItems: any[] = [];
          for (const item of itemsToAdd) {
            const rawName = (item.name || '').trim();
            if (!rawName) continue;

            // Auto-filter plain water (boiling water, tap water, etc.) as it's never a grocery item
            const lowerName = rawName.toLowerCase();
            const isPlainWater = /^(?:[\d\s½⅓⅔¼¾⅛⅜⅝⅞/.,-]+\s*(?:cups?|c|tbsp|tsp|ml|oz|liters?|quarts?|gallons?)\s+)?(?:boiling|warm|hot|cold|tap|ice|lukewarm|filtered|clean)?\s*water$/i.test(lowerName) &&
              !/\b(?:sparkling|mineral|coconut|tonic|rose|seltzer|bottled)\b/i.test(lowerName);
            if (isPlainWater) {
              console.log(`[Assistant] Filtered out staple water item: "${rawName}"`);
              continue;
            }

            // Auto-filter basic pantry staples if identified as recipe ingredients
            const isRecipeIngredient = !!(item.note && /recipe|for:/i.test(item.note));
            if (isRecipeIngredient && isBasicPantryStaple(rawName)) {
              console.log(`[Assistant] Filtered out recipe pantry staple: "${rawName}"`);
              continue;
            }

            const resolved = resolveAisleForGroceryItem(householdId, item.name, aisles, item.category);

            const id = `g_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const now = new Date().toISOString();

            execute(
              `INSERT INTO grocery_items (id, name, category, aisleId, quantity, note, checked, householdId, addedById, createdAt)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [id, item.name, resolved.category, resolved.aisleId, item.quantity || '1', item.note || null, 0, householdId, activeMemberId || 'u1', now]
            );

            createdItems.push({ id, name: item.name, category: resolved.category });
          }

          actionsExecuted.push({
            type: 'grocery_added',
            summary: `Added ${createdItems.length} item(s) to grocery list`,
            data: createdItems,
          });

          sendPushNotificationToHousehold(
            householdId,
            {
              title: '🛒 Grocery List Updated',
              body: `Added: ${createdItems.map((i) => i.name).join(', ')}`,
              url: '/grocery',
            },
            {
              category: 'grocery_added',
              actorUserId: activeMemberId || getAuthUser(req)?.id,
            }
          );
        }

        // Tool: add_calendar_events
        else if (name === 'add_calendar_events' && toolArgs.events) {
          const eventsToAdd = toolArgs.events as Array<{
            title: string;
            date: string;
            startTime?: string;
            endTime?: string;
            category?: string;
            assignedMemberName?: string;
            location?: string;
            description?: string;
          }>;

          const createdEvents: any[] = [];
          for (const ev of eventsToAdd) {
            const matchedMember = members.find((m) =>
              m.name.toLowerCase().includes((ev.assignedMemberName || '').toLowerCase())
            );

            const id = `ev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const now = new Date().toISOString();

            execute(
              `INSERT INTO calendar_events (id, title, description, date, startTime, endTime, category, location, assignedMemberId, householdId, createdAt)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [id, ev.title, ev.description || null, ev.date, ev.startTime || null, ev.endTime || null, ev.category || 'Family', ev.location || null, matchedMember?.id || null, householdId, now]
            );
            saveDb();

            const createdEv = queryOne('SELECT * FROM calendar_events WHERE id = ?', [id]);
            try {
              await pushEventToGoogleCalendar({ ...createdEv, timezone }, activeMemberId || getAuthUser(req)?.id, timezone);
            } catch (pushErr) {
              console.warn('Failed to push AI-scheduled event to Google Calendar:', pushErr);
            }

            createdEvents.push({ id, title: ev.title, date: ev.date });
          }

          actionsExecuted.push({
            type: 'calendar_event_added',
            summary: `Scheduled ${createdEvents.length} event(s) on family calendar`,
            data: createdEvents,
          });

          sendPushNotificationToHousehold(
            householdId,
            {
              title: '📅 New Calendar Event',
              body: createdEvents.map((e) => `${e.title} (${e.date})`).join(', '),
              url: '/calendar',
            },
            {
              category: 'calendar_events',
              actorUserId: activeMemberId || getAuthUser(req)?.id,
            }
          );
        }

        // Tool: delete_calendar_events
        else if (name === 'delete_calendar_events' && toolArgs.events) {
          const eventsToDelete = toolArgs.events as Array<{
            eventId?: string;
            title?: string;
            date?: string;
          }>;

          const deletedEvents: any[] = [];
          for (const ev of eventsToDelete) {
            let matchedRow: { id: string; title: string; date: string } | undefined;

            if (ev.eventId) {
              const rows = queryAll<{ id: string; title: string; date: string }>(
                'SELECT id, title, date FROM calendar_events WHERE id = ? AND householdId = ?',
                [ev.eventId, householdId]
              );
              if (rows.length > 0) matchedRow = rows[0];
            }

            if (!matchedRow && ev.title) {
              const query = ev.date
                ? 'SELECT id, title, date FROM calendar_events WHERE householdId = ? AND LOWER(title) LIKE ? AND date = ? LIMIT 1'
                : 'SELECT id, title, date FROM calendar_events WHERE householdId = ? AND LOWER(title) LIKE ? ORDER BY date DESC LIMIT 1';
              const params = ev.date
                ? [householdId, `%${ev.title.toLowerCase().trim()}%`, ev.date]
                : [householdId, `%${ev.title.toLowerCase().trim()}%`];
              const rows = queryAll<{ id: string; title: string; date: string }>(query, params);
              if (rows.length > 0) matchedRow = rows[0];
            }

            if (matchedRow) {
              try {
                await deleteEventFromGoogleCalendar(matchedRow.id, householdId);
              } catch (gcalErr) {
                console.warn('Failed to delete event from Google Calendar (AI tool):', gcalErr);
              }
              execute('DELETE FROM calendar_events WHERE id = ? AND householdId = ?', [matchedRow.id, householdId]);
              saveDb();
              deletedEvents.push(matchedRow);
            }
          }

          actionsExecuted.push({
            type: 'calendar_event_deleted',
            summary:
              deletedEvents.length > 0
                ? `Removed ${deletedEvents.length} event(s) from calendar: ${deletedEvents.map((e) => `"${e.title}"`).join(', ')}`
                : 'No matching calendar event found to remove',
            data: deletedEvents,
          });

          if (deletedEvents.length > 0) {
            sendPushNotificationToHousehold(
              householdId,
              {
                title: '📅 Calendar Event Removed',
                body: `Removed: ${deletedEvents.map((e) => e.title).join(', ')}`,
                url: '/calendar',
              },
              {
                category: 'calendar_events',
                actorUserId: activeMemberId || getAuthUser(req)?.id,
              }
            );
          }
        }

        // Tool: create_meal_plan
        else if (name === 'create_meal_plan' && toolArgs.meals) {
          const mealsToAdd = toolArgs.meals as Array<{
            date: string;
            mealType: string;
            title: string;
            notes?: string;
            addIngredientsToGrocery?: boolean;
            ingredients?: string[];
          }>;

          const createdMeals: any[] = [];
          for (const m of mealsToAdd) {
            const id = `m_${m.date}_${m.mealType}`;
            execute(
              `INSERT OR REPLACE INTO meal_plans (id, date, mealType, title, notes, householdId)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [id, m.date, m.mealType, m.title, m.notes || null, householdId]
            );

            // Also add to weekly_meals so it appears in the new Meals tab
            const wmId = `wm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const now = new Date().toISOString();
            execute(
              `INSERT INTO weekly_meals (id, title, notes, isMade, madeDate, weekStartDate, householdId, createdAt)
               VALUES (?, ?, ?, 0, NULL, ?, ?, ?)`,
              [wmId, m.title, m.notes || null, m.date, householdId, now]
            );

            createdMeals.push({ id, title: m.title, date: m.date });

            if (m.addIngredientsToGrocery && m.ingredients && m.ingredients.length > 0) {
              const now = new Date().toISOString();
              for (const ing of m.ingredients) {
                const gId = `g_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
                execute(
                  `INSERT INTO grocery_items (id, name, category, quantity, checked, householdId, addedById, createdAt)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                  [gId, ing, 'Produce', '1', 0, householdId, activeMemberId || 'u1', now]
                );
              }
            }
          }

          actionsExecuted.push({
            type: 'meal_planned',
            summary: `Added ${createdMeals.length} meal(s) to this week's meals`,
            data: createdMeals,
          });

          sendPushNotificationToHousehold(
            householdId,
            {
              title: '🍳 Meals Planned',
              body: createdMeals.map((m) => `${m.title} (${m.date})`).join(', '),
              url: '/meal-planner',
            },
            {
              category: 'meal_plans',
              actorUserId: activeMemberId || getAuthUser(req)?.id,
            }
          );
        }

        // Tool: create_custom_list
        else if (name === 'create_custom_list') {
          const { name: listName, type, icon, color, items } = toolArgs as {
            name: string;
            type?: string;
            icon?: string;
            color?: string;
            items: string[];
          };

          const listId = `list_${Date.now()}`;
          const now = new Date().toISOString();

          execute(
            `INSERT INTO custom_lists (id, name, type, icon, color, householdId, createdAt)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [listId, listName, type || 'packing', icon || '📋', color || '#10b981', householdId, now]
          );

          if (items && Array.isArray(items)) {
            for (const item of items) {
              const gId = `g_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
              execute(
                `INSERT INTO grocery_items (id, name, category, checked, listId, householdId, addedById, createdAt)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [gId, item, 'Packing', 0, listId, householdId, activeMemberId || 'u1', now]
              );
            }
          }

          actionsExecuted.push({
            type: 'list_created',
            summary: `Created custom checklist "${listName}" with ${items?.length || 0} items`,
            data: { id: listId, name: listName },
          });
        }

        // Tool: import_recipe_from_url
        else if (name === 'import_recipe_from_url' && toolArgs.url) {
          try {
            const parsed = await parseRecipeFromUrl(toolArgs.url as string, customApiKey);
            const recipeId = `r_${Date.now()}`;
            const now = new Date().toISOString();

            execute(
              `INSERT INTO recipes (id, title, description, imageUrl, prepTime, cookTime, servings, sourceUrl, ingredients, instructions, tags, householdId, createdAt)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                recipeId,
                parsed.title,
                parsed.description || null,
                parsed.imageUrl || null,
                parsed.prepTime || null,
                parsed.cookTime || null,
                parsed.servings || null,
                parsed.sourceUrl || null,
                JSON.stringify(parsed.ingredients),
                JSON.stringify(parsed.instructions),
                (parsed.tags || []).join(', '),
                householdId,
                now,
              ]
            );

            actionsExecuted.push({
              type: 'recipe_imported',
              summary: `Imported recipe: "${parsed.title}"`,
              data: { id: recipeId, title: parsed.title },
            });
          } catch (err: any) {
            console.error('Recipe parse error:', err);
          }
        }

        // Tool: create_recipe
        else if (name === 'create_recipe' && toolArgs.title) {
          const recipeId = `r_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const now = new Date().toISOString();

          // Normalize ingredients into structured objects
          const rawIngredients = Array.isArray(toolArgs.ingredients) ? toolArgs.ingredients : [];
          const formattedIngredients = rawIngredients.map((ing: any) => {
            if (typeof ing === 'string') return { item: ing };
            return {
              item: ing.item || ing.name || String(ing),
              amount: ing.amount ? String(ing.amount) : undefined,
              unit: ing.unit ? String(ing.unit) : undefined,
              category: ing.category || undefined,
            };
          });

          // Normalize instructions into strings
          const rawInstructions = Array.isArray(toolArgs.instructions) ? toolArgs.instructions : [];
          const formattedInstructions = rawInstructions.map((inst: any) => String(inst).trim()).filter(Boolean);

          // Normalize tags: ALWAYS ensure 'ai' is included
          const rawTags = Array.isArray(toolArgs.tags) ? toolArgs.tags : [];
          const tagSet = new Set<string>();
          tagSet.add('ai');
          for (const t of rawTags) {
            if (typeof t === 'string') {
              const clean = t.trim().replace(/^#/, '');
              if (clean) tagSet.add(clean);
            }
          }
          const tagsString = Array.from(tagSet).join(', ');

          // Determine photo: toolArgs.imageUrl or accurate matching food photo (signature/Wikipedia/curated)
          let imageUrl = toolArgs.imageUrl;
          if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.startsWith('http') || usedImagesInBatch.has(imageUrl)) {
            let imageQuery = toolArgs.imageQuery;
            if (!imageQuery) {
              const keyIngredients = formattedIngredients.slice(0, 4).map((i: any) => i.item).filter(Boolean);
              if (keyIngredients.length > 0) {
                imageQuery = `${toolArgs.title} with ${keyIngredients.join(', ')}`;
              }
            }
            imageUrl = await findAccurateRecipePhoto(
              toolArgs.title,
              toolArgs.description || '',
              Array.from(tagSet),
              imageQuery,
              usedImagesInBatch,
              formattedIngredients
            );
          }
          if (imageUrl) {
            usedImagesInBatch.add(imageUrl);
          }

          const prepTime = toolArgs.prepTime ? String(toolArgs.prepTime).replace(/[^0-9]/g, '') : null;
          const cookTime = toolArgs.cookTime ? String(toolArgs.cookTime).replace(/[^0-9]/g, '') : null;
          const servings = toolArgs.servings ? String(toolArgs.servings).replace(/[^0-9]/g, '') : null;

          execute(
            `INSERT INTO recipes (id, title, description, imageUrl, prepTime, cookTime, servings, sourceUrl, ingredients, instructions, tags, householdId, createdAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              recipeId,
              toolArgs.title.trim(),
              toolArgs.description?.trim() || null,
              imageUrl,
              prepTime || null,
              cookTime || null,
              servings || null,
              'Created by AI Assistant',
              JSON.stringify(formattedIngredients),
              JSON.stringify(formattedInstructions),
              tagsString,
              householdId,
              now,
            ]
          );

          actionsExecuted.push({
            type: 'recipe_created',
            summary: `Created recipe: "${toolArgs.title.trim()}" (tagged #ai)`,
            data: { id: recipeId, title: toolArgs.title.trim(), tags: Array.from(tagSet), imageUrl },
          });

          sendPushNotificationToHousehold(
            householdId,
            {
              title: '🍳 New Recipe Created',
              body: `"${toolArgs.title.trim()}" was added to your recipe box with #ai tag`,
              url: '/recipes',
            },
            {
              category: 'recipes_added',
              actorUserId: activeMemberId || getAuthUser(req)?.id,
            }
          );
        }
      }
    }

    if (!assistantMessage && actionsExecuted.length > 0) {
      assistantMessage = `Done! I've ${actionsExecuted.map((a) => a.summary.toLowerCase()).join(' and ')}.`;
    }

    res.json({ message: assistantMessage, actions: actionsExecuted, domainsIncluded });
  } catch (err: any) {
    console.error('Assistant error:', err);
    res.status(500).json({ error: err.message, message: `I encountered an issue: ${err.message}` });
  }
});

// Assistant Status & Test Route
app.get('/api/assistant/status', (_req, res) => {
  const hasServerKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);
  res.json({
    configured: hasServerKey,
    model: 'gemini-3.6-flash',
  });
});

app.post('/api/assistant/test', async (req, res) => {
  try {
    const { apiKey } = req.body;
    const keyToTest = apiKey || process.env.GEMINI_API_KEY;
    if (!keyToTest || !keyToTest.trim()) {
      return res.status(400).json({ error: 'Please provide an Assistant API key to test' });
    }

    const model = getGeminiModel(keyToTest.trim());
    const result = await model.generateContent('Say "Connected!" in 3 words or less.');
    const reply = result.response.text()?.trim() || 'Connected!';
    res.json({ success: true, message: reply });
  } catch (err: any) {
    console.error('Gemini test error:', err);
    res.status(500).json({ error: err.message || 'Failed to connect to Assistant API' });
  }
});

// 2. Grocery & Custom Lists API
app.get('/api/grocery', (req, res) => {
  const householdId = getHouseholdId(req);
  const listId = req.query.listId as string;

  const items = listId
    ? queryAll('SELECT * FROM grocery_items WHERE householdId = ? AND listId = ? ORDER BY checked ASC, createdAt DESC', [householdId, listId])
    : queryAll('SELECT * FROM grocery_items WHERE householdId = ? AND listId IS NULL ORDER BY checked ASC, createdAt DESC', [householdId]);

  const lists = queryAll('SELECT * FROM custom_lists WHERE householdId = ? ORDER BY createdAt ASC', [householdId]);
  const aisles = queryAll('SELECT * FROM aisles WHERE householdId = ? ORDER BY orderIndex ASC', [householdId]);

  // Auto-heal any existing grocery items missing an aisleId or miscategorized deli items
  if (!listId) {
    const deliAisle = aisles.find((a) => /deli|prepared/i.test(a.name));
    for (const it of items) {
      if (!it.aisleId) {
        const matched = resolveAisleForGroceryItem(householdId, it.name, aisles, it.category);
        if (matched && matched.aisleId) {
          it.aisleId = matched.aisleId;
          it.category = matched.category;
          execute('UPDATE grocery_items SET aisleId = ?, category = ? WHERE id = ?', [
            matched.aisleId,
            matched.category,
            it.id,
          ]);
        }
      } else if (deliAisle && /meat|seafood/i.test(it.category || '')) {
        const matched = resolveAisleForGroceryItem(householdId, it.name, aisles, it.category);
        if (matched && matched.aisleId === deliAisle.id) {
          it.aisleId = matched.aisleId;
          it.category = matched.category;
          execute('UPDATE grocery_items SET aisleId = ?, category = ? WHERE id = ?', [
            matched.aisleId,
            matched.category,
            it.id,
          ]);
        }
      }
    }
  }

  const suggestions = !listId || listId === 'grocery'
    ? getHouseholdGrocerySuggestions(householdId, aisles)
    : [];

  res.json({
    items: items.map((i: any) => ({ ...i, checked: Boolean(i.checked) })),
    lists,
    aisles,
    suggestions,
  });
});

app.post('/api/grocery', (req, res) => {
  try {
    const householdId = getHouseholdId(req);
    const { name, category, aisleId, quantity, unit, note, listId, addedById, createList, icon, type } = req.body;

    // Create custom list
    if (createList && name) {
      const id = `list_${Date.now()}`;
      const now = new Date().toISOString();
      execute(
        `INSERT INTO custom_lists (id, name, type, icon, color, householdId, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, name, type || 'packing', icon || '📋', '#10b981', householdId, now]
      );
      return res.json({ id, name, icon: icon || '📋', type: type || 'packing' });
    }

    if (!name) return res.status(400).json({ error: 'Name is required' });

    const id = `g_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    let finalAisleId = aisleId || null;
    let finalCategory = category || 'Other';

    // Auto-categorize using learned preferences + smart heuristics
    if (!listId || listId === 'grocery') {
      const aisles = queryAll<{ id: string; name: string }>(
        'SELECT id, name FROM aisles WHERE householdId = ? ORDER BY orderIndex ASC',
        [householdId]
      );
      const resolved = resolveAisleForGroceryItem(householdId, name, aisles, category || undefined, aisleId || undefined);
      finalAisleId = resolved.aisleId;
      finalCategory = resolved.category;
    }

    execute(
      `INSERT INTO grocery_items (id, name, category, aisleId, quantity, unit, note, checked, listId, addedById, householdId, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, finalCategory, finalAisleId, quantity || '1', unit || null, note || null, 0, listId || null, addedById || 'u1', householdId, now]
    );

    const actor = getAuthUser(req);
    sendPushNotificationToHousehold(
      householdId,
      {
        title: '🛒 Added to Grocery List',
        body: `${name}${quantity && quantity !== '1' ? ` (${quantity})` : ''}`,
        url: '/grocery',
      },
      {
        category: 'grocery_added',
        actorUserId: addedById || actor?.id,
      }
    );

    res.json({
      id,
      name,
      category: finalCategory,
      aisleId: finalAisleId,
      quantity: quantity || '1',
      unit,
      note,
      checked: false,
      listId,
      householdId,
      createdAt: now,
    });
  } catch (err: any) {
    console.error('Failed to add grocery item:', err);
    res.status(500).json({ error: err.message || 'Failed to add grocery item' });
  }
});

app.patch('/api/grocery', (req, res) => {
  const { id, checked, name, quantity, unit, note, aisleId, category } = req.body;
  if (!id) return res.status(400).json({ error: 'ID is required' });

  if (checked !== undefined) {
    execute('UPDATE grocery_items SET checked = ? WHERE id = ?', [checked ? 1 : 0, id]);
  }
  if (name !== undefined) execute('UPDATE grocery_items SET name = ? WHERE id = ?', [name.trim(), id]);
  if (quantity !== undefined) execute('UPDATE grocery_items SET quantity = ? WHERE id = ?', [quantity, id]);
  if (unit !== undefined) execute('UPDATE grocery_items SET unit = ? WHERE id = ?', [unit, id]);
  if (note !== undefined) execute('UPDATE grocery_items SET note = ? WHERE id = ?', [note, id]);
  if (category !== undefined) execute('UPDATE grocery_items SET category = ? WHERE id = ?', [category, id]);
  if (aisleId !== undefined) execute('UPDATE grocery_items SET aisleId = ? WHERE id = ?', [aisleId, id]);
  saveDb();

  const updated = queryOne<any>('SELECT * FROM grocery_items WHERE id = ?', [id]);

  // If item was moved to a different aisle/category, remember this preference for the household
  if ((aisleId !== undefined || category !== undefined) && updated && updated.aisleId) {
    const householdId = getHouseholdId(req);
    saveCategoryPreference(householdId, updated.name, updated.aisleId, updated.category || 'Other');
  }

  if (checked === true && updated) {
    const householdId = getHouseholdId(req);
    const actor = getAuthUser(req);
    sendPushNotificationToHousehold(
      householdId,
      {
        title: '🛒 Item Checked Off',
        body: `${updated.name || name} was checked off${actor ? ` by ${actor.name}` : ''}`,
        url: '/grocery',
      },
      {
        category: 'grocery_completed',
        actorUserId: actor?.id,
      }
    );
  }

  res.json(updated ? { ...updated, checked: Boolean(updated.checked) } : {});
});

app.delete('/api/grocery', (req, res) => {
  const householdId = getHouseholdId(req);
  const id = req.query.id as string;
  const clearChecked = req.query.clearChecked as string;
  const listId = req.query.listId as string;

  if (clearChecked === 'true') {
    if (listId) {
      execute('DELETE FROM grocery_items WHERE householdId = ? AND listId = ? AND checked = 1', [householdId, listId]);
    } else {
      execute('DELETE FROM grocery_items WHERE householdId = ? AND listId IS NULL AND checked = 1', [householdId]);
    }
    return res.json({ success: true });
  }

  const recipeTitle = req.query.recipeTitle as string;

  if (recipeTitle) {
    const trimmed = recipeTitle.trim();
    const pattern = `for: ${trimmed.toLowerCase()}%`;
    execute(
      'DELETE FROM grocery_items WHERE householdId = ? AND (LOWER(note) = ? OR LOWER(note) LIKE ?)',
      [householdId, `for: ${trimmed.toLowerCase()}`, pattern]
    );
    saveDb();
    return res.json({ success: true });
  }

  if (id) {
    execute('DELETE FROM grocery_items WHERE id = ?', [id]);
    return res.json({ success: true });
  }

  res.status(400).json({ error: 'Invalid delete parameters' });
});

// 3. Aisle Order & Custom Aisles API
app.get('/api/grocery/aisles', (req, res) => {
  const householdId = getHouseholdId(req);
  const aisles = queryAll('SELECT * FROM aisles WHERE householdId = ? ORDER BY orderIndex ASC', [householdId]);
  res.json(aisles);
});

app.post('/api/grocery/aisles', (req, res) => {
  const householdId = getHouseholdId(req);
  const { name, icon } = req.body;
  if (!name) return res.status(400).json({ error: 'Aisle name is required' });

  const id = `a_${Date.now()}`;
  const max = queryOne<{ maxIdx: number }>('SELECT MAX(orderIndex) as maxIdx FROM aisles WHERE householdId = ?', [householdId]);
  const orderIndex = (max?.maxIdx ?? -1) + 1;

  execute('INSERT INTO aisles VALUES (?, ?, ?, ?, ?)', [id, name, icon || '🛒', orderIndex, householdId]);
  res.json({ id, name, icon: icon || '🛒', orderIndex, householdId });
});

app.put('/api/grocery/aisles', (req, res) => {
  const { aisleOrders } = req.body;
  if (Array.isArray(aisleOrders)) {
    for (const item of aisleOrders) {
      execute('UPDATE aisles SET orderIndex = ? WHERE id = ?', [item.orderIndex, item.id]);
    }
  }
app.delete('/api/grocery/aisles', (req, res) => {
  const householdId = getHouseholdId(req);
  const id = req.query.id as string;
  if (!id) return res.status(400).json({ error: 'Aisle id is required' });

  // Delete aisle
  execute('DELETE FROM aisles WHERE id = ? AND householdId = ?', [id, householdId]);

  // Clean up any preferences pointing to this aisle
  execute('DELETE FROM grocery_category_preferences WHERE householdId = ? AND aisleId = ?', [householdId, id]);

  // Reset any grocery items in this aisle to unassigned/Other
  execute("UPDATE grocery_items SET aisleId = NULL, category = 'Other' WHERE householdId = ? AND aisleId = ?", [householdId, id]);
  saveDb();

  res.json({ success: true });
});

// 4. Recipes API
app.get('/api/recipes', (req, res) => {
  const householdId = getHouseholdId(req);
  const recipes = queryAll('SELECT * FROM recipes WHERE householdId = ? ORDER BY createdAt DESC', [householdId]);
  res.json(recipes);
});

app.post('/api/recipes', (req, res) => {
  try {
    const householdId = getHouseholdId(req);
    const { title, description, imageUrl, prepTime, cookTime, servings, sourceUrl, ingredients, instructions, tags } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Recipe title is required' });
    }
    const id = `r_${Date.now()}`;
    const now = new Date().toISOString();
    const tagStr = Array.isArray(tags) ? tags.join(', ') : (tags || '');
    execute(
      `INSERT INTO recipes (id, title, description, imageUrl, prepTime, cookTime, servings, sourceUrl, ingredients, instructions, tags, householdId, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        title.trim(),
        description?.trim() || null,
        imageUrl || null,
        prepTime ? String(prepTime) : null,
        cookTime ? String(cookTime) : null,
        servings ? String(servings) : null,
        sourceUrl || null,
        typeof ingredients === 'string' ? ingredients : JSON.stringify(ingredients || []),
        typeof instructions === 'string' ? instructions : JSON.stringify(instructions || []),
        tagStr,
        householdId,
        now,
      ]
    );
    saveDb();
    const saved = queryOne('SELECT * FROM recipes WHERE id = ?', [id]);
    res.json(saved);
  } catch (err: any) {
    console.error('Create recipe error:', err);
    res.status(500).json({ error: err.message || 'Failed to create recipe' });
  }
});

app.post('/api/recipes/import', async (req, res) => {
  try {
    const householdId = getHouseholdId(req);
    const { url, html, rawText, apiKey } = req.body;
    if (!url && !html && !rawText) {
      return res.status(400).json({ error: 'URL, HTML, or recipe text is required.' });
    }

    let parsed: any;
    let finalSourceUrl = url ? url.trim() : '';
    if (finalSourceUrl && !finalSourceUrl.startsWith('http')) {
      finalSourceUrl = `https://${finalSourceUrl}`;
    }

    if (html || rawText) {
      const content = html || `<html><body><pre>${rawText}</pre></body></html>`;
      parsed = await parseRecipeFromHtml(content, finalSourceUrl, apiKey);
    } else {
      parsed = await parseRecipeFromUrl(finalSourceUrl, apiKey);
    }

    const id = `r_${Date.now()}`;
    const now = new Date().toISOString();

    execute(
      `INSERT INTO recipes (id, title, description, imageUrl, prepTime, cookTime, servings, sourceUrl, ingredients, instructions, tags, householdId, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        parsed.title,
        parsed.description || null,
        parsed.imageUrl || null,
        parsed.prepTime || null,
        parsed.cookTime || null,
        parsed.servings || null,
        parsed.sourceUrl || finalSourceUrl || null,
        JSON.stringify(parsed.ingredients),
        JSON.stringify(parsed.instructions),
        (parsed.tags || []).join(', '),
        householdId,
        now,
      ]
    );

    const saved = queryOne('SELECT * FROM recipes WHERE id = ?', [id]);
    res.json({ success: true, recipe: saved });
  } catch (err: any) {
    console.error('Import error:', err);
    res.status(500).json({ error: err.message || 'Failed to import recipe' });
  }
});

// Import recipe from multiple photos / images using Gemini Vision
app.post('/api/recipes/import-images', async (req, res) => {
  try {
    const householdId = getHouseholdId(req);
    const { images, coverImageIndex, apiKey } = req.body;
    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: 'At least one recipe image is required.' });
    }

    const parsed = await parseRecipeFromImages(images, apiKey);

    // Determine the cover photo:
    // 1. User manual selection (coverImageIndex)
    // 2. Gemini's detected dish photo (parsed.dishPhotoIndex)
    // 3. Fallback to first uploaded photo
    let chosenCoverImage: string | null = null;
    let chosenMime: string = 'image/jpeg';
    if (typeof coverImageIndex === 'number' && coverImageIndex >= 0 && coverImageIndex < images.length) {
      chosenCoverImage = images[coverImageIndex].base64;
      chosenMime = images[coverImageIndex].mimeType || 'image/jpeg';
    } else if (typeof parsed.dishPhotoIndex === 'number' && parsed.dishPhotoIndex >= 0 && parsed.dishPhotoIndex < images.length) {
      chosenCoverImage = images[parsed.dishPhotoIndex].base64;
      chosenMime = images[parsed.dishPhotoIndex].mimeType || 'image/jpeg';
    } else if (images[0]?.base64) {
      chosenCoverImage = images[0].base64;
      chosenMime = images[0].mimeType || 'image/jpeg';
    }

    if (chosenCoverImage && !chosenCoverImage.startsWith('http') && !chosenCoverImage.startsWith('data:')) {
      chosenCoverImage = `data:${chosenMime};base64,${chosenCoverImage}`;
    }

    const id = `r_${Date.now()}`;
    const now = new Date().toISOString();

    execute(
      `INSERT INTO recipes (id, title, description, imageUrl, prepTime, cookTime, servings, sourceUrl, ingredients, instructions, tags, householdId, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        parsed.title,
        parsed.description || null,
        chosenCoverImage,
        parsed.prepTime || null,
        parsed.cookTime || null,
        parsed.servings || null,
        'Scanned from Photos',
        JSON.stringify(parsed.ingredients),
        JSON.stringify(parsed.instructions),
        (parsed.tags || ['Scanned']).join(', '),
        householdId,
        now,
      ]
    );

    const saved = queryOne('SELECT * FROM recipes WHERE id = ?', [id]);
    res.json({ success: true, recipe: saved, detectedDishIndex: parsed.dishPhotoIndex });
  } catch (err: any) {
    console.error('Import images error:', err);
    let errorMsg = err.message || 'Failed to scan recipe from photos';
    if (/recitation|copyright/i.test(errorMsg)) {
      errorMsg = 'Automated text filter flagged this printed cookbook page. Try snapping the photo closer to the ingredients and steps (without the publisher/book title header), or paste the text directly.';
    }
    res.status(500).json({ error: errorMsg });
  }
});

app.delete('/api/recipes', (req, res) => {
  const id = req.query.id as string;
  if (id) {
    execute('DELETE FROM recipes WHERE id = ?', [id]);
    saveDb();
  }
  res.json({ success: true });
});

app.patch('/api/recipes', (req, res) => {
  try {
    const householdId = getHouseholdId(req);
    const { id, title, description, prepTime, cookTime, servings, sourceUrl, ingredients, instructions, tags, imageUrl } = req.body;
    if (!id) return res.status(400).json({ error: 'Recipe ID is required' });

    const existing = queryOne('SELECT * FROM recipes WHERE id = ? AND householdId = ?', [id, householdId]);
    if (!existing) return res.status(404).json({ error: 'Recipe not found' });

    if (title !== undefined) execute('UPDATE recipes SET title = ? WHERE id = ?', [title.trim(), id]);
    if (description !== undefined) execute('UPDATE recipes SET description = ? WHERE id = ?', [description?.trim() || null, id]);
    if (prepTime !== undefined) execute('UPDATE recipes SET prepTime = ? WHERE id = ?', [prepTime ? String(prepTime) : null, id]);
    if (cookTime !== undefined) execute('UPDATE recipes SET cookTime = ? WHERE id = ?', [cookTime ? String(cookTime) : null, id]);
    if (servings !== undefined) execute('UPDATE recipes SET servings = ? WHERE id = ?', [servings ? String(servings) : null, id]);
    if (sourceUrl !== undefined) execute('UPDATE recipes SET sourceUrl = ? WHERE id = ?', [sourceUrl || null, id]);
    if (imageUrl !== undefined) execute('UPDATE recipes SET imageUrl = ? WHERE id = ?', [imageUrl || null, id]);
    if (ingredients !== undefined) execute('UPDATE recipes SET ingredients = ? WHERE id = ?', [typeof ingredients === 'string' ? ingredients : JSON.stringify(ingredients), id]);
    if (instructions !== undefined) execute('UPDATE recipes SET instructions = ? WHERE id = ?', [typeof instructions === 'string' ? instructions : JSON.stringify(instructions), id]);
    if (tags !== undefined) {
      const tagStr = Array.isArray(tags) ? tags.join(', ') : tags;
      execute('UPDATE recipes SET tags = ? WHERE id = ?', [tagStr, id]);
    }
    saveDb();

    const updated = queryOne('SELECT * FROM recipes WHERE id = ?', [id]);
    res.json(updated);
  } catch (err: any) {
    console.error('Update recipe error:', err);
    res.status(500).json({ error: err.message || 'Failed to update recipe' });
  }
});

// Endpoint: Regenerate recipe photo using Google Imagen 3 or free high-res photo search
app.post('/api/recipes/:id/regenerate-image', async (req, res) => {
  try {
    const householdId = getHouseholdId(req);
    const { id } = req.params;

    const recipe = queryOne<{
      id: string;
      title: string;
      description: string | null;
      ingredients: string | null;
      tags: string | null;
    }>('SELECT id, title, description, ingredients, tags FROM recipes WHERE id = ? AND householdId = ?', [
      id,
      householdId,
    ]);

    if (!recipe) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    let parsedIngredients = [];
    try {
      if (recipe.ingredients) parsedIngredients = JSON.parse(recipe.ingredients);
    } catch {}

    const { mode, customApiKey, customUrl, currentImageUrl, seenImageUrls } = req.body;
    const apiKey = customApiKey || process.env.GEMINI_API_KEY;

    let newImageUrl: string;

    if (customUrl && typeof customUrl === 'string' && customUrl.startsWith('http')) {
      newImageUrl = customUrl.trim();
    } else if (mode === 'imagen') {
      if (!apiKey) {
        return res.status(400).json({ error: 'Assistant API key is required for dish image generation.' });
      }
      newImageUrl = await generateRecipeImageWithImagen(
        {
          title: recipe.title,
          description: recipe.description || '',
          ingredients: parsedIngredients,
        },
        apiKey
      );
    } else {
      const tagList = (recipe.tags || '').split(',').map((t) => t.trim()).filter(Boolean);
      const used = new Set<string>();
      if (Array.isArray(seenImageUrls)) {
        for (const u of seenImageUrls) {
          if (typeof u === 'string' && u.trim()) used.add(u.trim());
        }
      }
      if (currentImageUrl) used.add(currentImageUrl.trim());
      if (recipe.imageUrl) used.add(recipe.imageUrl.trim());

      const topIngredients = parsedIngredients
        .slice(0, 4)
        .map((i: any) => (typeof i === 'string' ? i : i.item || i.name))
        .filter(Boolean);
      const synthesizedQuery =
        topIngredients.length > 0 ? `${recipe.title} with ${topIngredients.join(' ')}` : undefined;

      newImageUrl = await findAccurateRecipePhoto(
        recipe.title,
        recipe.description || '',
        tagList,
        synthesizedQuery,
        used,
        parsedIngredients
      );
    }

    execute('UPDATE recipes SET imageUrl = ? WHERE id = ? AND householdId = ?', [
      newImageUrl,
      id,
      householdId,
    ]);
    saveDb();

    return res.json({ success: true, imageUrl: newImageUrl });
  } catch (err: any) {
    console.error('Regenerate image error:', err);
    return res.status(500).json({ error: err.message || 'Failed to regenerate image' });
  }
});

// 5. Meal Planner API
app.get('/api/meal-planner', (req, res) => {
  const householdId = getHouseholdId(req);
  const meals = queryAll('SELECT * FROM meal_plans WHERE householdId = ? ORDER BY date ASC', [householdId]);
  res.json(meals);
});

app.post('/api/meal-planner', (req, res) => {
  const householdId = getHouseholdId(req);
  const { action, date, mealType, title, notes, recipeId, ingredients, addedById } = req.body;

  // Export ingredients to grocery
  if (action === 'export_ingredients' && Array.isArray(ingredients)) {
    const aisles = queryAll<{ id: string; name: string }>('SELECT id, name FROM aisles WHERE householdId = ?', [householdId]);
    const now = new Date().toISOString();

    for (const ing of ingredients) {
      const name = typeof ing === 'string' ? ing : ing.item;
      const cat = typeof ing === 'object' && ing.category ? ing.category : undefined;
      if (!name) continue;

      const resolved = resolveAisleForGroceryItem(householdId, name, aisles, cat);
      const gId = `g_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      execute(
        `INSERT INTO grocery_items (id, name, category, aisleId, quantity, checked, householdId, addedById, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [gId, name, resolved.category, resolved.aisleId, '1', 0, householdId, addedById || 'u1', now]
      );
    }
    return res.json({ success: true });
  }

  if (!date || !mealType || !title) {
    return res.status(400).json({ error: 'Date, mealType, and title are required' });
  }

  const id = `m_${date}_${mealType}`;
  execute(
    `INSERT OR REPLACE INTO meal_plans (id, date, mealType, title, notes, recipeId, householdId)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, date, mealType, title, notes || null, recipeId || null, householdId]
  );

  const actor = getAuthUser(req);
  sendPushNotificationToHousehold(
    householdId,
    {
      title: `🍳 Planned: ${title}`,
      body: `Scheduled for ${date} (${mealType})`,
      url: '/meal-planner',
    },
    {
      category: 'meal_plans',
      actorUserId: actor?.id,
    }
  );

  const saved = queryOne('SELECT * FROM meal_plans WHERE id = ?', [id]);
  res.json(saved);
});

app.delete('/api/meal-planner', (req, res) => {
  const id = req.query.id as string;
  if (id) execute('DELETE FROM meal_plans WHERE id = ?', [id]);
  res.json({ success: true });
});

// 5b. Weekly Meals & Cooking Log API
app.get('/api/meals/week', (req, res) => {
  const householdId = getHouseholdId(req);
  const weekStartDate = req.query.weekStartDate as string;

  const meals = weekStartDate
    ? queryAll('SELECT * FROM weekly_meals WHERE householdId = ? AND weekStartDate = ? ORDER BY isMade ASC, createdAt DESC', [householdId, weekStartDate])
    : queryAll('SELECT * FROM weekly_meals WHERE householdId = ? ORDER BY isMade ASC, createdAt DESC', [householdId]);

  res.json(meals.map((m: any) => ({ ...m, isMade: Boolean(m.isMade) })));
});

app.post('/api/meals/week', (req, res) => {
  const householdId = getHouseholdId(req);
  const { title, recipeId, notes, weekStartDate } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  // If recipeId is provided and already unmade in shopped list, reuse it
  if (recipeId) {
    const existing = queryOne<{ id: string }>(
      'SELECT id FROM weekly_meals WHERE householdId = ? AND recipeId = ? AND isMade = 0',
      [householdId, recipeId]
    );
    if (existing) {
      const current = queryOne('SELECT * FROM weekly_meals WHERE id = ?', [existing.id]);
      return res.json(current ? { ...current, isMade: Boolean(current.isMade) } : { id: existing.id, title });
    }
  }

  const id = `wm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const weekStart = weekStartDate || now.split('T')[0];

  execute(
    `INSERT INTO weekly_meals (id, title, recipeId, notes, isMade, madeDate, weekStartDate, householdId, createdAt)
     VALUES (?, ?, ?, ?, 0, NULL, ?, ?, ?)`,
    [id, title, recipeId || null, notes || null, weekStart, householdId, now]
  );

  const actor = getAuthUser(req);
  sendPushNotificationToHousehold(
    householdId,
    {
      title: '🍳 Planned Dinner Added',
      body: `${title}${actor ? ` (by ${actor.name})` : ''}`,
      url: '/meal-planner',
    },
    {
      category: 'meal_plans',
      actorUserId: actor?.id,
    }
  );

  const saved = queryOne('SELECT * FROM weekly_meals WHERE id = ?', [id]);
  res.json(saved ? { ...saved, isMade: Boolean(saved.isMade) } : { id, title });
});

app.patch('/api/meals/week', (req, res) => {
  const { id, isMade, madeDate, title, notes } = req.body;
  if (!id) return res.status(400).json({ error: 'ID is required' });

  if (isMade !== undefined) {
    execute('UPDATE weekly_meals SET isMade = ?, madeDate = ? WHERE id = ?', [
      isMade ? 1 : 0,
      isMade ? (madeDate || new Date().toISOString().split('T')[0]) : null,
      id,
    ]);
  }
  if (title !== undefined) execute('UPDATE weekly_meals SET title = ? WHERE id = ?', [title, id]);
  if (notes !== undefined) execute('UPDATE weekly_meals SET notes = ? WHERE id = ?', [notes, id]);

  const updated = queryOne('SELECT * FROM weekly_meals WHERE id = ?', [id]);
  res.json(updated ? { ...updated, isMade: Boolean(updated.isMade) } : {});
});

app.delete('/api/meals/week', (req, res) => {
  const id = req.query.id as string;
  if (id) execute('DELETE FROM weekly_meals WHERE id = ?', [id]);
  res.json({ success: true });
});

app.get('/api/meals/log', (req, res) => {
  const householdId = getHouseholdId(req);
  const logs = queryAll(
    'SELECT * FROM meal_logs WHERE householdId = ? ORDER BY date DESC, createdAt DESC',
    [householdId]
  );
  res.json(logs);
});

app.post('/api/meals/log', (req, res) => {
  const householdId = getHouseholdId(req);
  const { title, recipeId, date, notes, cookedByUserId, weeklyMealId } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  const id = `ml_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const logDate = date || now.split('T')[0];

  execute(
    `INSERT INTO meal_logs (id, title, recipeId, date, notes, cookedByUserId, householdId, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, title, recipeId || null, logDate, notes || null, cookedByUserId || null, householdId, now]
  );

  // If linked to a weekly meal, remove that meal from the weekly meals list
  if (weeklyMealId) {
    execute('DELETE FROM weekly_meals WHERE id = ?', [weeklyMealId]);
  } else if (recipeId) {
    execute('DELETE FROM weekly_meals WHERE householdId = ? AND recipeId = ?', [
      householdId,
      recipeId,
    ]);
  } else if (title) {
    execute('DELETE FROM weekly_meals WHERE householdId = ? AND LOWER(title) = LOWER(?)', [
      householdId,
      title.trim(),
    ]);
  }

  const saved = queryOne('SELECT * FROM meal_logs WHERE id = ?', [id]);
  res.json(saved);
});

app.delete('/api/meals/log', (req, res) => {
  const id = req.query.id as string;
  if (id) execute('DELETE FROM meal_logs WHERE id = ?', [id]);
  res.json({ success: true });
});

// 5b. Pantry & Inventory API
app.get('/api/inventory', (req, res) => {
  const householdId = getHouseholdId(req);
  const location = req.query.location as string;
  const filter = req.query.filter as string; // 'all' | 'expiring_soon' | 'expired' | 'staples'
  const search = ((req.query.search as string) || '').toLowerCase().trim();

  let sql = 'SELECT * FROM inventory_items WHERE householdId = ?';
  const params: any[] = [householdId];

  if (location && ['fridge', 'freezer', 'pantry'].includes(location)) {
    sql += ' AND location = ?';
    params.push(location);
  }

  if (filter === 'staples') {
    sql += ' AND isStock = 1';
  }

  sql += ' ORDER BY createdAt DESC';

  const rows = queryAll<any>(sql, params);

  let items = rows.map((item) => {
    const daysUntilExpiry = getDaysUntilExpiry(item.expiresAt);
    const freshness = getFreshnessStatus(item.expiresAt);
    return {
      ...item,
      isStock: Boolean(item.isStock),
      daysUntilExpiry,
      freshness,
    };
  });

  if (filter === 'expiring_soon') {
    items = items.filter((i) => i.freshness === 'expiring_soon');
  } else if (filter === 'expired') {
    items = items.filter((i) => i.freshness === 'expired');
  }

  if (search) {
    items = items.filter(
      (i) =>
        i.name.toLowerCase().includes(search) ||
        (i.category && i.category.toLowerCase().includes(search)) ||
        (i.location && i.location.toLowerCase().includes(search))
    );
  }

  // Prioritize expired and expiring_soon first
  const freshnessPriority: Record<string, number> = {
    expired: 0,
    expiring_soon: 1,
    fresh: 2,
  };
  items.sort((a, b) => {
    const diff = freshnessPriority[a.freshness] - freshnessPriority[b.freshness];
    if (diff !== 0) return diff;
    return (a.daysUntilExpiry ?? 999) - (b.daysUntilExpiry ?? 999);
  });

  res.json(items);
});

app.post('/api/inventory', (req, res) => {
  const householdId = getHouseholdId(req);
  const {
    name,
    barcode,
    category = 'Pantry',
    location = 'pantry',
    quantity,
    unit,
    imageUrl,
    isStock = false,
    restockCadenceDays,
    expiresAt: customExpiresAt,
  } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Item name is required' });
  }

  const id = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const expiresAt = customExpiresAt || calculateExpiryDate(name.trim(), category, location);

  execute(
    `INSERT INTO inventory_items (
      id, householdId, name, barcode, category, location, quantity, unit,
      imageUrl, isStock, restockCadenceDays, lastRestockedAt, expiresAt, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      householdId,
      name.trim(),
      barcode ? String(barcode).trim() : null,
      category,
      location,
      quantity ? String(quantity).trim() : null,
      unit ? String(unit).trim() : null,
      imageUrl || null,
      isStock ? 1 : 0,
      restockCadenceDays ? parseInt(String(restockCadenceDays), 10) : null,
      isStock ? now : null,
      expiresAt,
      now,
      now,
    ]
  );
  saveDb();

  const saved = queryOne<any>('SELECT * FROM inventory_items WHERE id = ?', [id]);
  if (!saved) return res.status(500).json({ error: 'Failed to create inventory item' });

  res.json({
    ...saved,
    isStock: Boolean(saved.isStock),
    daysUntilExpiry: getDaysUntilExpiry(saved.expiresAt),
    freshness: getFreshnessStatus(saved.expiresAt),
  });
});

app.post('/api/inventory/batch', (req, res) => {
  const householdId = getHouseholdId(req);
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Items array is required' });
  }

  const now = new Date().toISOString();
  const addedIds: string[] = [];

  for (const it of items) {
    if (!it.name || !it.name.trim()) continue;
    const id = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const expiresAt = it.expiresAt || calculateExpiryDate(it.name.trim(), it.category || 'Pantry', it.location || 'pantry');
    execute(
      `INSERT INTO inventory_items (
        id, householdId, name, barcode, category, location, quantity, unit,
        imageUrl, isStock, restockCadenceDays, lastRestockedAt, expiresAt, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        householdId,
        it.name.trim(),
        it.barcode ? String(it.barcode).trim() : null,
        it.category || 'Pantry',
        it.location || 'pantry',
        it.quantity ? String(it.quantity).trim() : null,
        it.unit ? String(it.unit).trim() : null,
        it.imageUrl || null,
        it.isStock ? 1 : 0,
        it.restockCadenceDays ? parseInt(String(it.restockCadenceDays), 10) : null,
        it.isStock ? now : null,
        expiresAt,
        now,
        now,
      ]
    );
    addedIds.push(id);
  }
  saveDb();

  res.json({ success: true, count: addedIds.length });
});

app.patch('/api/inventory/:id', (req, res) => {
  const householdId = getHouseholdId(req);
  const { id } = req.params;
  const existing = queryOne<any>('SELECT * FROM inventory_items WHERE id = ? AND householdId = ?', [id, householdId]);
  if (!existing) return res.status(404).json({ error: 'Item not found' });

  const {
    name,
    category,
    location,
    quantity,
    unit,
    imageUrl,
    isStock,
    restockCadenceDays,
    expiresAt,
    lastRestockedAt,
  } = req.body;

  const now = new Date().toISOString();

  if (name !== undefined) execute('UPDATE inventory_items SET name = ? WHERE id = ?', [name.trim(), id]);
  if (category !== undefined) execute('UPDATE inventory_items SET category = ? WHERE id = ?', [category, id]);
  if (location !== undefined) execute('UPDATE inventory_items SET location = ? WHERE id = ?', [location, id]);
  if (quantity !== undefined) execute('UPDATE inventory_items SET quantity = ? WHERE id = ?', [quantity ? String(quantity).trim() : null, id]);
  if (unit !== undefined) execute('UPDATE inventory_items SET unit = ? WHERE id = ?', [unit ? String(unit).trim() : null, id]);
  if (imageUrl !== undefined) execute('UPDATE inventory_items SET imageUrl = ? WHERE id = ?', [imageUrl || null, id]);
  if (isStock !== undefined) execute('UPDATE inventory_items SET isStock = ? WHERE id = ?', [isStock ? 1 : 0, id]);
  if (restockCadenceDays !== undefined) execute('UPDATE inventory_items SET restockCadenceDays = ? WHERE id = ?', [restockCadenceDays ? parseInt(String(restockCadenceDays), 10) : null, id]);
  if (expiresAt !== undefined) execute('UPDATE inventory_items SET expiresAt = ? WHERE id = ?', [expiresAt, id]);
  if (lastRestockedAt !== undefined) execute('UPDATE inventory_items SET lastRestockedAt = ? WHERE id = ?', [lastRestockedAt, id]);

  execute('UPDATE inventory_items SET updatedAt = ? WHERE id = ?', [now, id]);
  saveDb();

  const updated = queryOne<any>('SELECT * FROM inventory_items WHERE id = ?', [id]);
  res.json({
    ...updated,
    isStock: Boolean(updated.isStock),
    daysUntilExpiry: getDaysUntilExpiry(updated.expiresAt),
    freshness: getFreshnessStatus(updated.expiresAt),
  });
});

app.delete('/api/inventory/:id', (req, res) => {
  const householdId = getHouseholdId(req);
  const { id } = req.params;
  execute('DELETE FROM inventory_items WHERE id = ? AND householdId = ?', [id, householdId]);
  saveDb();
  res.json({ success: true });
});

app.get('/api/inventory/barcode/:code', async (req, res) => {
  const { code } = req.params;
  if (!code) return res.status(400).json({ error: 'Barcode is required' });
  const data = await lookupBarcode(code);
  res.json(data);
});

app.post('/api/inventory/scan-vision', async (req, res) => {
  try {
    const { image, mimeType } = req.body;
    if (!image) return res.status(400).json({ error: 'Image is required' });
    const items = await scanInventoryVision(image, mimeType || 'image/jpeg');
    res.json({ items });
  } catch (err: any) {
    console.error('Vision scan error:', err);
    res.status(500).json({ error: err.message || 'Failed to scan image' });
  }
});

app.post('/api/inventory/check-ingredients', (req, res) => {
  const householdId = getHouseholdId(req);
  const { ingredients } = req.body;
  if (!Array.isArray(ingredients)) {
    return res.status(400).json({ error: 'Ingredients array is required' });
  }

  const items = queryAll<InventoryItemRow>('SELECT * FROM inventory_items WHERE householdId = ?', [householdId]);
  const result = matchRecipeIngredientsAgainstInventory(ingredients, items);
  res.json(result);
});

app.post('/api/inventory/:id/restock-to-grocery', (req, res) => {
  const householdId = getHouseholdId(req);
  const { id } = req.params;
  const item = queryOne<any>('SELECT * FROM inventory_items WHERE id = ? AND householdId = ?', [id, householdId]);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  const aisles = queryAll<{ id: string; name: string }>('SELECT id, name FROM aisles WHERE householdId = ?', [householdId]);
  const resolved = resolveAisleForGroceryItem(householdId, item.name, aisles, item.category);

  const now = new Date().toISOString();
  const groceryId = `g_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  
  execute(
    `INSERT INTO grocery_items (id, name, category, aisleId, quantity, unit, note, checked, householdId, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    [
      groceryId,
      item.name,
      resolved.category,
      resolved.aisleId,
      item.quantity || '1',
      item.unit || null,
      'From Pantry Restock',
      householdId,
      now,
    ]
  );

  // Update item's lastRestockedAt to now
  execute('UPDATE inventory_items SET lastRestockedAt = ?, updatedAt = ? WHERE id = ?', [now, now, id]);
  saveDb();

  res.json({ success: true, groceryItemId: groceryId });
});

// 6. Calendar API
app.get('/api/calendar', async (req, res) => {
  const householdId = getHouseholdId(req);
  const memberId = req.query.memberId as string;

  // Freshness check: if connected users haven't synced in the last 60 seconds, sync and prune deletions before returning events
  try {
    const statuses = getHouseholdGoogleSyncStatus(householdId);
    const oneMinAgo = Date.now() - 60 * 1000;
    const needsSync = statuses.some((s) => !s.lastSyncedAt || new Date(s.lastSyncedAt).getTime() < oneMinAgo);
    if (needsSync) {
      await syncAllConnectedHouseholdCalendars(householdId);
    }
  } catch (syncErr) {
    console.warn('Auto freshness sync error:', syncErr);
  }

  const events = memberId && memberId !== 'all'
    ? queryAll('SELECT * FROM calendar_events WHERE householdId = ? AND assignedMemberId = ? ORDER BY date ASC, startTime ASC', [householdId, memberId])
    : queryAll('SELECT * FROM calendar_events WHERE householdId = ? ORDER BY date ASC, startTime ASC', [householdId]);

  res.json(events);
});

function cleanDateStr(d: any): string {
  if (!d || typeof d !== 'string') return '';
  return d.split('T')[0].trim();
}

function cleanTimeStr(t: any): string | null {
  if (!t || typeof t !== 'string') return null;
  const trimmed = t.trim();
  if (!trimmed) return null;
  if (trimmed.includes('T')) {
    const afterT = trimmed.split('T')[1];
    return afterT ? afterT.substring(0, 5) : null;
  }
  return trimmed.substring(0, 5);
}

app.post('/api/calendar', async (req, res) => {
  const householdId = getHouseholdId(req);
  const { title, description, date, startTime, endTime, category, location, assignedMemberId, timezone, isAllDay } = req.body;
  const finalDate = cleanDateStr(date);
  const finalStart = cleanTimeStr(startTime);
  const finalEnd = cleanTimeStr(endTime);

  if (!title || !finalDate) return res.status(400).json({ error: 'Title and Date are required' });

  const id = `ev_${Date.now()}`;
  const now = new Date().toISOString();

  execute(
    `INSERT INTO calendar_events (id, title, description, date, startTime, endTime, category, location, assignedMemberId, householdId, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, title, description || null, finalDate, finalStart || null, finalEnd || null, category || 'Family', location || null, assignedMemberId || null, householdId, now]
  );
  saveDb();

  const actor = getAuthUser(req);
  sendPushNotificationToHousehold(
    householdId,
    {
      title: `📅 Event: ${title}`,
      body: `Scheduled for ${finalDate}${finalStart ? ` at ${finalStart}` : ''}`,
      url: '/calendar',
    },
    {
      category: 'calendar_events',
      actorUserId: actor?.id,
    }
  );

  const created = queryOne('SELECT * FROM calendar_events WHERE id = ?', [id]);

  // Immediately push event to Google Calendar if connected
  try {
    const pushed = await pushEventToGoogleCalendar({ ...created, timezone, isAllDay }, actor?.id, timezone);
    if (pushed) {
      const refreshed = queryOne('SELECT * FROM calendar_events WHERE id = ?', [id]);
      return res.json(refreshed || created);
    }
  } catch (pushErr) {
    console.warn('Failed to immediately push event to Google Calendar:', pushErr);
  }

  res.json(created);
});

app.patch('/api/calendar', async (req, res) => {
  try {
    const householdId = getHouseholdId(req);
    const { id, title, description, date, startTime, endTime, category, location, assignedMemberId, timezone, isAllDay } = req.body;
    if (!id) return res.status(400).json({ error: 'Event id is required' });

    const existing = queryOne('SELECT * FROM calendar_events WHERE id = ? AND householdId = ?', [id, householdId]);
    if (!existing) return res.status(404).json({ error: 'Event not found' });

    const newTitle = title !== undefined ? title : existing.title;
    const newDesc = description !== undefined ? description : existing.description;
    const newDate = date !== undefined ? cleanDateStr(date) : existing.date;
    const newStart = startTime !== undefined ? cleanTimeStr(startTime) : existing.startTime;
    const newEnd = endTime !== undefined ? cleanTimeStr(endTime) : existing.endTime;
    const newCategory = category !== undefined ? category : existing.category;
    const newLocation = location !== undefined ? location : existing.location;
    const newMember = assignedMemberId !== undefined ? assignedMemberId : existing.assignedMemberId;

    execute(
      `UPDATE calendar_events
       SET title = ?,
           description = ?,
           date = ?,
           startTime = ?,
           endTime = ?,
           category = ?,
           location = ?,
           assignedMemberId = ?
       WHERE id = ? AND householdId = ?`,
      [
        newTitle ?? null,
        newDesc ?? null,
        newDate ?? null,
        newStart ?? null,
        newEnd ?? null,
        newCategory ?? null,
        newLocation ?? null,
        newMember ?? null,
        id,
        householdId,
      ]
    );
    saveDb();

    const updated = queryOne('SELECT * FROM calendar_events WHERE id = ?', [id]);

    // Immediately update in Google Calendar if connected
    try {
      if (updated) {
        await updateEventInGoogleCalendar({ ...updated, timezone, isAllDay }, timezone);
      }
    } catch (pushErr) {
      console.warn('Failed to immediately update event in Google Calendar:', pushErr);
    }

    const finalEvent = queryOne('SELECT * FROM calendar_events WHERE id = ?', [id]);
    res.json(finalEvent || updated);
  } catch (err: any) {
    console.error('Failed to update calendar event:', err);
    res.status(500).json({ error: err.message || 'Failed to update calendar event' });
  }
});

app.delete('/api/calendar', async (req, res) => {
  const householdId = getHouseholdId(req);
  const id = req.query.id as string;
  if (id) {
    try {
      await deleteEventFromGoogleCalendar(id, householdId);
    } catch (gcalErr) {
      console.warn('Failed to delete event from Google Calendar:', gcalErr);
    }
    execute('DELETE FROM calendar_events WHERE id = ?', [id]);
    saveDb();
  }
  res.json({ success: true });
});

// Google Calendar OAuth & Sync Routes
app.get('/api/auth/google/url', (req, res) => {
  try {
    let householdId = (req.query.householdId as string) || getHouseholdId(req);
    const authUser = getAuthUser(req);
    const userId = (req.query.userId as string) || authUser?.id || 'u1';
    
    // Always bind to the target user's true household if known in DB
    const userRow = queryOne<{ householdId: string }>('SELECT householdId FROM users WHERE id = ?', [userId]);
    if (userRow?.householdId) {
      householdId = userRow.householdId;
    }

    const host = req.get('host') || (req.headers.referer ? new URL(req.headers.referer).host : undefined);
    const url = getGoogleAuthUrl(householdId, userId, host);
    res.json({ url });
  } catch (err: any) {
    console.error('Failed to get Google Auth URL:', err);
    res.status(500).json({ error: err.message || 'Failed to generate Google auth URL' });
  }
});

let lastGoogleCallbackInfo: any = null;

const googleCallbackHandler: express.RequestHandler = async (req, res) => {
  const code = req.query.code as string;
  const state = req.query.state as string;
  const error = req.query.error as string;

  console.log('⚡ Google OAuth Callback received:', {
    path: req.path,
    hasCode: Boolean(code),
    hasState: Boolean(state),
    error: error || null,
  });

  lastGoogleCallbackInfo = {
    receivedAt: new Date().toISOString(),
    path: req.path,
    hasCode: Boolean(code),
    codePreview: code ? `${code.slice(0, 8)}...` : null,
    hasState: Boolean(state),
    rawError: error || null,
  };

  if (error) {
    console.warn('Google OAuth error callback:', error);
    lastGoogleCallbackInfo.failureReason = error;
    return res.redirect('/?tab=settings&google_sync=error&message=' + encodeURIComponent(error));
  }

  if (!code || !state) {
    lastGoogleCallbackInfo.failureReason = 'Missing code or state';
    return res.redirect('/?tab=settings&google_sync=error&message=' + encodeURIComponent('Missing code or state'));
  }

  const result = await handleGoogleAuthCallback(code, state);
  console.log('⚡ Google Auth result:', result);
  lastGoogleCallbackInfo.result = {
    success: result.success,
    email: result.email || null,
    userId: result.userId || null,
    householdId: result.householdId || null,
    error: result.error || null,
  };

  if (!result.success) {
    return res.redirect('/?tab=settings&google_sync=error&message=' + encodeURIComponent(result.error || 'Sync failed'));
  }

  res.redirect(
    '/?tab=settings&google_sync=processing&email=' +
      encodeURIComponent(result.email || '') +
      '&userId=' +
      encodeURIComponent(result.userId || '')
  );
};

app.get('/api/auth/google/callback', googleCallbackHandler);
app.get('/auth/google/callback', googleCallbackHandler);
app.get('/api/google/callback', googleCallbackHandler);
app.get('/auth/callback', googleCallbackHandler);

// Diagnostic Endpoint for Live Debugging
app.get('/api/debug/google', (req, res) => {
  try {
    const { clientId, clientSecret, defaultRedirectUri } = getGoogleCredentials();
    const records = queryAll<{
      id: string;
      userId: string;
      householdId: string;
      googleEmail: string;
      hasAccessToken: number;
      hasRefreshToken: number;
      selectedCalendarIds: string;
      calendarMemberMap: string;
      lastSyncedAt: string;
      createdAt: string;
    }>(
      `SELECT id, userId, householdId, googleEmail,
              CASE WHEN accessToken IS NOT NULL AND LENGTH(accessToken) > 0 THEN 1 ELSE 0 END as hasAccessToken,
              CASE WHEN refreshToken IS NOT NULL AND LENGTH(refreshToken) > 0 THEN 1 ELSE 0 END as hasRefreshToken,
              selectedCalendarIds, calendarMemberMap, lastSyncedAt, createdAt
       FROM user_google_sync`
    );
    const households = queryAll('SELECT id, name, inviteCode FROM households');
    const users = queryAll('SELECT id, name, username, email, householdId FROM users');
    const googleEvents = queryAll(
      'SELECT id, title, isGoogleEvent, googleCalendarId, householdId, date, startTime FROM calendar_events WHERE isGoogleEvent = 1 LIMIT 10'
    );

    res.json({
      hasClientId: Boolean(clientId),
      clientIdPreview: clientId ? `${clientId.slice(0, 15)}...${clientId.slice(-15)}` : null,
      hasClientSecret: Boolean(clientSecret),
      clientSecretLength: clientSecret ? clientSecret.length : 0,
      clientSecretPreview: clientSecret ? `${clientSecret.slice(0, 4)}...${clientSecret.slice(-4)}` : null,
      defaultRedirectUri,
      lastCallback: lastGoogleCallbackInfo,
      syncRecords: records,
      households,
      users,
      syncedEventsCount: googleEvents.length,
      sampleEvents: googleEvents,
      serverTime: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/google/status', (req, res) => {
  try {
    const householdId = getHouseholdId(req);
    const status = getHouseholdGoogleSyncStatus(householdId);
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to get sync status' });
  }
});

app.get('/api/auth/google/calendars', async (req, res) => {
  try {
    const householdId = getHouseholdId(req);
    const userId = (req.query.userId as string) || getAuthUser(req) || 'u1';
    const result = await getUserGoogleCalendars(householdId, userId);
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    res.json(result.calendars);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch calendars' });
  }
});

app.put('/api/auth/google/calendars', async (req, res) => {
  try {
    const householdId = getHouseholdId(req);
    const { userId, calendarIds, calendarSelections, memberMap } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    const selections = calendarSelections || calendarIds;
    if (!Array.isArray(selections)) {
      return res.status(400).json({ error: 'calendarSelections or calendarIds array is required' });
    }
    const result = await updateUserSelectedCalendars(householdId, userId, selections, memberMap);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update calendars' });
  }
});

app.post('/api/auth/google/disconnect', (req, res) => {
  try {
    const householdId = getHouseholdId(req);
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    const result = disconnectUserGoogleCalendar(householdId, userId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to disconnect Google Calendar' });
  }
});

app.post('/api/calendar/sync/google', async (req, res) => {
  try {
    const householdId = getHouseholdId(req);
    const result = await syncAllConnectedHouseholdCalendars(householdId);
    const pushResult = await pushUnsyncedLocalEventsToGoogle(householdId);
    res.json({ success: true, totalSynced: result.totalSynced, totalPushed: pushResult.pushedCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to sync Google Calendar' });
  }
});

// 7. Family API
app.get('/api/family', (req, res) => {
  const householdId = getHouseholdId(req);
  const household = queryOne('SELECT * FROM households WHERE id = ?', [householdId]);
  const members = queryAll<any>('SELECT * FROM users WHERE householdId = ?', [householdId]);
  const cleanedMembers = members.map((m) => formatUser(m));
  res.json({ ...formatHousehold(household), members: cleanedMembers });
});

app.post('/api/family', (req, res) => {
  const householdId = getHouseholdId(req);
  const { action, inviteCode, name, username, avatar, color, role } = req.body;

  const sanitizeHandle = (raw: string) => {
    let handle = (raw || '').toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9_-]/g, '');
    if (!handle) handle = `member_${Date.now().toString().slice(-4)}`;
    let candidate = handle;
    let counter = 1;
    while (true) {
      const check = queryOne<{ id: string }>('SELECT id FROM users WHERE LOWER(username) = ?', [candidate]);
      if (!check) break;
      counter++;
      candidate = `${handle}${counter}`;
    }
    return candidate;
  };

  if (action === 'join_with_code' && inviteCode) {
    const found = queryOne<{ id: string }>('SELECT id FROM households WHERE inviteCode = ?', [inviteCode.trim().toUpperCase()]);
    if (!found) return res.status(404).json({ error: 'Invalid invite code' });

    if (name) {
      const uId = `u_${Date.now()}`;
      const cleanUsername = sanitizeHandle(username || name);
      execute(
        'INSERT INTO users (id, name, username, email, avatar, color, role, householdId, password) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [uId, name.trim(), cleanUsername, null, avatar || '👤', color || '#10b981', role || 'Member', found.id, 'password123']
      );
    }
    const h = queryOne('SELECT * FROM households WHERE id = ?', [found.id]);
    const m = queryAll('SELECT * FROM users WHERE householdId = ?', [found.id]);
    return res.json({ household: { ...formatHousehold(h), members: m } });
  }

  if (name) {
    const uId = `u_${Date.now()}`;
    const cleanUsername = sanitizeHandle(username || name);
    execute(
      'INSERT INTO users (id, name, username, email, avatar, color, role, householdId, password) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [uId, name.trim(), cleanUsername, null, avatar || '👤', color || '#10b981', role || 'Member', householdId, 'password123']
    );
    return res.json({ id: uId, name: name.trim(), username: cleanUsername, avatar: avatar || '👤', role: role || 'Member', color: color || '#10b981' });
  }

  res.status(400).json({ error: 'Invalid request' });
});

app.delete('/api/family', (req, res) => {
  const memberId = req.query.memberId as string;
  if (memberId) execute('DELETE FROM users WHERE id = ?', [memberId]);
  res.json({ success: true });
});

app.delete('/api/users/:id', (req, res) => {
  const memberId = req.params.id;
  if (memberId) execute('DELETE FROM users WHERE id = ?', [memberId]);
  res.json({ success: true });
});

// Update User Profile
app.put('/api/users/profile', (req, res) => {
  try {
    const authUser = getAuthUser(req);
    const householdId = getHouseholdId(req);
    const targetUserId = req.body.userId || authUser?.id;
    if (!targetUserId) {
      return res.status(401).json({ error: 'Unauthorized: missing user identifier' });
    }

    const existing = queryOne<{
      id: string;
      name: string;
      username: string;
      email: string;
      avatar: string;
      color: string;
      role: string;
      password: string;
      householdId: string;
    }>(
      'SELECT id, name, username, email, avatar, color, role, password, householdId FROM users WHERE id = ?',
      [targetUserId]
    );
    if (!existing) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Household isolation check: only allow editing members within the same household
    if (householdId && existing.householdId && existing.householdId !== householdId) {
      return res.status(403).json({ error: 'Forbidden: member belongs to a different household' });
    }

    const { name, username, email, color, role, password, avatar } = req.body;

    let newUsername = existing.username;
    if (username !== undefined) {
      const cleanUsername = (username || '').toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9_-]/g, '');
      if (cleanUsername && cleanUsername !== (existing.username || '').toLowerCase()) {
        const conflict = queryOne<{ id: string }>(
          'SELECT id FROM users WHERE LOWER(username) = ? AND id != ?',
          [cleanUsername, targetUserId]
        );
        if (conflict) {
          return res.status(400).json({ error: 'Username is already taken. Please choose another.' });
        }
        newUsername = cleanUsername;
      }
    }

    const newName = name && typeof name === 'string' && name.trim() ? name.trim() : existing.name;
    const newEmail = email !== undefined ? (typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : null) : existing.email;
    const newColor = color && typeof color === 'string' && color.trim() ? color.trim() : (existing.color || '#10b981');
    const newRole = role && typeof role === 'string' && role.trim() ? role.trim() : (existing.role || 'Member');
    const newPassword = password && typeof password === 'string' && password.trim() ? password.trim() : (existing.password || 'password123');

    // CRITICAL: users.avatar has a NOT NULL constraint in the database.
    // If avatar is empty string, not provided, or not an image data/url, safely store '' or '👤' instead of null.
    let newAvatar = existing.avatar || '👤';
    if (avatar !== undefined) {
      if (avatar && typeof avatar === 'string' && (avatar.startsWith('data:image') || avatar.startsWith('http://') || avatar.startsWith('https://'))) {
        newAvatar = avatar;
      } else {
        newAvatar = '';
      }
    }

    execute(
      'UPDATE users SET name = ?, username = ?, email = ?, color = ?, role = ?, password = ?, avatar = ? WHERE id = ?',
      [newName, newUsername, newEmail, newColor, newRole, newPassword, newAvatar, targetUserId]
    );
    saveDb();

    const updated = queryOne<{
      id: string;
      name: string;
      username: string;
      email: string;
      avatar: string;
      color: string;
      role: string;
      householdId: string;
    }>(
      'SELECT id, name, username, email, avatar, color, role, householdId FROM users WHERE id = ?',
      [targetUserId]
    );

    res.json({
      user: formatUser(updated),
    });
  } catch (err: any) {
    console.error('Error updating user profile:', err);
    res.status(500).json({ error: err.message || 'Failed to update user profile' });
  }
});

// 8. Push API & Notification Preferences
app.get('/api/push', (req, res) => {
  res.json({ publicKey: vapidPublicKey });
});

app.post('/api/push', async (req, res) => {
  const householdId = getHouseholdId(req);
  const authUser = getAuthUser(req);
  const { action, subscription, userId, title, message } = req.body;

  if (action === 'test_notification') {
    await sendPushNotificationToHousehold(
      householdId,
      {
        title: title || '✨ Homebase Notification',
        body: message || 'Push notifications are live on your device!',
        url: '/',
      },
      {
        category: 'test',
        actorUserId: undefined,
      }
    );
    return res.json({ success: true });
  }

  if (subscription && subscription.endpoint) {
    const id = `sub_${Date.now()}`;
    const now = new Date().toISOString();
    const effectiveUserId = userId || authUser?.id || null;
    execute(
      `INSERT OR REPLACE INTO push_subscriptions (id, endpoint, keys, userId, householdId, createdAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, subscription.endpoint, JSON.stringify(subscription.keys), effectiveUserId, householdId, now]
    );
    return res.json({ success: true });
  }

  res.status(400).json({ error: 'Invalid payload' });
});

app.post('/api/push/unsubscribe', (req, res) => {
  const householdId = getHouseholdId(req);
  const authUser = getAuthUser(req);
  const { endpoint, userId } = req.body;

  if (endpoint) {
    execute('DELETE FROM push_subscriptions WHERE endpoint = ?', [endpoint]);
    return res.json({ success: true });
  }

  const targetUserId = userId || authUser?.id;
  if (targetUserId) {
    execute('DELETE FROM push_subscriptions WHERE userId = ? AND householdId = ?', [targetUserId, householdId]);
    return res.json({ success: true });
  }

  res.status(400).json({ error: 'Endpoint or userId required to unsubscribe' });
});

// Notification Preferences
app.get('/api/notifications/preferences', (req, res) => {
  const householdId = getHouseholdId(req);
  const authUser = getAuthUser(req);
  const userId = (req.query.userId as string) || authUser?.id || 'u1';

  const prefs = getNotificationPreferences(userId, householdId);
  res.json(prefs);
});

app.put('/api/notifications/preferences', (req, res) => {
  const householdId = getHouseholdId(req);
  const authUser = getAuthUser(req);
  const userId = req.body.userId || authUser?.id || 'u1';

  const saved = saveNotificationPreferences(userId, householdId, req.body);
  res.json(saved);
});

// ---------------- FEEDBACK & BUG / FEATURE REQUESTS ----------------

function isServerAdmin(user: any): boolean {
  if (!user) return false;
  const role = (user.role || '').toLowerCase();
  const username = (user.username || '').toLowerCase();
  const email = (user.email || '').toLowerCase();
  return (
    role === 'admin' ||
    username === 'joshua' ||
    email === 'joshua@redpointaudio.com' ||
    email === 'joshuaburkhalter@gmail.com'
  );
}

app.get('/api/feedback', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Authentication required' });

  // Everyone can see all bug and feature requests
  const rows = queryAll('SELECT * FROM feedback_requests ORDER BY upvotes DESC, createdAt DESC');
  
  // Augment with parsed upvoters and hasUpvoted flag for current user
  const sanitized = rows.map((r) => {
    let voters: string[] = [];
    try {
      voters = r.upvoters ? JSON.parse(r.upvoters) : [];
      if (!Array.isArray(voters)) voters = [];
    } catch {
      voters = [];
    }
    return {
      ...r,
      upvotes: typeof r.upvotes === 'number' ? r.upvotes : (voters.length || 0),
      upvoters: voters,
      hasUpvoted: voters.includes(user.id),
    };
  });

  res.json(sanitized);
});

app.post('/api/feedback/vote', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Authentication required to vote' });

  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'Request ID is required' });

  const existing = queryOne<any>('SELECT * FROM feedback_requests WHERE id = ?', [id]);
  if (!existing) return res.status(404).json({ error: 'Request not found' });

  let voters: string[] = [];
  try {
    voters = existing.upvoters ? JSON.parse(existing.upvoters) : [];
    if (!Array.isArray(voters)) voters = [];
  } catch {
    voters = [];
  }

  const alreadyVotedIndex = voters.indexOf(user.id);
  let hasUpvoted = false;

  if (alreadyVotedIndex >= 0) {
    // Toggle vote off if clicked again (undo vote)
    voters.splice(alreadyVotedIndex, 1);
    hasUpvoted = false;
  } else {
    // Add vote (strictly once per person)
    voters.push(user.id);
    hasUpvoted = true;
  }

  const nextUpvotes = voters.length;
  const nextVotersJson = JSON.stringify(voters);
  const now = new Date().toISOString();

  execute(
    `UPDATE feedback_requests 
     SET upvotes = ?, upvoters = ?, updatedAt = ?
     WHERE id = ?`,
    [nextUpvotes, nextVotersJson, now, id]
  );
  saveDb();

  const updated = queryOne<any>('SELECT * FROM feedback_requests WHERE id = ?', [id]);
  res.json({
    ...updated,
    upvotes: nextUpvotes,
    upvoters: voters,
    hasUpvoted,
  });
});

app.post('/api/feedback', (req, res) => {
  const user = getAuthUser(req);
  const { type, title, description, priority } = req.body;

  if (!title || !description) {
    return res.status(400).json({ error: 'Title and description are required' });
  }

  const id = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const household = user?.householdId
    ? queryOne<{ name: string }>('SELECT name FROM households WHERE id = ?', [user.householdId])
    : null;

  execute(
    `INSERT INTO feedback_requests (
      id, type, title, description, priority, status,
      submittedByUserId, submittedByUserName, submittedByUserEmail,
      householdId, householdName, adminResponse, adminRespondedAt, adminRespondedBy,
      upvotes, upvoters,
      createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      type === 'feature' ? 'feature' : 'bug',
      title.trim(),
      description.trim(),
      priority || 'medium',
      'open',
      user?.id || 'anonymous',
      user?.name || 'Anonymous User',
      user?.email || null,
      user?.householdId || null,
      household?.name || null,
      null,
      null,
      null,
      1, // Creator starts with 1 upvote
      JSON.stringify(user?.id ? [user.id] : []),
      now,
      now,
    ]
  );
  saveDb();

  const created = queryOne('SELECT * FROM feedback_requests WHERE id = ?', [id]);
  res.json({
    ...created,
    upvotes: 1,
    upvoters: user?.id ? [user.id] : [],
    hasUpvoted: true,
  });
});

app.patch('/api/feedback', async (req, res) => {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { id, title, description, type, priority, status, adminResponse } = req.body;
  if (!id) return res.status(400).json({ error: 'ID is required' });

  const existing = queryOne<any>('SELECT * FROM feedback_requests WHERE id = ?', [id]);
  if (!existing) return res.status(404).json({ error: 'Request not found' });

  const isAdmin = isServerAdmin(user);
  const isCreator = user.id === existing.submittedByUserId || user.id === existing.submitted_by_user_id;

  if (!isAdmin && !isCreator) {
    return res.status(403).json({ error: 'You can only edit requests that you created' });
  }

  const now = new Date().toISOString();

  // Title, description, type, and priority can be edited by creator or admin
  const nextTitle = (title !== undefined && typeof title === 'string' && title.trim().length > 0) ? title.trim() : existing.title;
  const nextDescription = (description !== undefined && typeof description === 'string' && description.trim().length > 0) ? description.trim() : existing.description;
  const nextType = (type === 'bug' || type === 'feature') ? type : existing.type;
  const nextPriority = (priority && ['low', 'medium', 'high', 'critical'].includes(priority)) ? priority : existing.priority;

  // Status and official admin response are managed by admin (or creator can mark closed)
  let nextStatus = existing.status;
  if (isAdmin && status) {
    nextStatus = status;
  } else if (isCreator && status === 'closed') {
    nextStatus = 'closed';
  }

  const nextResponse = isAdmin && adminResponse !== undefined ? adminResponse : existing.adminResponse;
  const respondedAt = isAdmin && adminResponse !== undefined ? now : existing.adminRespondedAt;
  const respondedBy = isAdmin && adminResponse !== undefined ? user.name : existing.adminRespondedBy;

  execute(
    `UPDATE feedback_requests 
     SET title = ?, description = ?, type = ?, priority = ?, status = ?, adminResponse = ?, adminRespondedAt = ?, adminRespondedBy = ?, updatedAt = ?
     WHERE id = ?`,
    [nextTitle, nextDescription, nextType, nextPriority, nextStatus, nextResponse, respondedAt, respondedBy, now, id]
  );
  saveDb();

  const updated = queryOne<any>('SELECT * FROM feedback_requests WHERE id = ?', [id]);
  let voters: string[] = [];
  try {
    voters = updated.upvoters ? JSON.parse(updated.upvoters) : [];
  } catch {}

  let pushedToUser = false;
  let pushRecipientCount = 0;

  // Dispatch push notification to user if admin provided a response message or updated status
  const hasNewResponse =
    typeof adminResponse === 'string' &&
    adminResponse.trim().length > 0 &&
    adminResponse.trim() !== (existing.adminResponse || '').trim();
  const hasStatusChange = status && status !== existing.status;

  if (hasNewResponse || hasStatusChange) {
    try {
      const recipientUserId = existing.submittedByUserId;
      const recipientHouseholdId = existing.householdId;
      const typeLabel = existing.type === 'bug' ? 'Bug Report' : 'Feature Request';

      let pushTitle = `Update on your ${typeLabel}`;
      if (nextStatus === 'resolved') {
        pushTitle = `🎉 ${typeLabel} Completed!`;
      } else if (hasNewResponse) {
        pushTitle = `💬 Response to: "${existing.title.length > 32 ? existing.title.slice(0, 29) + '...' : existing.title}"`;
      }

      let pushBody = '';
      if (hasNewResponse) {
        const cleanMsg = adminResponse.trim();
        pushBody = `${user.name || 'Admin'}: "${cleanMsg.length > 120 ? cleanMsg.slice(0, 117) + '...' : cleanMsg}"`;
      } else if (hasStatusChange) {
        const statusDisplay = nextStatus.replace('_', ' ');
        pushBody = `Status changed to ${statusDisplay}: "${existing.title}"`;
      }

      // Send to the author if not the admin
      if (recipientUserId && recipientUserId !== user.id) {
        const pushRes = await sendPushNotificationToUser(
          recipientUserId,
          {
            title: pushTitle,
            body: pushBody,
            url: '/?tab=assistant&feedback=true',
            tag: `feedback-${id}`,
          },
          { householdId: recipientHouseholdId }
        );

        if (pushRes.success && pushRes.sentCount > 0) {
          pushedToUser = true;
          pushRecipientCount += pushRes.sentCount;
        }
      } else if (!recipientUserId && recipientHouseholdId && recipientHouseholdId !== user.householdId) {
        // Fallback for requests created without a specific userId
        const pushRes = await sendPushNotificationToUser(
          '',
          {
            title: pushTitle,
            body: pushBody,
            url: '/?tab=assistant&feedback=true',
            tag: `feedback-${id}`,
          },
          { householdId: recipientHouseholdId }
        );

        if (pushRes.success && pushRes.sentCount > 0) {
          pushedToUser = true;
          pushRecipientCount += pushRes.sentCount;
        }
      }

      // Also notify any other upvoters if status is resolved or there is a new response
      if (Array.isArray(voters) && voters.length > 0) {
        const otherVoters = voters.filter((vId) => vId !== user.id && vId !== recipientUserId);
        for (const voterId of otherVoters) {
          await sendPushNotificationToUser(voterId, {
            title: nextStatus === 'resolved' ? `🎉 Upvoted Feature Completed!` : `Update on "${existing.title}"`,
            body: hasNewResponse
              ? `${user.name || 'Admin'} replied: "${adminResponse.trim().slice(0, 80)}..."`
              : `Status updated to ${nextStatus.replace('_', ' ')}: "${existing.title}"`,
            url: '/?tab=assistant&feedback=true',
            tag: `feedback-${id}`,
          }).catch(() => {});
        }
      }
    } catch (pushErr) {
      console.warn('Failed to dispatch feedback push notification:', pushErr);
    }
  }

  res.json({
    ...updated,
    upvotes: typeof updated.upvotes === 'number' ? updated.upvotes : voters.length,
    upvoters: voters,
    hasUpvoted: voters.includes(user.id),
    pushedToUser,
    pushRecipientCount,
    submittedByUserName: existing.submittedByUserName,
  });
});

app.delete('/api/feedback', (req, res) => {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const id = req.query.id as string;
  if (!id) return res.status(400).json({ error: 'ID is required' });

  const existing = queryOne<any>('SELECT * FROM feedback_requests WHERE id = ?', [id]);
  if (!existing) return res.status(404).json({ error: 'Request not found' });

  const isAdmin = isServerAdmin(user);
  const isCreator = user.id === existing.submittedByUserId || user.id === existing.submitted_by_user_id;

  if (!isAdmin && !isCreator) {
    return res.status(403).json({ error: 'You can only delete requests that you created' });
  }

  execute('DELETE FROM feedback_requests WHERE id = ?', [id]);
  saveDb();

  res.json({ success: true, id });
});

// ---------------- ADMIN API ROUTES ----------------

// Admin: Overview & Platform Analytics
app.get('/api/admin/overview', (req, res) => {
  const user = getAuthUser(req);
  if (!user || !isServerAdmin(user)) {
    return res.status(403).json({ error: 'Admin access required.' });
  }

  const totalUsersRow = queryOne<{ count: number }>('SELECT COUNT(*) as count FROM users');
  const totalHouseholdsRow = queryOne<{ count: number }>('SELECT COUNT(*) as count FROM households');
  const activeHouseholdsRow = queryOne<{ count: number }>(
    "SELECT COUNT(*) as count FROM households WHERE subscriptionStatus IN ('active', 'lifetime_founder')"
  );
  const totalRecipesRow = queryOne<{ count: number }>('SELECT COUNT(*) as count FROM recipes');
  const aiRecipesRow = queryOne<{ count: number }>(
    "SELECT COUNT(*) as count FROM recipes WHERE tags LIKE '%ai%'"
  );
  const totalGroceryRow = queryOne<{ count: number }>('SELECT COUNT(*) as count FROM grocery_items');
  const checkedGroceryRow = queryOne<{ count: number }>('SELECT COUNT(*) as count FROM grocery_items WHERE checked = 1');
  const totalMealsRow = queryOne<{ count: number }>('SELECT COUNT(*) as count FROM meal_plans');
  const totalWeeklyMealsRow = queryOne<{ count: number }>('SELECT COUNT(*) as count FROM weekly_meals');
  const totalEventsRow = queryOne<{ count: number }>('SELECT COUNT(*) as count FROM calendar_events');
  const totalFeedbackRow = queryOne<{ count: number }>('SELECT COUNT(*) as count FROM feedback_requests');
  const openFeedbackRow = queryOne<{ count: number }>(
    "SELECT COUNT(*) as count FROM feedback_requests WHERE status IN ('open', 'in_progress')"
  );
  const totalPromoRow = queryOne<{ count: number }>('SELECT COUNT(*) as count FROM promo_codes');
  const claimedPromoRow = queryOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM promo_codes WHERE timesUsed > 0 OR claimedByUserName IS NOT NULL'
  );

  // Recent 10 users
  const recentUsers = queryAll<any>(`
    SELECT u.id, u.name, u.username, u.email, u.avatar, u.color, u.role, u.householdId,
           COALESCE(u.createdAt, h.createdAt, '') as createdAt,
           h.name as householdName, h.subscriptionStatus
    FROM users u
    LEFT JOIN households h ON u.householdId = h.id
    ORDER BY u.rowid DESC
    LIMIT 10
  `);

  // Recent 10 redemptions
  let recentRedemptions: any[] = [];
  try {
    recentRedemptions = queryAll<any>(`
      SELECT r.*, p.description as promoDescription, p.durationMonths
      FROM promo_redemptions r
      LEFT JOIN promo_codes p ON REPLACE(REPLACE(REPLACE(UPPER(p.code), '-', ''), ' ', ''), '_', '') = REPLACE(REPLACE(REPLACE(UPPER(r.promoCode), '-', ''), ' ', ''), '_', '')
      ORDER BY r.redeemedAt DESC
      LIMIT 10
    `);
  } catch {}

  // Recent 10 feedback requests
  const recentFeedback = queryAll<any>(`
    SELECT id, type, title, description, status, priority, submittedByUserName, householdName, upvotes, createdAt
    FROM feedback_requests
    ORDER BY createdAt DESC
    LIMIT 10
  `);

  // Recent 10 recipes created
  const recentRecipes = queryAll<any>(`
    SELECT r.id, r.title, r.imageUrl, r.tags, r.createdAt, h.name as householdName
    FROM recipes r
    LEFT JOIN households h ON r.householdId = h.id
    ORDER BY r.rowid DESC
    LIMIT 10
  `);

  res.json({
    stats: {
      totalUsers: totalUsersRow?.count || 0,
      totalHouseholds: totalHouseholdsRow?.count || 0,
      activeHouseholds: activeHouseholdsRow?.count || 0,
      totalRecipes: totalRecipesRow?.count || 0,
      aiRecipes: aiRecipesRow?.count || 0,
      totalGroceryItems: totalGroceryRow?.count || 0,
      checkedGroceryItems: checkedGroceryRow?.count || 0,
      totalMealPlans: (totalMealsRow?.count || 0) + (totalWeeklyMealsRow?.count || 0),
      totalCalendarEvents: totalEventsRow?.count || 0,
      totalFeedbackRequests: totalFeedbackRow?.count || 0,
      openFeedbackRequests: openFeedbackRow?.count || 0,
      totalPromoCodes: totalPromoRow?.count || 0,
      claimedPromoCodes: claimedPromoRow?.count || 0,
    },
    recentUsers,
    recentRedemptions,
    recentFeedback,
    recentRecipes,
  });
});

// Admin: Users List
app.get('/api/admin/users', (req, res) => {
  const user = getAuthUser(req);
  if (!user || !isServerAdmin(user)) {
    return res.status(403).json({ error: 'Admin access required.' });
  }

  const users = queryAll<any>(`
    SELECT 
      u.id, u.name, u.username, u.email, u.avatar, u.color, u.role, u.householdId,
      COALESCE(u.createdAt, h.createdAt, '') as createdAt,
      h.name as householdName, h.inviteCode as householdInviteCode,
      h.subscriptionStatus, h.subscriptionPlan, h.subscriptionExpiresAt,
      (SELECT COUNT(*) FROM recipes WHERE householdId = u.householdId) as householdRecipeCount,
      (SELECT COUNT(*) FROM grocery_items WHERE householdId = u.householdId) as householdGroceryCount,
      (SELECT COUNT(*) FROM calendar_events WHERE householdId = u.householdId) as householdEventCount
    FROM users u
    LEFT JOIN households h ON u.householdId = h.id
    ORDER BY u.rowid DESC
  `);

  res.json(users);
});

// Admin: Update User (e.g. role, name, email)
app.patch('/api/admin/users/:id', (req, res) => {
  const user = getAuthUser(req);
  if (!user || !isServerAdmin(user)) {
    return res.status(403).json({ error: 'Admin access required.' });
  }

  const targetId = req.params.id;
  const { role, name, email } = req.body;

  const targetUser = queryOne<any>('SELECT * FROM users WHERE id = ?', [targetId]);
  if (!targetUser) {
    return res.status(404).json({ error: 'User not found.' });
  }

  const updates: string[] = [];
  const params: any[] = [];

  if (role !== undefined && typeof role === 'string' && role.trim()) {
    updates.push('role = ?');
    params.push(role.trim());
  }

  if (name !== undefined && typeof name === 'string' && name.trim()) {
    updates.push('name = ?');
    params.push(name.trim());
  }

  if (email !== undefined) {
    updates.push('email = ?');
    params.push(typeof email === 'string' && email.trim() ? email.trim() : null);
  }

  if (updates.length > 0) {
    params.push(targetId);
    execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    saveDb();
  }

  const updated = queryOne<any>(`
    SELECT 
      u.id, u.name, u.username, u.email, u.avatar, u.color, u.role, u.householdId,
      COALESCE(u.createdAt, h.createdAt, '') as createdAt,
      h.name as householdName, h.inviteCode as householdInviteCode,
      h.subscriptionStatus, h.subscriptionPlan, h.subscriptionExpiresAt
    FROM users u
    LEFT JOIN households h ON u.householdId = h.id
    WHERE u.id = ?
  `, [targetId]);

  res.json(updated);
});

// Admin: Households Directory
app.get('/api/admin/households', (req, res) => {
  const user = getAuthUser(req);
  if (!user || !isServerAdmin(user)) {
    return res.status(403).json({ error: 'Admin access required.' });
  }

  const households = queryAll<any>(`
    SELECT 
      h.*,
      (SELECT COUNT(*) FROM users WHERE householdId = h.id) as memberCount,
      (SELECT group_concat(name, ', ') FROM users WHERE householdId = h.id) as memberNames,
      (SELECT COUNT(*) FROM recipes WHERE householdId = h.id) as recipeCount,
      (SELECT COUNT(*) FROM grocery_items WHERE householdId = h.id) as groceryCount,
      (SELECT COUNT(*) FROM calendar_events WHERE householdId = h.id) as eventCount
    FROM households h
    ORDER BY h.createdAt DESC
  `);

  res.json(households);
});

// Admin: Delete User
app.delete('/api/admin/users/:id', (req, res) => {
  const user = getAuthUser(req);
  if (!user || !isServerAdmin(user)) {
    return res.status(403).json({ error: 'Admin access required.' });
  }

  const targetId = req.params.id;
  const targetUser = queryOne<any>('SELECT * FROM users WHERE id = ?', [targetId]);
  if (!targetUser) {
    return res.status(404).json({ error: 'User not found.' });
  }

  // Prevent admin from deleting their own active logged-in user account
  const isCurrentAdmin =
    user.id === targetId ||
    (user.username && targetUser.username && user.username.toLowerCase() === targetUser.username.toLowerCase()) ||
    (user.email && targetUser.email && user.email.toLowerCase() === targetUser.email.toLowerCase());

  if (isCurrentAdmin) {
    return res.status(400).json({ error: 'Cannot delete your own active administrator account.' });
  }

  execute('DELETE FROM users WHERE id = ?', [targetId]);
  saveDb();

  res.json({ success: true, message: `User ${targetUser.name} deleted successfully.` });
});

// Admin: Delete Household
app.delete('/api/admin/households/:id', (req, res) => {
  const user = getAuthUser(req);
  if (!user || !isServerAdmin(user)) {
    return res.status(403).json({ error: 'Admin access required.' });
  }

  const targetId = req.params.id;
  const targetHousehold = queryOne<any>('SELECT * FROM households WHERE id = ?', [targetId]);
  if (!targetHousehold) {
    return res.status(404).json({ error: 'Household not found.' });
  }

  // Prevent admin from deleting their own active household
  if (user.householdId === targetId) {
    return res.status(400).json({ error: 'Cannot delete the household you currently belong to.' });
  }

  // Delete all data associated with this household
  execute('DELETE FROM users WHERE householdId = ?', [targetId]);
  execute('DELETE FROM grocery_items WHERE householdId = ?', [targetId]);
  execute('DELETE FROM recipes WHERE householdId = ?', [targetId]);
  execute('DELETE FROM calendar_events WHERE householdId = ?', [targetId]);
  execute('DELETE FROM meal_plans WHERE householdId = ?', [targetId]);
  execute('DELETE FROM aisles WHERE householdId = ?', [targetId]);
  execute('DELETE FROM households WHERE id = ?', [targetId]);
  saveDb();

  res.json({ success: true, message: `Household ${targetHousehold.name} and associated records deleted.` });
});

// Public Privacy Policy & Terms (for Google OAuth verification & branding)
app.get('/privacy', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Privacy Policy - Homebase</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; max-width: 760px; margin: 40px auto; padding: 0 20px; background: #080b12; color: #cbd5e1; }
    h1 { color: #f8fafc; font-size: 28px; margin-bottom: 4px; }
    h2 { color: #10b981; font-size: 18px; margin-top: 28px; margin-bottom: 8px; }
    p { margin-bottom: 14px; }
    a { color: #34d399; text-decoration: underline; }
    ul { margin-bottom: 14px; padding-left: 24px; }
    li { margin-bottom: 6px; }
    .box { background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.2); padding: 18px; border-radius: 12px; margin: 18px 0; }
    .back { display: inline-block; margin-bottom: 24px; color: #10b981; text-decoration: none; font-weight: 600; font-size: 14px; }
  </style>
</head>
<body>
  <a href="/" class="back">&larr; Back to Homebase</a>
  <h1>Privacy Policy</h1>
  <p><em>Last updated: September 16, 2026</em></p>
  
  <h2>1. Overview</h2>
  <p>Homebase (<a href="https://homebase.skyy.studio">https://homebase.skyy.studio</a>) is a private household management and family calendar application. Your privacy is paramount: we do not sell, rent, or monetize your personal data.</p>
  
  <div class="box">
    <h2 style="margin-top:0;">2. Google User Data & Google Calendar Sync</h2>
    <p>When you choose to connect your Google account to Homebase, our application accesses your Google Calendar data strictly for the following purposes:</p>
    <ul>
      <li>Reading metadata of your calendars to allow you to select which specific calendars are displayed.</li>
      <li>Reading your calendar events to display them on your family's unified schedule timeline.</li>
      <li>Allowing your household members to view family schedules in one synchronized place.</li>
    </ul>
    <p>Homebase does not share your Google Calendar data with any third parties, advertisers, or external services. Data is stored solely on your private household server instance.</p>
    
    <p><strong>Limited Use Policy:</strong> Homebase's use and transfer to any other app of information received from Google APIs will adhere to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener">Google API Services User Data Policy</a>, including the Limited Use requirements.</p>
    
    <p>We do NOT use Google Calendar data to train generalized AI/ML models.</p>
  </div>
  
  <h2>3. Revoking Access & Data Deletion</h2>
  <p>You can disconnect your Google Calendar integration at any time directly in Homebase under Settings, or by visiting your <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener">Google Account Security Permissions</a>. Disconnecting immediately removes stored refresh tokens and deletes synced Google events from the schedule timeline.</p>
  
  <h2>4. Contact</h2>
  <p>For questions regarding this policy or data deletion requests, contact the Homebase team at <a href="mailto:support@famkit.app">support@famkit.app</a>.</p>
</body>
</html>`);
});

app.get('/terms', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Terms of Service - Homebase</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; max-width: 760px; margin: 40px auto; padding: 0 20px; background: #080b12; color: #cbd5e1; }
    h1 { color: #f8fafc; font-size: 28px; margin-bottom: 4px; }
    h2 { color: #10b981; font-size: 18px; margin-top: 28px; margin-bottom: 8px; }
    p { margin-bottom: 14px; }
    a { color: #34d399; text-decoration: underline; }
    .back { display: inline-block; margin-bottom: 24px; color: #10b981; text-decoration: none; font-weight: 600; font-size: 14px; }
  </style>
</head>
<body>
  <a href="/" class="back">&larr; Back to Homebase</a>
  <h1>Terms of Service</h1>
  <p><em>Last updated: September 16, 2026</em></p>
  <h2>1. Use of Service</h2>
  <p>Homebase (<a href="https://homebase.skyy.studio">https://homebase.skyy.studio</a>) is provided for personal, household use to coordinate family calendars, meals, and lists.</p>
  <h2>2. Accounts & Security</h2>
  <p>Users are responsible for safeguarding their account credentials and controlling access to their private household invite codes.</p>
  <h2>3. Third-Party Integrations</h2>
  <p>When connecting external services like Google Calendar, you agree to comply with applicable third-party terms of service.</p>
  <h2>4. Contact</h2>
  <p>For questions regarding these terms, contact <a href="mailto:support@famkit.app">support@famkit.app</a>.</p>
</body>
</html>`);
});

// Serve static frontend build in production
const distPath = path.join(__dirname, '../dist');
app.use(
  express.static(distPath, {
    setHeaders: (res, filePath) => {
      const normalized = filePath.replace(/\\/g, '/');
      if (normalized.includes('/assets/')) {
        // Hashed Vite assets can be aggressively cached for 1 year
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else if (
        normalized.endsWith('.html') ||
        normalized.endsWith('sw.js') ||
        normalized.endsWith('sw-push.js') ||
        normalized.endsWith('registerSW.js') ||
        normalized.endsWith('manifest.webmanifest')
      ) {
        // Core application shell, SW, and manifests must NEVER be cached
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
    },
  })
);

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(distPath, 'index.html'));
  }
});

// Initialize database & start server
getDb().then(() => {
  try {
    // Self-heal: update any existing Chicken Parm recipes that had the generic chicken bowl image
    execute(
      `UPDATE recipes 
       SET imageUrl = 'https://images.unsplash.com/photo-1632778149955-e80f8ceca2e8?w=800&auto=format&fit=crop&q=80' 
       WHERE (LOWER(title) LIKE '%parm%' OR LOWER(title) LIKE '%parmigiana%')
         AND (imageUrl LIKE '%1604908176997%' OR imageUrl LIKE '%546069901%')`
    );
    // Self-heal: update any Wild Rice / Mushroom Soup recipes that got the blurry or wrong chicken noodle soup image
    execute(
      `UPDATE recipes
       SET imageUrl = 'https://upload.wikimedia.org/wikipedia/commons/7/78/Porcini_Wild_Rice_Soup_%28140491721%29.jpeg'
       WHERE (LOWER(title) LIKE '%wild rice%' OR LOWER(title) LIKE '%mushroom soup%')
         AND (imageUrl LIKE '%Chicken_Noodle_Soup%' OR imageUrl LIKE '%547592166%' OR imageUrl LIKE '%pollinations%')`
    );
    // Self-heal: update Tuscan or Creamy Garlic Chicken recipes that mistakenly got the whole roast chicken carcass
    execute(
      `UPDATE recipes
       SET imageUrl = 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800&auto=format&fit=crop&q=80'
       WHERE (LOWER(title) LIKE '%tuscan%' OR LOWER(title) LIKE '%creamy garlic%' OR LOWER(title) LIKE '%garlic chicken%')
         AND (imageUrl LIKE '%1598103442097%')`
    );
    // Self-heal: update Salmon / Tzatziki / Poke / Mediterranean bowls that got plain fillet or carcass
    execute(
      `UPDATE recipes
       SET imageUrl = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80'
       WHERE (LOWER(title) LIKE '%bowl%' AND LOWER(title) LIKE '%salmon%')
         AND (imageUrl LIKE '%1519708227418%' OR imageUrl LIKE '%1598103442097%')`
    );
    // Self-heal: update Fajitas that mistakenly got the whole roast chicken carcass
    execute(
      `UPDATE recipes
       SET imageUrl = 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=800&auto=format&fit=crop&q=80'
       WHERE LOWER(title) LIKE '%fajita%'
         AND (imageUrl LIKE '%1598103442097%')`
    );
    saveDb();
  } catch {}

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`⚡ Homebase server running on http://0.0.0.0:${PORT}`);
    initBackgroundGoogleSync();
    initBackgroundInventoryAlerts(sendPushNotificationToHousehold);
  });
});

