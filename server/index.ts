import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { getDb, queryAll, queryOne, execute, saveDb } from './db.js';
import { getGeminiModel } from './gemini.js';
import { parseRecipeFromUrl } from './recipe-parser.js';
import { sendPushNotificationToHousehold, vapidPublicKey } from './push.js';

dotenv.config();
dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '15mb' }));

// Helper: Get active household ID
function getHouseholdId(req: express.Request): string {
  const header = req.headers['x-household-id'] as string;
  if (header) return header;
  const row = queryOne<{ id: string }>('SELECT id FROM households LIMIT 1');
  return row?.id || 'fam_default_1';
}

// ---------------- API ROUTES ----------------

// 1. Assistant Route (Gemini Multimodal + Tool Calling)
app.post('/api/assistant', async (req, res) => {
  try {
    const householdId = getHouseholdId(req);
    const { prompt, imageBase64, imageMimeType, customApiKey, activeMemberId } = req.body;

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

    const memberNames = members.map((m) => `${m.name} (${m.role})`).join(', ');
    const aisleNames = aisles.map((a) => a.name).join(', ');
    const currentDate = new Date().toISOString().split('T')[0];
    const currentDayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });

    const contextAddition = `\nContext Information:
- Current Date: ${currentDate} (${currentDayName})
- Family Members in Household: ${memberNames || 'Joshua (Parent)'}
- Household Grocery Aisles (in order): ${aisleNames}
- Household ID: ${householdId}`;

    const model = getGeminiModel(customApiKey);

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

    const result = await model.generateContent(parts);
    const response = result.response;
    const functionCalls = response.functionCalls();

    const actionsExecuted: any[] = [];
    let assistantMessage = response.text() || '';

    if (functionCalls && functionCalls.length > 0) {
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
            const matchedAisle = aisles.find(
              (a) =>
                a.name.toLowerCase().includes((item.category || '').toLowerCase()) ||
                (item.category || '').toLowerCase().includes(a.name.toLowerCase())
            ) || aisles.find((a) => a.name === 'Other') || aisles[0];

            const id = `g_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const now = new Date().toISOString();

            execute(
              `INSERT INTO grocery_items (id, name, category, aisleId, quantity, note, checked, householdId, addedById, createdAt)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [id, item.name, item.category || matchedAisle?.name || 'Other', matchedAisle?.id, item.quantity || '1', item.note || null, 0, householdId, activeMemberId || 'u1', now]
            );

            createdItems.push({ id, name: item.name, category: item.category || matchedAisle?.name });
          }

          actionsExecuted.push({
            type: 'grocery_added',
            summary: `Added ${createdItems.length} item(s) to grocery list`,
            data: createdItems,
          });

          sendPushNotificationToHousehold(householdId, {
            title: '🛒 Grocery List Updated',
            body: `Added: ${createdItems.map((i) => i.name).join(', ')}`,
            url: '/grocery',
          });
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

            createdEvents.push({ id, title: ev.title, date: ev.date });
          }

          actionsExecuted.push({
            type: 'calendar_event_added',
            summary: `Scheduled ${createdEvents.length} event(s) on family calendar`,
            data: createdEvents,
          });

          sendPushNotificationToHousehold(householdId, {
            title: '📅 New Calendar Event',
            body: createdEvents.map((e) => `${e.title} (${e.date})`).join(', '),
            url: '/calendar',
          });
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
            summary: `Scheduled ${createdMeals.length} meal(s) for the week`,
            data: createdMeals,
          });
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
      }
    }

    if (!assistantMessage && actionsExecuted.length > 0) {
      assistantMessage = `Done! I've ${actionsExecuted.map((a) => a.summary.toLowerCase()).join(' and ')}.`;
    }

    res.json({ message: assistantMessage, actions: actionsExecuted });
  } catch (err: any) {
    console.error('Assistant error:', err);
    res.status(500).json({ error: err.message, message: `I encountered an issue: ${err.message}` });
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

  res.json({
    items: items.map((i: any) => ({ ...i, checked: Boolean(i.checked) })),
    lists,
    aisles,
  });
});

