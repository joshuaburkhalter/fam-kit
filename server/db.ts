import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath =
  process.env.DATABASE_PATH ||
  (fs.existsSync('/var/data') ? '/var/data/famkit.db' : path.join(__dirname, '../famkit.db'));

let dbInstance: Database | null = null;

export async function getDb(): Promise<Database> {
  if (dbInstance) return dbInstance;

  const SQL = await initSqlJs({
    locateFile: (file) => path.resolve(__dirname, '../node_modules/sql.js/dist', file),
  });

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    dbInstance = new SQL.Database(fileBuffer);
  } else {
    dbInstance = new SQL.Database();
  }

  initSchema(dbInstance);
  return dbInstance;
}

export function saveDb() {
  if (!dbInstance) return;
  const data = dbInstance.export();
  const buffer = Buffer.from(data);
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(dbPath, buffer);
}

function initSchema(db: Database) {
  db.run(`
    CREATE TABLE IF NOT EXISTS households (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      inviteCode TEXT UNIQUE NOT NULL,
      createdAt TEXT NOT NULL,
      subscriptionStatus TEXT DEFAULT 'unpaid',
      subscriptionPlan TEXT,
      subscriptionExpiresAt TEXT,
      promoCodeUsed TEXT,
      stripeCustomerId TEXT,
      stripeSubscriptionId TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      username TEXT UNIQUE,
      email TEXT,
      avatar TEXT DEFAULT '👤',
      color TEXT NOT NULL DEFAULT '#10b981',
      role TEXT NOT NULL DEFAULT 'Parent',
      householdId TEXT NOT NULL,
      password TEXT NOT NULL DEFAULT 'password123',
      createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS aisles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT '🛒',
      orderIndex INTEGER NOT NULL DEFAULT 0,
      householdId TEXT NOT NULL,
      listId TEXT DEFAULT 'grocery'
    );

    CREATE TABLE IF NOT EXISTS grocery_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Other',
      aisleId TEXT,
      quantity TEXT DEFAULT '1',
      unit TEXT,
      note TEXT,
      checked INTEGER NOT NULL DEFAULT 0,
      listId TEXT,
      addedById TEXT,
      householdId TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS grocery_category_preferences (
      id TEXT PRIMARY KEY,
      householdId TEXT NOT NULL,
      normalizedName TEXT NOT NULL,
      rawName TEXT NOT NULL,
      aisleId TEXT NOT NULL,
      category TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      UNIQUE(householdId, normalizedName)
    );
    CREATE INDEX IF NOT EXISTS idx_grocery_pref_lookup ON grocery_category_preferences(householdId, normalizedName);

    CREATE TABLE IF NOT EXISTS custom_lists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'packing',
      icon TEXT NOT NULL DEFAULT '📋',
      color TEXT NOT NULL DEFAULT '#10b981',
      householdId TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recipes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      imageUrl TEXT,
      prepTime TEXT,
      cookTime TEXT,
      servings TEXT,
      sourceUrl TEXT,
      ingredients TEXT NOT NULL,
      instructions TEXT NOT NULL,
      tags TEXT,
      householdId TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS meal_plans (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      mealType TEXT NOT NULL,
      title TEXT NOT NULL,
      notes TEXT,
      recipeId TEXT,
      householdId TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS calendar_events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      date TEXT NOT NULL,
      startTime TEXT,
      endTime TEXT,
      category TEXT NOT NULL DEFAULT 'Family',
      location TEXT,
      assignedMemberId TEXT,
      householdId TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS weekly_meals (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      recipeId TEXT,
      notes TEXT,
      isMade INTEGER NOT NULL DEFAULT 0,
      madeDate TEXT,
      scheduledDate TEXT,
      calendarEventId TEXT,
      weekStartDate TEXT NOT NULL,
      householdId TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS meal_logs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      recipeId TEXT,
      date TEXT NOT NULL,
      notes TEXT,
      cookedByUserId TEXT,
      householdId TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id TEXT PRIMARY KEY,
      endpoint TEXT UNIQUE NOT NULL,
      keys TEXT NOT NULL,
      userId TEXT,
      householdId TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notification_preferences (
      userId TEXT PRIMARY KEY,
      householdId TEXT NOT NULL,
      groceryAdded INTEGER NOT NULL DEFAULT 1,
      groceryCompleted INTEGER NOT NULL DEFAULT 1,
      calendarEvents INTEGER NOT NULL DEFAULT 1,
      mealPlans INTEGER NOT NULL DEFAULT 1,
      recipesAdded INTEGER NOT NULL DEFAULT 1,
      assistantActions INTEGER NOT NULL DEFAULT 1,
      notifyOwnActions INTEGER NOT NULL DEFAULT 0,
      quietHoursEnabled INTEGER NOT NULL DEFAULT 0,
      quietHoursStart TEXT NOT NULL DEFAULT '22:00',
      quietHoursEnd TEXT NOT NULL DEFAULT '07:00',
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_google_sync (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      householdId TEXT NOT NULL,
      googleEmail TEXT,
      accessToken TEXT,
      refreshToken TEXT,
      tokenExpiry INTEGER,
      selectedCalendarId TEXT DEFAULT 'primary',
      syncToken TEXT,
      lastSyncedAt TEXT,
      createdAt TEXT NOT NULL,
      UNIQUE(userId, householdId)
    );

    CREATE TABLE IF NOT EXISTS feedback_requests (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'open',
      submittedByUserId TEXT,
      submittedByUserName TEXT NOT NULL,
      submittedByUserEmail TEXT,
      householdId TEXT,
      householdName TEXT,
      adminResponse TEXT,
      adminRespondedAt TEXT,
      adminRespondedBy TEXT,
      upvotes INTEGER NOT NULL DEFAULT 0,
      upvoters TEXT NOT NULL DEFAULT '[]',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inventory_items (
      id TEXT PRIMARY KEY,
      householdId TEXT NOT NULL,
      name TEXT NOT NULL,
      barcode TEXT,
      category TEXT NOT NULL DEFAULT 'Other',
      location TEXT NOT NULL DEFAULT 'pantry',
      quantity TEXT,
      unit TEXT,
      imageUrl TEXT,
      isStock INTEGER NOT NULL DEFAULT 0,
      restockCadenceDays INTEGER,
      lastRestockedAt TEXT,
      expiresAt TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `);

  // Auto-migration for existing DBs: ensure tables and columns exist
  try {
    db.run(`
      CREATE TABLE IF NOT EXISTS inventory_items (
        id TEXT PRIMARY KEY,
        householdId TEXT NOT NULL,
        name TEXT NOT NULL,
        barcode TEXT,
        category TEXT NOT NULL DEFAULT 'Other',
        location TEXT NOT NULL DEFAULT 'pantry',
        quantity TEXT,
        unit TEXT,
        imageUrl TEXT,
        isStock INTEGER NOT NULL DEFAULT 0,
        restockCadenceDays INTEGER,
        lastRestockedAt TEXT,
        expiresAt TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
    `);
  } catch {}
  try {
    db.run(`
      CREATE TABLE IF NOT EXISTS user_google_sync (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        householdId TEXT NOT NULL,
        googleEmail TEXT,
        accessToken TEXT,
        refreshToken TEXT,
        tokenExpiry INTEGER,
        selectedCalendarId TEXT DEFAULT 'primary',
        syncToken TEXT,
        lastSyncedAt TEXT,
        createdAt TEXT NOT NULL,
        UNIQUE(userId, householdId)
      );
    `);
  } catch {}
  try {
    db.run(`ALTER TABLE calendar_events ADD COLUMN googleEventId TEXT`);
  } catch {}
  try {
    db.run(`ALTER TABLE calendar_events ADD COLUMN googleCalendarId TEXT`);
  } catch {}
  try {
    db.run(`ALTER TABLE calendar_events ADD COLUMN isGoogleEvent INTEGER NOT NULL DEFAULT 0`);
  } catch {}
  try {
    db.run(`ALTER TABLE calendar_events ADD COLUMN updatedAt TEXT`);
  } catch {}
  try {
    db.run(`UPDATE calendar_events SET updatedAt = createdAt WHERE updatedAt IS NULL`);
  } catch {}
  try {
    db.run(`ALTER TABLE user_google_sync ADD COLUMN selectedCalendarIds TEXT DEFAULT '["primary"]'`);
  } catch {}
  try {
    db.run(`ALTER TABLE user_google_sync ADD COLUMN calendarMemberMap TEXT`);
  } catch {}
  try {
    db.run(`CREATE INDEX IF NOT EXISTS idx_cal_google ON calendar_events (householdId, googleEventId)`);
  } catch {}
  try {
    db.run(`
      CREATE TABLE IF NOT EXISTS notification_preferences (
        userId TEXT PRIMARY KEY,
        householdId TEXT NOT NULL,
        groceryAdded INTEGER NOT NULL DEFAULT 1,
        groceryCompleted INTEGER NOT NULL DEFAULT 1,
        calendarEvents INTEGER NOT NULL DEFAULT 1,
        mealPlans INTEGER NOT NULL DEFAULT 1,
        recipesAdded INTEGER NOT NULL DEFAULT 1,
        assistantActions INTEGER NOT NULL DEFAULT 1,
        notifyOwnActions INTEGER NOT NULL DEFAULT 0,
        quietHoursEnabled INTEGER NOT NULL DEFAULT 0,
        quietHoursStart TEXT NOT NULL DEFAULT '22:00',
        quietHoursEnd TEXT NOT NULL DEFAULT '07:00',
        updatedAt TEXT NOT NULL
      );
    `);
  } catch {}
  try {
    db.run(`
      CREATE TABLE IF NOT EXISTS weekly_meals (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        recipeId TEXT,
        notes TEXT,
        isMade INTEGER NOT NULL DEFAULT 0,
        madeDate TEXT,
        scheduledDate TEXT,
        weekStartDate TEXT NOT NULL,
        householdId TEXT NOT NULL,
        createdAt TEXT NOT NULL
      );
    `);
  } catch {}
  try {
    db.run(`ALTER TABLE weekly_meals ADD COLUMN scheduledDate TEXT`);
  } catch {}
  try {
    db.run(`ALTER TABLE weekly_meals ADD COLUMN calendarEventId TEXT`);
  } catch {}
  try {
    db.run(`
      CREATE TABLE IF NOT EXISTS meal_logs (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        recipeId TEXT,
        date TEXT NOT NULL,
        notes TEXT,
        cookedByUserId TEXT,
        householdId TEXT NOT NULL,
        createdAt TEXT NOT NULL
      );
    `);
  } catch {}
  try {
    db.run(`ALTER TABLE users ADD COLUMN password TEXT DEFAULT 'password123'`);
  } catch {}
  try {
    db.run(`UPDATE users SET password = 'password123' WHERE password IS NULL OR password = ''`);
  } catch {}
  try {
    db.run(`UPDATE users SET avatar = '' WHERE avatar IS NOT NULL AND avatar NOT LIKE 'data:image%' AND avatar NOT LIKE 'http%'`);
  } catch {}

  // Username column migration & backfill
  try {
    db.run(`ALTER TABLE users ADD COLUMN username TEXT`);
  } catch {}
  try {
    db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users (username)`);
  } catch {}

  try {
    // Backfill known primary users
    db.run(`UPDATE users SET username = 'joshuaburkhalter' WHERE id = 'u_1788884573046' AND (username IS NULL OR username = '')`);
    db.run(`UPDATE users SET username = 'joshua' WHERE id = 'u1' AND (username IS NULL OR username = '')`);
    db.run(`UPDATE users SET username = 'sarah' WHERE id = 'u2' AND (username IS NULL OR username = '')`);
    db.run(`UPDATE users SET username = 'leo' WHERE id = 'u3' AND (username IS NULL OR username = '')`);
    db.run(`UPDATE users SET username = 'emma' WHERE id = 'u4' AND (username IS NULL OR username = '')`);
    db.run(`UPDATE users SET username = 'alex' WHERE id = 'u5' AND (username IS NULL OR username = '')`);
    db.run(`UPDATE users SET username = 'jamie' WHERE id = 'u6' AND (username IS NULL OR username = '')`);

    // Generic backfill for any other users
    const usersWithoutUsername = db.exec("SELECT id, name, email FROM users WHERE username IS NULL OR username = ''");
    if (usersWithoutUsername.length > 0 && usersWithoutUsername[0].values) {
      for (const row of usersWithoutUsername[0].values) {
        const id = String(row[0]);
        const name = String(row[1] || 'user');
        const email = row[2] ? String(row[2]) : '';
        let base = email && email.includes('@')
          ? email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '')
          : name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9_]/g, '');
        if (!base) base = `user_${id.slice(-4)}`;

        let candidate = base;
        let counter = 1;
        while (true) {
          const check = db.exec(`SELECT COUNT(*) FROM users WHERE username = '${candidate}' AND id != '${id}'`);
          const existingCount = (check[0]?.values[0]?.[0] as number) || 0;
          if (existingCount === 0) break;
          counter++;
          candidate = `${base}${counter}`;
        }
        db.run(`UPDATE users SET username = ? WHERE id = ?`, [candidate, id]);
      }
    }
  } catch (err) {
    console.error('Error backfilling usernames:', err);
  }

  // Ensure all households have a randomized alphanumeric invite code
  try {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const generateCode = () => {
      let c = '';
      for (let i = 0; i < 6; i++) c += chars.charAt(Math.floor(Math.random() * chars.length));
      return c;
    };
    const households = db.exec("SELECT id, inviteCode FROM households WHERE inviteCode IN ('FAMKIT', 'HOMEBASE', 'MILLER') OR length(inviteCode) < 4");
    if (households.length > 0 && households[0].values) {
      for (const row of households[0].values) {
        const hid = String(row[0]);
        db.run("UPDATE households SET inviteCode = ? WHERE id = ?", [generateCode(), hid]);
      }
    }
  } catch (err) {
    console.error('Error randomizing invite codes:', err);
  }

  // Auto-migration for subscription & promo codes
  try {
    db.run(`ALTER TABLE households ADD COLUMN subscriptionStatus TEXT DEFAULT 'unpaid'`);
  } catch {}
  try {
    db.run(`ALTER TABLE households ADD COLUMN subscriptionPlan TEXT`);
  } catch {}
  try {
    db.run(`ALTER TABLE households ADD COLUMN subscriptionExpiresAt TEXT`);
  } catch {}
  try {
    db.run(`ALTER TABLE households ADD COLUMN promoCodeUsed TEXT`);
  } catch {}
  try {
    db.run(`ALTER TABLE households ADD COLUMN stripeCustomerId TEXT`);
  } catch {}
  try {
    db.run(`ALTER TABLE households ADD COLUMN stripeSubscriptionId TEXT`);
  } catch {}
  try {
    db.run(`
      CREATE TABLE IF NOT EXISTS promo_codes (
        code TEXT PRIMARY KEY,
        description TEXT NOT NULL,
        durationMonths INTEGER,
        maxUses INTEGER NOT NULL DEFAULT 1,
        timesUsed INTEGER NOT NULL DEFAULT 0,
        isActive INTEGER NOT NULL DEFAULT 1,
        assignedTo TEXT,
        createdByUserId TEXT,
        createdAt TEXT NOT NULL
      );
    `);
  } catch {}
  try {
    db.run(`ALTER TABLE promo_codes ADD COLUMN assignedTo TEXT`);
  } catch {}
  try {
    db.run(`ALTER TABLE promo_codes ADD COLUMN claimedByUserName TEXT`);
  } catch {}
  try {
    db.run(`ALTER TABLE promo_codes ADD COLUMN claimedByUserEmail TEXT`);
  } catch {}
  try {
    db.run(`ALTER TABLE promo_codes ADD COLUMN claimedByHouseholdName TEXT`);
  } catch {}
  try {
    db.run(`ALTER TABLE promo_codes ADD COLUMN claimedAt TEXT`);
  } catch {}
  try {
    db.run(`
      CREATE TABLE IF NOT EXISTS promo_redemptions (
        id TEXT PRIMARY KEY,
        promoCode TEXT NOT NULL,
        householdId TEXT,
        householdName TEXT,
        userId TEXT,
        userName TEXT,
        userEmail TEXT,
        redeemedAt TEXT NOT NULL
      );
    `);
  } catch {}
  try {
    db.run(`
      CREATE TABLE IF NOT EXISTS deleted_promo_codes (
        code TEXT PRIMARY KEY,
        deletedAt TEXT NOT NULL
      );
    `);
  } catch {}
  try {
    db.run(`
      CREATE TABLE IF NOT EXISTS app_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  } catch {}
  try {
    db.run(`
      CREATE TABLE IF NOT EXISTS feedback_requests (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        priority TEXT NOT NULL DEFAULT 'medium',
        status TEXT NOT NULL DEFAULT 'open',
        submittedByUserId TEXT,
        submittedByUserName TEXT NOT NULL,
        submittedByUserEmail TEXT,
        householdId TEXT,
        householdName TEXT,
        adminResponse TEXT,
        adminRespondedAt TEXT,
        adminRespondedBy TEXT,
        upvotes INTEGER NOT NULL DEFAULT 0,
        upvoters TEXT NOT NULL DEFAULT '[]',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
    `);
  } catch {}
  try {
    db.run(`ALTER TABLE feedback_requests ADD COLUMN upvotes INTEGER NOT NULL DEFAULT 0;`);
  } catch {}
  try {
    db.run(`ALTER TABLE feedback_requests ADD COLUMN upvoters TEXT NOT NULL DEFAULT '[]';`);
  } catch {}
  try {
    db.run(`ALTER TABLE users ADD COLUMN createdAt TEXT;`);
  } catch {}
  try {
    db.run(`ALTER TABLE aisles ADD COLUMN listId TEXT DEFAULT 'grocery';`);
  } catch {}
  try {
    db.run(`UPDATE aisles SET listId = 'grocery' WHERE listId IS NULL;`);
  } catch {}
  try {
    db.run(`
      UPDATE users 
      SET createdAt = (
        SELECT COALESCE(h.createdAt, datetime('now'))
        FROM households h 
        WHERE h.id = users.householdId
      )
      WHERE createdAt IS NULL OR createdAt = '';
    `);
  } catch {}
  try {
    // Ensure Joshua is set as Admin role
    db.run(`
      UPDATE users 
      SET role = 'Admin' 
      WHERE LOWER(username) = 'joshua' 
         OR LOWER(email) = 'joshua@redpointaudio.com'
         OR LOWER(email) = 'joshuaburkhalter@gmail.com'
    `);
  } catch {}

  // Backfill demo households with active lifetime access so demo users remain functional
  try {
    db.run(`
      UPDATE households 
      SET subscriptionStatus = 'active', 
          subscriptionPlan = 'lifetime_founder' 
      WHERE (id IN ('fam_default_1', 'fam_default_2') OR id LIKE 'fam_default_%')
        AND (subscriptionStatus IS NULL OR subscriptionStatus = '' OR subscriptionStatus = 'unpaid')
    `);
  } catch {}

  // Seed sample secure promo codes ONLY on initial fresh install if none exist
  try {
    const promoCountRes = db.exec('SELECT COUNT(*) FROM promo_codes');
    const promoCount = (promoCountRes[0]?.values[0]?.[0] as number) || 0;

    let isSeeded = false;
    try {
      const metadataRes = db.exec("SELECT value FROM app_metadata WHERE key = 'promo_codes_seeded'");
      isSeeded = metadataRes.length > 0 && !!metadataRes[0].values && metadataRes[0].values.length > 0;
    } catch {}

    const now = new Date().toISOString();
    const defaultCodes = [
      ['HB3-7X9K-2M4P', '3 Months Complimentary Full Access', 3, 100, now, '3 Month Master Pass'],
      ['HB6-8W4R-9Q1Z', '6 Months Complimentary Full Access', 6, 100, now, '6 Month Master Pass'],
      ['HBL-5T2N-8B7C', 'Lifetime VIP Complimentary Access', null, 100, now, 'Lifetime Master Pass'],
      ['HOMEBASEVIP', 'Lifetime VIP Master Pass', null, 500, now, 'VIP Master Pass'],
      ['FAMILYVIP', 'Lifetime VIP Family Access', null, 500, now, 'VIP Family Pass'],
      ['VIP2026', 'Complimentary Family Access Pass', null, 500, now, 'VIP 2026 Pass'],
      ['BETA2026', 'Closed Beta Early Access Pass', null, 1000, now, 'Beta 2026 Master Pass'],
      ['BETA', 'Closed Beta Tester Pass', null, 1000, now, 'Beta Tester Pass'],
    ];

    if (!isSeeded && promoCount === 0) {
      for (const [c, desc, dur, maxU, dt, assigned] of defaultCodes) {
        db.run(
          `INSERT OR IGNORE INTO promo_codes (code, description, durationMonths, maxUses, timesUsed, isActive, createdAt, assignedTo) VALUES (?, ?, ?, ?, 0, 1, ?, ?)`,
          [c, desc, dur, maxU, dt, assigned]
        );
      }
      try {
        db.run("INSERT OR REPLACE INTO app_metadata (key, value) VALUES ('promo_codes_seeded', '1')");
      } catch {}
    } else if (!isSeeded) {
      // Database already has codes from past usage; record seeded marker so deleted default codes are never resurrected
      try {
        db.run("INSERT OR REPLACE INTO app_metadata (key, value) VALUES ('promo_codes_seeded', '1')");
      } catch {}
    }

    // Auto-heal / backfill promo code redemptions with household name and user full name
    // (Only for promo codes that have not been permanently deleted)
    try {
      const claimedHouseholds = db.exec(`
        SELECT h.id as householdId, h.name as householdName, h.promoCodeUsed,
               (SELECT u.name FROM users u WHERE u.householdId = h.id ORDER BY u.id ASC LIMIT 1) as userName,
               (SELECT u.email FROM users u WHERE u.householdId = h.id ORDER BY u.id ASC LIMIT 1) as userEmail
        FROM households h
        WHERE h.promoCodeUsed IS NOT NULL AND h.promoCodeUsed != ''
          AND UPPER(h.promoCodeUsed) NOT IN (SELECT UPPER(code) FROM deleted_promo_codes)
      `);
      if (claimedHouseholds.length > 0 && claimedHouseholds[0].values) {
        for (const row of claimedHouseholds[0].values) {
          const hid = String(row[0]);
          const hname = String(row[1] || 'Household');
          const code = String(row[2]);
          const uname = row[3] ? String(row[3]) : null;
          const uemail = row[4] ? String(row[4]) : null;

          db.run(`
            UPDATE promo_codes
            SET claimedByHouseholdName = COALESCE(claimedByHouseholdName, ?),
                claimedByUserName = COALESCE(claimedByUserName, ?),
                claimedByUserEmail = COALESCE(claimedByUserEmail, ?)
            WHERE (UPPER(code) = UPPER(?) OR REPLACE(REPLACE(REPLACE(UPPER(code), '-', ''), ' ', ''), '_', '') = REPLACE(REPLACE(REPLACE(UPPER(?), '-', ''), ' ', ''), '_', ''))
              AND UPPER(code) NOT IN (SELECT UPPER(code) FROM deleted_promo_codes)
          `, [hname, uname, uemail, code, code]);

          db.run(`
            INSERT OR IGNORE INTO promo_redemptions (id, promoCode, householdId, householdName, userId, userName, userEmail, redeemedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [`red_${code}_${hid}`, code, hid, hname, null, uname, uemail, now]);
        }
      }
    } catch (err) {
      console.error('Error backfilling promo redemption details:', err);
    }

    // Auto-heal household subscription status for any promo redemptions, promo codes, or assigned passes
    healHouseholdSubscriptions(db);
  } catch (err) {
    console.error('Error seeding promo codes:', err);
  }

  // Cleanup any legacy seeded Miller family demo households and users
  try {
    db.run(`DELETE FROM grocery_items WHERE householdId = 'fam_default_2' OR id LIKE 'gm%'`);
    db.run(`DELETE FROM calendar_events WHERE householdId = 'fam_default_2' OR id LIKE 'ev_m%'`);
    db.run(`DELETE FROM meal_plans WHERE householdId = 'fam_default_2' OR id = 'm_miller_today'`);
    db.run(`DELETE FROM aisles WHERE householdId = 'fam_default_2'`);
    db.run(`DELETE FROM users WHERE householdId = 'fam_default_2' OR (householdId = 'fam_default_1' AND email IN ('alex@miller.com', 'jamie@miller.com')) OR id IN ('u5', 'u6')`);
    db.run(`DELETE FROM households WHERE id = 'fam_default_2' OR (id = 'fam_default_1' AND name = 'The Miller Family')`);
    db.run(`DELETE FROM promo_codes WHERE code LIKE 'TEST-%'`);
  } catch (err) {
    console.error('Error cleaning up legacy demo seed data:', err);
  }

  // Check if seeded
  const check = db.exec('SELECT COUNT(*) as count FROM households');
  const count = (check[0]?.values[0]?.[0] as number) || 0;

  if (count === 0) {
    seedDemoData(db);
  }

  healHouseholdSubscriptions(db);
  saveDb();
}

export function healHouseholdSubscriptions(db?: Database) {
  const targetDb = db || dbInstance;
  if (!targetDb) return;

  try {
    // 1. Any household that has promoCodeUsed set, make sure subscriptionStatus is active
    targetDb.run(`
      UPDATE households
      SET subscriptionStatus = 'active',
          subscriptionPlan = COALESCE(
            subscriptionPlan,
            (SELECT CASE WHEN p.durationMonths IS NOT NULL THEN 'promo_' || p.durationMonths || 'mo' ELSE 'promo_lifetime' END FROM promo_codes p WHERE UPPER(p.code) = UPPER(households.promoCodeUsed) LIMIT 1),
            'promo_lifetime'
          )
      WHERE (subscriptionStatus IS NULL OR subscriptionStatus = '' OR subscriptionStatus = 'unpaid')
        AND promoCodeUsed IS NOT NULL AND promoCodeUsed != ''
        AND UPPER(promoCodeUsed) NOT IN (SELECT UPPER(code) FROM deleted_promo_codes);
    `);

    // 2. Any household that is in promo_redemptions, ensure active
    targetDb.run(`
      UPDATE households
      SET subscriptionStatus = 'active',
          promoCodeUsed = COALESCE(
            promoCodeUsed,
            (SELECT promoCode FROM promo_redemptions WHERE householdId = households.id ORDER BY redeemedAt DESC LIMIT 1)
          ),
          subscriptionPlan = COALESCE(subscriptionPlan, 'promo_lifetime')
      WHERE (subscriptionStatus IS NULL OR subscriptionStatus = '' OR subscriptionStatus = 'unpaid')
        AND id IN (SELECT householdId FROM promo_redemptions WHERE householdId IS NOT NULL);
    `);

    // 3. Any household whose members' email or name matches claimedByUserEmail / claimedByUserName / assignedTo in promo_codes
    targetDb.run(`
      UPDATE households
      SET subscriptionStatus = 'active',
          promoCodeUsed = COALESCE(
            promoCodeUsed,
            (
              SELECT p.code FROM promo_codes p
              JOIN users u ON u.householdId = households.id
              WHERE (
                (u.email IS NOT NULL AND u.email != '' AND LOWER(u.email) = LOWER(p.claimedByUserEmail))
                OR (u.name IS NOT NULL AND u.name != '' AND LOWER(u.name) = LOWER(p.claimedByUserName))
                OR (p.assignedTo IS NOT NULL AND p.assignedTo != '' AND (
                      LOWER(u.name) = LOWER(p.assignedTo)
                      OR (u.email IS NOT NULL AND LOWER(u.email) = LOWER(p.assignedTo))
                      OR LOWER(households.name) = LOWER(p.assignedTo)
                      OR LOWER(households.name) LIKE '%' || LOWER(p.assignedTo) || '%'
                   ))
              )
              AND UPPER(p.code) NOT IN (SELECT UPPER(code) FROM deleted_promo_codes)
              ORDER BY p.rowid DESC LIMIT 1
            )
          ),
          subscriptionPlan = COALESCE(subscriptionPlan, 'promo_lifetime')
      WHERE (subscriptionStatus IS NULL OR subscriptionStatus = '' OR subscriptionStatus = 'unpaid')
        AND EXISTS (
          SELECT 1 FROM promo_codes p
          JOIN users u ON u.householdId = households.id
          WHERE (
            (u.email IS NOT NULL AND u.email != '' AND LOWER(u.email) = LOWER(p.claimedByUserEmail))
            OR (u.name IS NOT NULL AND u.name != '' AND LOWER(u.name) = LOWER(p.claimedByUserName))
            OR (p.assignedTo IS NOT NULL AND p.assignedTo != '' AND (
                  LOWER(u.name) = LOWER(p.assignedTo)
                  OR (u.email IS NOT NULL AND LOWER(u.email) = LOWER(p.assignedTo))
                  OR LOWER(households.name) = LOWER(p.assignedTo)
                  OR LOWER(households.name) LIKE '%' || LOWER(p.assignedTo) || '%'
               ))
          )
          AND UPPER(p.code) NOT IN (SELECT UPPER(code) FROM deleted_promo_codes)
        );
    `);
  } catch (err) {
    console.error('Error in healHouseholdSubscriptions:', err);
  }
}

export function generateSecureVoucherCode(prefix: string = 'HB'): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const pick = (len: number) => {
    let res = '';
    for (let i = 0; i < len; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
  };
  return `${prefix}-${pick(4)}-${pick(4)}`;
}

export const DEFAULT_AISLE_TEMPLATES = [
  { name: 'Produce', icon: '🥦' },
  { name: 'Bakery & Bread', icon: '🍞' },
  { name: 'Deli & Prepared', icon: '🥪' },
  { name: 'Meat & Seafood', icon: '🥩' },
  { name: 'Dairy & Eggs', icon: '🥛' },
  { name: 'Pantry & Dry Goods', icon: '🥫' },
  { name: 'Snacks & Sweets', icon: '🍿' },
  { name: 'Frozen', icon: '🧊' },
  { name: 'Beverages', icon: '🧃' },
  { name: 'Household & Cleaning', icon: '🧻' },
  { name: 'Personal Care & Pharmacy', icon: '🧴' },
  { name: 'Pet Care', icon: '🐾' },
  { name: 'Other', icon: '📦' },
];

export function createDefaultAisles(householdId: string, db?: Database) {
  const targetDb = db || dbInstance;
  if (!targetDb) return;
  DEFAULT_AISLE_TEMPLATES.forEach((a, idx) => {
    const id = `a_${householdId}_${idx + 1}`;
    targetDb.run(`INSERT OR IGNORE INTO aisles (id, name, icon, orderIndex, householdId, listId) VALUES (?, ?, ?, ?, ?, 'grocery')`, [id, a.name, a.icon, idx, householdId]);
  });
}

function seedDemoData(db: Database) {
  const now = new Date().toISOString();
  const householdId = 'fam_default_1';

  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let demoInviteCode = '';
  for (let i = 0; i < 6; i++) {
    demoInviteCode += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  db.run(`INSERT INTO households (id, name, inviteCode, createdAt, subscriptionStatus, subscriptionPlan) VALUES (?, ?, ?, ?, ?, ?)`, [householdId, 'My Family', demoInviteCode, now, 'active', 'lifetime_founder']);

  db.run(`INSERT INTO users (id, name, username, email, avatar, color, role, householdId, password) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, ['u1', 'Alex', 'alex', 'alex@famkit.app', '👨‍💻', '#10b981', 'Parent', householdId, 'password123']);
  db.run(`INSERT INTO users (id, name, username, email, avatar, color, role, householdId, password) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, ['u2', 'Sarah', 'sarah', 'sarah@famkit.app', '👩‍🏫', '#ec4899', 'Parent', householdId, 'password123']);
  db.run(`INSERT INTO users (id, name, username, email, avatar, color, role, householdId, password) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, ['u3', 'Leo', 'leo', 'leo@famkit.app', '👦', '#f59e0b', 'Kid', householdId, 'password123']);
  db.run(`INSERT INTO users (id, name, username, email, avatar, color, role, householdId, password) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, ['u4', 'Emma', 'emma', 'emma@famkit.app', '👧', '#06b6d4', 'Kid', householdId, 'password123']);

  createDefaultAisles(householdId, db);

  const sampleItems = [
    { id: 'g1', name: 'Organic Bananas', category: 'Produce', aisleId: 'a1', quantity: '1', unit: 'bunch', checked: 0 },
    { id: 'g2', name: 'Baby Spinach', category: 'Produce', aisleId: 'a1', quantity: '1', unit: 'tub', checked: 0 },
    { id: 'g3', name: 'Honeycrisp Apples', category: 'Produce', aisleId: 'a1', quantity: '4', unit: '', checked: 0 },
    { id: 'g4', name: 'Sourdough Bread', category: 'Bakery & Bread', aisleId: 'a2', quantity: '1', unit: 'loaf', checked: 0 },
    { id: 'g5', name: 'Brioche Buns', category: 'Bakery & Bread', aisleId: 'a2', quantity: '1', unit: 'pack', checked: 1 },
    { id: 'g6', name: 'Whole Milk', category: 'Dairy & Eggs', aisleId: 'a5', quantity: '1', unit: 'gallon', checked: 0 },
    { id: 'g7', name: 'Cage-Free Eggs', category: 'Dairy & Eggs', aisleId: 'a5', quantity: '1', unit: 'dozen', checked: 0 },
    { id: 'g8', name: 'Sharp Cheddar Cheese', category: 'Dairy & Eggs', aisleId: 'a5', quantity: '1', unit: 'block', checked: 0 },
    { id: 'g9', name: 'Chicken Breasts', category: 'Meat & Seafood', aisleId: 'a4', quantity: '2', unit: 'lbs', checked: 0 },
    { id: 'g10', name: 'Atlantic Salmon Fillets', category: 'Meat & Seafood', aisleId: 'a4', quantity: '2', unit: 'fillets', checked: 0 },
    { id: 'g11', name: 'Extra Virgin Olive Oil', category: 'Pantry & Dry Goods', aisleId: 'a6', quantity: '1', unit: 'bottle', checked: 0 },
    { id: 'g12', name: 'Penne Rigate Pasta', category: 'Pantry & Dry Goods', aisleId: 'a6', quantity: '2', unit: 'boxes', checked: 0 },
  ];

  for (const g of sampleItems) {
    db.run(`INSERT INTO grocery_items VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      g.id, g.name, g.category, g.aisleId, g.quantity, g.unit, '', g.checked, null, 'u1', householdId, now
    ]);
  }

  // Camping List
  db.run(`INSERT INTO custom_lists VALUES (?, ?, ?, ?, ?, ?, ?)`, ['list_camp', 'Camping Trip Packing List', 'packing', '⛺', '#f59e0b', householdId, now]);

  const packingItems = [
    { id: 'p1', name: '4-Person Tent & Stakes', quantity: '1', checked: 0 },
    { id: 'p2', name: 'Sleeping Bags & Foam Pads', quantity: '4', checked: 0 },
    { id: 'p3', name: 'Headlamps & Flashlights', quantity: '4', checked: 0 },
    { id: 'p4', name: 'Camp Stove & Fuel Canister', quantity: '1', checked: 0 },
    { id: 'p5', name: 'First Aid Kit & Bug Spray', quantity: '1', checked: 1 },
  ];

  for (const p of packingItems) {
    db.run(`INSERT INTO grocery_items VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      p.id, p.name, 'Packing', null, p.quantity, null, '', p.checked, 'list_camp', 'u1', householdId, now
    ]);
  }

  // Recipes
  const sampleRecipes = [
    {
      id: 'r1',
      title: 'Creamy Garlic Tuscan Chicken',
      description: 'Pan-seared chicken smothered in a garlic, sun-dried tomato, and spinach cream sauce.',
      imageUrl: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800&auto=format&fit=crop&q=80',
      prepTime: '15 min',
      cookTime: '25 min',
      servings: '4',
      tags: 'Dinner, Chicken, Quick, Comfort Food',
      ingredients: JSON.stringify([
        { item: '1.5 lbs boneless skinless chicken breasts', category: 'Meat & Seafood' },
        { item: '2 tbsp olive oil', category: 'Pantry & Dry Goods' },
        { item: '4 cloves garlic, minced', category: 'Produce' },
        { item: '1 cup heavy cream', category: 'Dairy & Eggs' },
        { item: '1/2 cup chicken broth', category: 'Pantry & Dry Goods' },
        { item: '1/2 cup grated parmesan cheese', category: 'Dairy & Eggs' },
        { item: '1 cup baby spinach', category: 'Produce' },
        { item: '1/2 cup sun-dried tomatoes in oil', category: 'Pantry & Dry Goods' },
      ]),
      instructions: JSON.stringify([
        'Season chicken breasts with salt, pepper, and Italian seasoning.',
        'Heat olive oil in a large skillet. Sear chicken 5-6 min per side until golden. Transfer to plate.',
        'In same skillet, sauté minced garlic for 1 min until fragrant.',
        'Add chicken broth, heavy cream, sun-dried tomatoes, and parmesan. Simmer 3 min.',
        'Add fresh baby spinach and stir until wilted. Return chicken and spoon sauce over top!',
      ]),
    },
    {
      id: 'r2',
      title: 'Sheet Pan Lemon Herb Salmon & Asparagus',
      description: 'Healthy, 20-minute weeknight dinner with tender asparagus, wild salmon, and dill butter.',
      imageUrl: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&auto=format&fit=crop&q=80',
      prepTime: '10 min',
      cookTime: '12 min',
      servings: '4',
      tags: 'Dinner, Seafood, Healthy, 20-Min',
      ingredients: JSON.stringify([
        { item: '4 wild salmon fillets (6 oz each)', category: 'Meat & Seafood' },
        { item: '1 lb fresh asparagus, trimmed', category: 'Produce' },
        { item: '2 tbsp melted butter or olive oil', category: 'Dairy & Eggs' },
        { item: '1 fresh lemon, sliced and juiced', category: 'Produce' },
        { item: '2 cloves garlic, minced', category: 'Produce' },
      ]),
      instructions: JSON.stringify([
        'Preheat oven to 400°F (200°C) and line baking sheet with parchment.',
        'Arrange salmon fillets and trimmed asparagus on sheet.',
        'Whisk melted butter, minced garlic, and lemon juice. Drizzle over salmon and asparagus.',
        'Bake 12-15 min until salmon flakes easily with a fork.',
      ]),
    }
  ];

  for (const r of sampleRecipes) {
    db.run(`INSERT INTO recipes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      r.id, r.title, r.description, r.imageUrl, r.prepTime, r.cookTime, r.servings, '', r.ingredients, r.instructions, r.tags, householdId, now
    ]);
  }

  // 7-Day Meal Plan
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];

    db.run(`INSERT INTO meal_plans VALUES (?, ?, ?, ?, ?, ?, ?)`, [`m_bk_${i}`, dateStr, 'breakfast', i === 0 || i === 6 ? 'Fluffy Blueberry Pancakes' : 'Greek Yogurt & Granola', '', null, householdId]);
    db.run(`INSERT INTO meal_plans VALUES (?, ?, ?, ?, ?, ?, ?)`, [`m_lu_${i}`, dateStr, 'lunch', 'Turkey Club Wrap & Fresh Fruit', '', null, householdId]);
    db.run(`INSERT INTO meal_plans VALUES (?, ?, ?, ?, ?, ?, ?)`, [`m_dn_${i}`, dateStr, 'dinner', i % 2 === 0 ? 'Creamy Garlic Tuscan Chicken' : 'Sheet Pan Lemon Herb Salmon', '', i % 2 === 0 ? 'r1' : 'r2', householdId]);
  }

  // Calendar Events
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const dayAfterStr = new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0];
  const fridayStr = new Date(Date.now() + 86400000 * 4).toISOString().split('T')[0];

  db.run(`INSERT INTO calendar_events (id, title, description, date, startTime, endTime, category, location, assignedMemberId, householdId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, ['ev1', 'Leo Soccer Practice', '', tomorrowStr, '16:30', '17:45', 'Sports', 'Community Park Field #2', 'u3', householdId, now, now]);
  db.run(`INSERT INTO calendar_events (id, title, description, date, startTime, endTime, category, location, assignedMemberId, householdId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, ['ev2', 'Emma Ballet Class', '', dayAfterStr, '15:30', '16:30', 'School', 'Downtown Dance Studio', 'u4', householdId, now, now]);
  db.run(`INSERT INTO calendar_events (id, title, description, date, startTime, endTime, category, location, assignedMemberId, householdId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, ['ev3', 'Family Pizza & Movie Night 🍕', '', fridayStr, '18:30', '21:00', 'Family', 'Living Room', 'u1', householdId, now, now]);
}

// Query helpers for JSON rows
export function queryAll<T = any>(sql: string, params: any[] = []): T[] {
  if (!dbInstance) return [];
  const safeParams = params.map((p) => (p === undefined ? null : p));
  try {
    const stmt = dbInstance.prepare(sql);
    stmt.bind(safeParams);
    const rows: T[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as T);
    }
    stmt.free();
    return rows;
  } catch (err) {
    console.error('Database query error:', err, 'SQL:', sql, 'Params:', safeParams);
    return [];
  }
}

export function queryOne<T = any>(sql: string, params: any[] = []): T | null {
  const all = queryAll<T>(sql, params);
  return all.length > 0 ? all[0] : null;
}

export function execute(sql: string, params: any[] = []) {
  if (!dbInstance) return;
  const safeParams = params.map((p) => (p === undefined ? null : p));
  try {
    dbInstance.run(sql, safeParams);
    saveDb();
  } catch (err) {
    console.error('Database execute error:', err, 'SQL:', sql, 'Params:', safeParams);
    throw err;
  }
}
