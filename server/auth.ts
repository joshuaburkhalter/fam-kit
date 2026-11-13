import crypto from 'crypto';

const TOKEN_PREFIX = 'hb1';
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const OAUTH_STATE_TTL_MS = 15 * 60 * 1000; // 15 minutes

let ephemeralSecret: string | null = null;

export function getAuthSecret(): string {
  const envSecret = (process.env.AUTH_SECRET || process.env.SESSION_SECRET || '').trim();
  if (envSecret) return envSecret;

  if (!ephemeralSecret) {
    ephemeralSecret = crypto.randomBytes(32).toString('hex');
    if (process.env.NODE_ENV === 'production') {
      console.warn(
        '[SECURITY WARNING] AUTH_SECRET is not set in production. Sessions will invalidate on server restart. Set AUTH_SECRET in your environment variables.'
      );
    }
  }
  return ephemeralSecret;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function isLegacyPlaintextPassword(stored: string | null | undefined): boolean {
  return !stored || !stored.startsWith('scrypt$');
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!password || !stored) return false;

  if (stored.startsWith('scrypt$')) {
    const parts = stored.split('$');
    if (parts.length !== 3) return false;
    const [, salt, hashHex] = parts;
    if (!salt || !hashHex) return false;
    try {
      const derived = crypto.scryptSync(password, salt, 64);
      const expected = Buffer.from(hashHex, 'hex');
      if (derived.length !== expected.length) return false;
      return crypto.timingSafeEqual(derived, expected);
    } catch {
      return false;
    }
  }

  // Legacy plaintext comparison (constant-time) for seamless migration on login
  const a = Buffer.from(password, 'utf8');
  const b = Buffer.from(stored, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function signHmac(data: string): string {
  return crypto.createHmac('sha256', getAuthSecret()).update(data).digest('base64url');
}

function verifyHmac(data: string, sig: string): boolean {
  const expected = signHmac(data);
  const a = Buffer.from(sig, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function createSessionToken(userId: string, householdId: string): string {
  const now = Date.now();
  const payload = Buffer.from(
    JSON.stringify({
      uid: userId,
      hid: householdId,
      iat: now,
      exp: now + TOKEN_TTL_MS,
    }),
    'utf8'
  ).toString('base64url');
  const sig = signHmac(payload);
  return `${TOKEN_PREFIX}.${payload}.${sig}`;
}

export function verifySessionToken(token: string): { uid: string; hid: string } | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.trim().split('.');
  if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) return null;
  const [, payloadB64, sig] = parts;
  if (!payloadB64 || !sig) return null;

  if (!verifyHmac(payloadB64, sig)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (!parsed || typeof parsed.uid !== 'string' || typeof parsed.exp !== 'number') {
      return null;
    }
    if (Date.now() > parsed.exp) return null;
    return { uid: parsed.uid, hid: parsed.hid || '' };
  } catch {
    return null;
  }
}

export function signOAuthState(data: Record<string, unknown>): string {
  const now = Date.now();
  const payload = Buffer.from(
    JSON.stringify({
      ...data,
      nonce: crypto.randomBytes(12).toString('hex'),
      iat: now,
      exp: now + OAUTH_STATE_TTL_MS,
    }),
    'utf8'
  ).toString('base64url');
  const sig = signHmac(`oauth:${payload}`);
  return `${payload}.${sig}`;
}

export function verifyOAuthState<T = Record<string, unknown>>(state: string): T | null {
  if (!state || typeof state !== 'string') return null;
  const parts = state.trim().split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  if (!payloadB64 || !sig) return null;
  if (!verifyHmac(`oauth:${payloadB64}`, sig)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (!parsed || typeof parsed.exp !== 'number' || Date.now() > parsed.exp) {
      return null;
    }
    return parsed as T;
  } catch {
    return null;
  }
}