app.post('/api/grocery', (req, res) => {
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

  execute(
    `INSERT INTO grocery_items (id, name, category, aisleId, quantity, unit, note, checked, listId, addedById, householdId, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, name, category || 'Other', aisleId || null, quantity || '1', unit || null, note || null, 0, listId || null, addedById || 'u1', householdId, now]
  );

  res.json({
    id,
    name,
    category: category || 'Other',
    aisleId,
    quantity: quantity || '1',
    unit,
    note,
    checked: false,
    listId,
    householdId,
    createdAt: now,
  });
});

app.patch('/api/grocery', (req, res) => {
  const { id, checked, name, quantity, unit, note, aisleId, category } = req.body;
  if (!id) return res.status(400).json({ error: 'ID is required' });

  if (checked !== undefined) {
    execute('UPDATE grocery_items SET checked = ? WHERE id = ?', [checked ? 1 : 0, id]);
  }
  if (name !== undefined) execute('UPDATE grocery_items SET name = ? WHERE id = ?', [name, id]);
  if (quantity !== undefined) execute('UPDATE grocery_items SET quantity = ? WHERE id = ?', [quantity, id]);
  if (aisleId !== undefined) execute('UPDATE grocery_items SET aisleId = ? WHERE id = ?', [aisleId, id]);

  const updated = queryOne('SELECT * FROM grocery_items WHERE id = ?', [id]);
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
  res.json({ success: true });
});

// 4. Recipes API
app.get('/api/recipes', (req, res) => {
  const householdId = getHouseholdId(req);
  const recipes = queryAll('SELECT * FROM recipes WHERE householdId = ? ORDER BY createdAt DESC', [householdId]);
  res.json(recipes);
});

app.post('/api/recipes/import', async (req, res) => {
  try {
    const householdId = getHouseholdId(req);
    const { url, apiKey } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    let targetUrl = url.trim();
    if (!targetUrl.startsWith('http')) targetUrl = `https://${targetUrl}`;

    const parsed = await parseRecipeFromUrl(targetUrl, apiKey);
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
        parsed.sourceUrl || targetUrl,
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

app.delete('/api/recipes', (req, res) => {
  const id = req.query.id as string;
  if (id) execute('DELETE FROM recipes WHERE id = ?', [id]);
  res.json({ success: true });
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
      const cat = typeof ing === 'object' && ing.category ? ing.category : 'Produce';
      if (!name) continue;

      const matchedAisle = aisles.find((a) => a.name.toLowerCase().includes(cat.toLowerCase())) || aisles[0];
      const gId = `g_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      execute(
        `INSERT INTO grocery_items (id, name, category, aisleId, quantity, checked, householdId, addedById, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [gId, name, matchedAisle?.name || 'Produce', matchedAisle?.id, '1', 0, householdId, addedById || 'u1', now]
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

  const saved = queryOne('SELECT * FROM meal_plans WHERE id = ?', [id]);
  res.json(saved);
});

app.delete('/api/meal-planner', (req, res) => {
  const id = req.query.id as string;
  if (id) execute('DELETE FROM meal_plans WHERE id = ?', [id]);
  res.json({ success: true });
});

// 6. Calendar API
app.get('/api/calendar', (req, res) => {
  const householdId = getHouseholdId(req);
  const memberId = req.query.memberId as string;

  const events = memberId && memberId !== 'all'
    ? queryAll('SELECT * FROM calendar_events WHERE householdId = ? AND assignedMemberId = ? ORDER BY date ASC, startTime ASC', [householdId, memberId])
    : queryAll('SELECT * FROM calendar_events WHERE householdId = ? ORDER BY date ASC, startTime ASC', [householdId]);

  res.json(events);
});

app.post('/api/calendar', (req, res) => {
  const householdId = getHouseholdId(req);
  const { title, description, date, startTime, endTime, category, location, assignedMemberId } = req.body;
  if (!title || !date) return res.status(400).json({ error: 'Title and Date are required' });

  const id = `ev_${Date.now()}`;
  const now = new Date().toISOString();

  execute(
    `INSERT INTO calendar_events (id, title, description, date, startTime, endTime, category, location, assignedMemberId, householdId, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, title, description || null, date, startTime || null, endTime || null, category || 'Family', location || null, assignedMemberId || null, householdId, now]
  );

  sendPushNotificationToHousehold(householdId, {
    title: `📅 Event: ${title}`,
    body: `Scheduled for ${date}${startTime ? ` at ${startTime}` : ''}`,
    url: '/calendar',
  });

  const created = queryOne('SELECT * FROM calendar_events WHERE id = ?', [id]);
  res.json(created);
});

app.delete('/api/calendar', (req, res) => {
  const id = req.query.id as string;
  if (id) execute('DELETE FROM calendar_events WHERE id = ?', [id]);
  res.json({ success: true });
});

// 7. Family API
app.get('/api/family', (req, res) => {
  const householdId = getHouseholdId(req);
  const household = queryOne('SELECT * FROM households WHERE id = ?', [householdId]);
  const members = queryAll('SELECT * FROM users WHERE householdId = ?', [householdId]);
  res.json({ ...household, members });
});

app.post('/api/family', (req, res) => {
  const householdId = getHouseholdId(req);
  const { action, inviteCode, name, avatar, color, role } = req.body;

  if (action === 'join_with_code' && inviteCode) {
    const found = queryOne<{ id: string }>('SELECT id FROM households WHERE inviteCode = ?', [inviteCode.trim().toUpperCase()]);
    if (!found) return res.status(404).json({ error: 'Invalid invite code' });

    if (name) {
      const uId = `u_${Date.now()}`;
      execute(
        'INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?)',
        [uId, name, null, avatar || '👤', color || '#10b981', role || 'Member', found.id]
      );
    }
    const h = queryOne('SELECT * FROM households WHERE id = ?', [found.id]);
    const m = queryAll('SELECT * FROM users WHERE householdId = ?', [found.id]);
    return res.json({ household: { ...h, members: m } });
  }

  if (name) {
    const uId = `u_${Date.now()}`;
    execute(
      'INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?)',
      [uId, name, null, avatar || '👤', color || '#10b981', role || 'Member', householdId]
    );
    return res.json({ id: uId, name, avatar: avatar || '👤', role: role || 'Member', color: color || '#10b981' });
  }

  res.status(400).json({ error: 'Invalid request' });
});

app.delete('/api/family', (req, res) => {
  const memberId = req.query.memberId as string;
  if (memberId) execute('DELETE FROM users WHERE id = ?', [memberId]);
  res.json({ success: true });
});

// 8. Push API
app.get('/api/push', (req, res) => {
  res.json({ publicKey: vapidPublicKey });
});

app.post('/api/push', async (req, res) => {
  const householdId = getHouseholdId(req);
  const { action, subscription, userId, title, message } = req.body;

  if (action === 'test_notification') {
    await sendPushNotificationToHousehold(householdId, {
      title: title || '✨ fam-kit Notification',
      body: message || 'Push notifications are live on your device!',
      url: '/',
    });
    return res.json({ success: true });
  }

  if (subscription && subscription.endpoint) {
    const id = `sub_${Date.now()}`;
    const now = new Date().toISOString();
    execute(
      `INSERT OR REPLACE INTO push_subscriptions (id, endpoint, keys, userId, householdId, createdAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, subscription.endpoint, JSON.stringify(subscription.keys), userId || null, householdId, now]
    );
    return res.json({ success: true });
  }

  res.status(400).json({ error: 'Invalid payload' });
});

// Serve static frontend build in production
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(distPath, 'index.html'));
  }
});

// Initialize database & start server
getDb().then(() => {
  app.listen(PORT, () => {
    console.log(`⚡ fam-kit server running on http://localhost:${PORT}`);
  });
});
