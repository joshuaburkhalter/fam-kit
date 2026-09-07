import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../famkit.db');

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
  fs.writeFileSync(dbPath, buffer);
}

function initSchema(db: Database) {
  db.run(`
    CREATE TABLE IF NOT EXISTS households (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      inviteCode TEXT UNIQUE NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      avatar TEXT NOT NULL DEFAULT '👤',
      color TEXT NOT NULL DEFAULT '#10b981',
      role TEXT NOT NULL DEFAULT 'Parent',
      householdId TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS aisles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT '🛒',
      orderIndex INTEGER NOT NULL DEFAULT 0,
      householdId TEXT NOT NULL
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

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id TEXT PRIMARY KEY,
      endpoint TEXT UNIQUE NOT NULL,
      keys TEXT NOT NULL,
      userId TEXT,
      householdId TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
  `);

  // Check if seeded
  const check = db.exec('SELECT COUNT(*) as count FROM households');
  const count = check[0]?.values[0]?.[0] as number || 0;

  if (count === 0) {
    seedDemoData(db);
  }

  saveDb();
}

function seedDemoData(db: Database) {
  const now = new Date().toISOString();
  const householdId = 'fam_default_1';

  db.run(`INSERT INTO households VALUES (?, ?, ?, ?)`, [householdId, 'The Burkhalter Family', 'FAMKIT', now]);

  db.run(`INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?)`, ['u1', 'Joshua', 'joshua@redpointaudio.com', '👨‍💻', '#10b981', 'Parent', householdId]);
  db.run(`INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?)`, ['u2', 'Sarah', 'sarah@famkit.app', '👩‍🏫', '#ec4899', 'Parent', householdId]);
  db.run(`INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?)`, ['u3', 'Leo', null, '👦', '#f59e0b', 'Kid', householdId]);
  db.run(`INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?)`, ['u4', 'Emma', null, '👧', '#06b6d4', 'Kid', householdId]);

  const defaultAisles = [
    { id: 'a1', name: 'Produce', icon: '🥦', orderIndex: 0 },
    { id: 'a2', name: 'Bakery & Bread', icon: '🍞', orderIndex: 1 },
    { id: 'a3', name: 'Deli & Prepared', icon: '🥪', orderIndex: 2 },
    { id: 'a4', name: 'Meat & Seafood', icon: '🥩', orderIndex: 3 },
    { id: 'a5', name: 'Dairy & Eggs', icon: '🥛', orderIndex: 4 },
    { id: 'a6', name: 'Pantry & Dry Goods', icon: '🥫', orderIndex: 5 },
    { id: 'a7', name: 'Snacks & Sweets', icon: '🍿', orderIndex: 6 },
    { id: 'a8', name: 'Frozen', icon: '🧊', orderIndex: 7 },
    { id: 'a9', name: 'Beverages', icon: '🧃', orderIndex: 8 },
    { id: 'a10', name: 'Household & Cleaning', icon: '🧻', orderIndex: 9 },
    { id: 'a11', name: 'Personal Care & Pharmacy', icon: '🧴', orderIndex: 10 },
    { id: 'a12', name: 'Pet Care', icon: '🐾', orderIndex: 11 },
    { id: 'a13', name: 'Other', icon: '📦', orderIndex: 12 },
  ];

  for (const a of defaultAisles) {
    db.run(`INSERT INTO aisles VALUES (?, ?, ?, ?, ?)`, [a.id, a.name, a.icon, a.orderIndex, householdId]);
  }

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

  db.run(`INSERT INTO calendar_events VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, ['ev1', 'Leo Soccer Practice', '', tomorrowStr, '16:30', '17:45', 'Sports', 'Community Park Field #2', 'u3', householdId, now]);
  db.run(`INSERT INTO calendar_events VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, ['ev2', 'Emma Ballet Class', '', dayAfterStr, '15:30', '16:30', 'School', 'Downtown Dance Studio', 'u4', householdId, now]);
  db.run(`INSERT INTO calendar_events VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, ['ev3', 'Family Pizza & Movie Night 🍕', '', fridayStr, '18:30', '21:00', 'Family', 'Living Room', 'u1', householdId, now]);
}

// Query helpers for JSON rows
export function queryAll<T = any>(sql: string, params: any[] = []): T[] {
  if (!dbInstance) return [];
  const stmt = dbInstance.prepare(sql);
  stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return rows;
}

export function queryOne<T = any>(sql: string, params: any[] = []): T | null {
  const all = queryAll<T>(sql, params);
  return all.length > 0 ? all[0] : null;
}

export function execute(sql: string, params: any[] = []) {
  if (!dbInstance) return;
  dbInstance.run(sql, params);
  saveDb();
}
