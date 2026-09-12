import type {
  Household,
  User,
  Aisle,
  GroceryItem,
  CustomList,
  Recipe,
  MealPlan,
  WeeklyMeal,
  MealLog,
  CalendarEvent,
} from '../types';

const BASE_URL = '/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('famkit_auth_token') || '';
  const userId = localStorage.getItem('famkit_user_id') || '';
  const householdId = localStorage.getItem('famkit_household_id') || '';

  const authHeaders: Record<string, string> = {};
  if (token) authHeaders['Authorization'] = `Bearer ${token}`;
  if (userId) authHeaders['x-user-id'] = userId;
  if (householdId) authHeaders['x-household-id'] = householdId;

  const res = await fetch(`${BASE_URL}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errorBody.error || `HTTP error ${res.status}`);
  }

  return res.json();
}

const parsePositiveInt = (val: any): number | undefined => {
  if (!val) return undefined;
  const num = parseInt(String(val), 10);
  return !isNaN(num) && num > 0 ? num : undefined;
};

export const api = {
  // Authentication API
  login: async (email: string, password: string) => {
    return fetchJson<{ token: string; user: any; household: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  register: async (data: {
    name: string;
    email?: string;
    password?: string;
    avatarColor?: string;
    role?: string;
    action: 'create_household' | 'join_household';
    householdName?: string;
    inviteCode?: string;
  }) => {
    return fetchJson<{ token: string; user: any; household: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getMe: async () => {
    return fetchJson<{ user: any; household: any }>('/auth/me');
  },

  getDemoUsers: async () => {
    return fetchJson<
      Array<{
        id: string;
        name: string;
        email: string;
        avatar: string;
        color: string;
        role: string;
        householdId: string;
        householdName: string;
        inviteCode: string;
      }>
    >('/auth/demo-users');
  },

  // Households & Users (Family API)
  getHouseholds: async (): Promise<Household[]> => {
    try {
      const fam = await fetchJson<any>('/family');
      if (fam && fam.id) {
        return [
          {
            id: fam.id,
            name: fam.name,
            invite_code: fam.inviteCode,
            created_at: fam.createdAt || '',
          },
        ];
      }
      return [];
    } catch {
      return [];
    }
  },

  getHousehold: async (id: string): Promise<Household> => {
    const fam = await fetchJson<any>('/family');
    return {
      id: fam.id,
      name: fam.name,
      invite_code: fam.inviteCode,
      created_at: fam.createdAt || '',
    };
  },

  joinHouseholdByCode: async (inviteCode: string, userName: string) => {
    const res = await fetchJson<any>('/family', {
      method: 'POST',
      body: JSON.stringify({ action: 'join_with_code', inviteCode, name: userName }),
    });
    return {
      household: {
        id: res.household.id,
        name: res.household.name,
        invite_code: res.household.inviteCode,
        created_at: res.household.createdAt,
      },
      user: {
        id: res.household.members?.[0]?.id || 'u1',
        household_id: res.household.id,
        name: userName,
        avatar_color: '#10b981',
        role: 'member' as const,
        created_at: '',
      },
    };
  },

  getUsers: async (householdId: string): Promise<User[]> => {
    const fam = await fetchJson<any>('/family');
    if (fam && fam.members) {
      return fam.members.map((m: any) => ({
        id: m.id,
        household_id: m.householdId,
        name: m.name,
        avatar_color: m.color || '#10b981',
        role: (m.role?.toLowerCase() as any) || 'member',
        created_at: '',
      }));
    }
    return [];
  },

  createUser: async (householdId: string, name: string, avatarColor?: string, role?: string): Promise<User> => {
    const res = await fetchJson<any>('/family', {
      method: 'POST',
      body: JSON.stringify({ name, color: avatarColor, role }),
    });
    return {
      id: res.id,
      household_id: householdId,
      name: res.name,
      avatar_color: res.color,
      role: (res.role?.toLowerCase() as any) || 'member',
      created_at: '',
    };
  },

  deleteUser: async (memberId: string): Promise<{ success: boolean }> => {
    return fetchJson<{ success: boolean }>(`/family?memberId=${memberId}`, {
      method: 'DELETE',
    });
  },

  // Aisles
  getAisles: async (householdId: string): Promise<Aisle[]> => {
    const aisles = await fetchJson<any[]>('/grocery/aisles');
    return aisles.map((a: any) => ({
      id: a.id,
      household_id: a.householdId,
      name: a.name,
      display_order: a.orderIndex,
      color: a.color || '#10b981',
    }));
  },

  createAisle: async (householdId: string, name: string, color?: string): Promise<Aisle> => {
    const res = await fetchJson<any>('/grocery/aisles', {
      method: 'POST',
      body: JSON.stringify({ name, icon: '🛒', color }),
    });
    return {
      id: res.id,
      household_id: householdId,
      name: res.name,
      display_order: res.orderIndex,
      color: color || '#10b981',
    };
  },

  updateAisle: (id: string, name?: string, color?: string) =>
    fetchJson<Aisle>(`/grocery/aisles`, {
      method: 'PUT',
      body: JSON.stringify({ id, name, color }),
    }),

  reorderAisles: async (householdId: string, aisleIds: string[]) => {
    const aisleOrders = aisleIds.map((id, index) => ({ id, orderIndex: index }));
    return fetchJson<{ success: boolean }>('/grocery/aisles', {
      method: 'PUT',
      body: JSON.stringify({ aisleOrders }),
    });
  },

  deleteAisle: (id: string) =>
    fetchJson<{ success: boolean }>(`/grocery/aisles?id=${id}`, { method: 'DELETE' }),

  // Grocery Items & Custom Lists
  getGroceryData: async (
    householdId: string,
    listType: string = 'grocery'
  ): Promise<{ items: GroceryItem[]; lists: CustomList[]; aisles: Aisle[] }> => {
    const url = listType === 'grocery' ? '/grocery' : `/grocery?listId=${listType}`;
    const data = await fetchJson<{ items: any[]; lists?: any[]; aisles?: any[] }>(url);
    return {
      items: (data.items || []).map((i) => ({
        id: i.id,
        household_id: i.householdId,
        aisle_id: i.aisleId || '',
        name: i.name,
        quantity: i.quantity,
        unit: i.unit,
        notes: i.note,
        is_completed: Boolean(i.checked),
        added_by_user_id: i.addedById,
        list_type: i.listId || 'grocery',
        created_at: i.createdAt,
        updated_at: i.createdAt,
      })),
      lists: (data.lists || []).map((l) => ({
        id: l.id,
        household_id: l.householdId,
        title: l.name,
        icon: l.icon || '📋',
        color: l.color || '#10b981',
        created_at: l.createdAt,
      })),
      aisles: (data.aisles || []).map((a) => ({
        id: a.id,
        household_id: a.householdId,
        name: a.name,
        color: a.color || '#10b981',
        display_order: a.orderIndex || 0,
        icon: a.icon,
      })),
    };
  },

  getGroceryItems: async (householdId: string, listType: string = 'grocery'): Promise<GroceryItem[]> => {
    const url = listType === 'grocery' ? '/grocery' : `/grocery?listId=${listType}`;
    const data = await fetchJson<{ items: any[] }>(url);
    return data.items.map((i) => ({
      id: i.id,
      household_id: i.householdId,
      aisle_id: i.aisleId || '',
      name: i.name,
      quantity: i.quantity,
      unit: i.unit,
      notes: i.note,
      is_completed: Boolean(i.checked),
      added_by_user_id: i.addedById,
      list_type: i.listId || 'grocery',
      created_at: i.createdAt,
      updated_at: i.createdAt,
    }));
  },

  addGroceryItem: async (
    householdId: string,
    data: {
      name: string;
      aisle_id?: string;
      quantity?: string;
      unit?: string;
      notes?: string;
      list_type?: string;
      added_by_user_id?: string;
      added_by_user_name?: string;
    }
  ): Promise<GroceryItem> => {
    const res = await fetchJson<any>('/grocery', {
      method: 'POST',
      body: JSON.stringify({
        name: data.name,
        aisleId: data.aisle_id,
        quantity: data.quantity,
        unit: data.unit,
        note: data.notes,
        listId: data.list_type === 'grocery' ? null : data.list_type,
        addedById: data.added_by_user_id,
      }),
    });
    return {
      id: res.id,
      household_id: householdId,
      aisle_id: res.aisleId || '',
      name: res.name,
      quantity: res.quantity,
      unit: res.unit,
      notes: res.note,
      is_completed: Boolean(res.checked),
      added_by_user_id: res.addedById,
      list_type: res.listId || 'grocery',
      created_at: res.createdAt,
      updated_at: res.createdAt,
    };
  },

  toggleGroceryItem: async (id: string): Promise<any> => {
    return fetchJson('/grocery', {
      method: 'PATCH',
      body: JSON.stringify({ id, checked: true }), // Toggle handled on server/optimistic
    });
  },

  updateGroceryItem: (id: string, data: any) =>
    fetchJson('/grocery', {
      method: 'PATCH',
      body: JSON.stringify({ id, ...data }),
    }),

  deleteGroceryItem: (id: string) =>
    fetchJson<{ success: boolean }>(`/grocery?id=${id}`, { method: 'DELETE' }),

  clearCompletedGroceryItems: (householdId: string, listType: string = 'grocery') => {
    const url = listType === 'grocery' ? '/grocery?clearChecked=true' : `/grocery?clearChecked=true&listId=${listType}`;
    return fetchJson<{ success: boolean }>(url, { method: 'DELETE' });
  },

  // Custom Lists
  getCustomLists: async (householdId: string): Promise<CustomList[]> => {
    const data = await fetchJson<{ lists: any[] }>('/grocery');
    return (data.lists || []).map((l) => ({
      id: l.id,
      household_id: l.householdId,
      title: l.name,
      icon: l.icon || '📋',
      color: l.color || '#10b981',
      created_at: l.createdAt,
    }));
  },

  createCustomList: async (householdId: string, title: string, icon?: string, color?: string): Promise<CustomList> => {
    const res = await fetchJson<any>('/grocery', {
      method: 'POST',
      body: JSON.stringify({ createList: true, name: title, icon, color }),
    });
    return {
      id: res.id,
      household_id: householdId,
      title: res.name,
      icon: res.icon || '📋',
      color: color || '#10b981',
      created_at: new Date().toISOString(),
    };
  },

  deleteCustomList: (id: string) =>
    fetchJson<{ success: boolean }>(`/grocery?listId=${id}`, { method: 'DELETE' }),

  // Recipes
  getRecipes: async (householdId: string): Promise<Recipe[]> => {
    const list = await fetchJson<any[]>('/recipes');
    return list.map((r) => ({
      id: r.id,
      household_id: r.householdId,
      title: r.title,
      description: r.description,
      prep_time_minutes: parsePositiveInt(r.prepTime),
      cook_time_minutes: parsePositiveInt(r.cookTime),
      servings: parsePositiveInt(r.servings),
      source_url: r.sourceUrl,
      image_url: r.imageUrl,
      tags: typeof r.tags === 'string' ? r.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : (r.tags || []),
      ingredients: typeof r.ingredients === 'string' ? JSON.parse(r.ingredients) : (r.ingredients || []),
      instructions: typeof r.instructions === 'string' ? JSON.parse(r.instructions) : (r.instructions || []),
      created_at: r.createdAt,
    }));
  },

  getRecipe: async (id: string): Promise<Recipe> => {
    const recipes = await api.getRecipes('');
    const rec = recipes.find((r) => r.id === id);
    if (!rec) throw new Error('Recipe not found');
    return rec;
  },

  createRecipe: (householdId: string, data: Partial<Recipe>) =>
    fetchJson<Recipe>('/recipes', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteRecipe: (id: string) =>
    fetchJson<{ success: boolean }>(`/recipes?id=${id}`, { method: 'DELETE' }),

  importRecipeFromUrl: async (householdId: string, url: string, apiKey?: string): Promise<Recipe> => {
    const res = await fetchJson<{ success: boolean; recipe: any }>('/recipes/import', {
      method: 'POST',
      body: JSON.stringify({ url, apiKey }),
    });
    const r = res.recipe;
    return {
      id: r.id,
      household_id: r.householdId,
      title: r.title,
      description: r.description,
      prep_time_minutes: parsePositiveInt(r.prepTime),
      cook_time_minutes: parsePositiveInt(r.cookTime),
      servings: parsePositiveInt(r.servings),
      source_url: r.sourceUrl,
      image_url: r.imageUrl,
      tags: typeof r.tags === 'string' ? r.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : (r.tags || []),
      ingredients: typeof r.ingredients === 'string' ? JSON.parse(r.ingredients) : (r.ingredients || []),
      instructions: typeof r.instructions === 'string' ? JSON.parse(r.instructions) : (r.instructions || []),
      created_at: r.createdAt,
    };
  },

  importRecipeFromTextOrHtml: async (
    householdId: string,
    data: { html?: string; rawText?: string; sourceUrl?: string; apiKey?: string }
  ): Promise<Recipe> => {
    const res = await fetchJson<{ success: boolean; recipe: any }>('/recipes/import', {
      method: 'POST',
      body: JSON.stringify({
        html: data.html,
        rawText: data.rawText,
        url: data.sourceUrl,
        apiKey: data.apiKey,
      }),
    });
    const r = res.recipe;
    return {
      id: r.id,
      household_id: r.householdId,
      title: r.title,
      description: r.description,
      prep_time_minutes: parsePositiveInt(r.prepTime),
      cook_time_minutes: parsePositiveInt(r.cookTime),
      servings: parsePositiveInt(r.servings),
      source_url: r.sourceUrl,
      image_url: r.imageUrl,
      tags: typeof r.tags === 'string' ? r.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : (r.tags || []),
      ingredients: typeof r.ingredients === 'string' ? JSON.parse(r.ingredients) : (r.ingredients || []),
      instructions: typeof r.instructions === 'string' ? JSON.parse(r.instructions) : (r.instructions || []),
      created_at: r.createdAt,
    };
  },

  addRecipeToGrocery: async (recipeId: string, householdId: string) => {
    const recipe = await api.getRecipe(recipeId);
    let count = 0;
    for (const ing of recipe.ingredients) {
      await api.addGroceryItem(householdId, {
        name: ing.item,
        quantity: ing.amount,
        unit: ing.unit,
      });
      count++;
    }
    return { success: true, addedCount: count };
  },

  exportRecipeToGrocery: async (householdId: string, recipe: Recipe): Promise<{ addedCount: number }> => {
    let count = 0;
    if (recipe.ingredients && Array.isArray(recipe.ingredients)) {
      for (const ing of recipe.ingredients) {
        if (!ing.item?.trim()) continue;
        await api.addGroceryItem(householdId, {
          name: ing.item.trim(),
          quantity: ing.amount,
          unit: ing.unit,
          notes: `From recipe: ${recipe.title}`,
        });
        count++;
      }
    }
    return { addedCount: count };
  },

  // Meal Plans
  getMealPlans: async (householdId: string, startDate?: string, endDate?: string): Promise<MealPlan[]> => {
    const list = await fetchJson<any[]>('/meal-planner');
    return list.map((m) => ({
      id: m.id,
      household_id: m.householdId,
      date: m.date,
      meal_type: (m.mealType?.toLowerCase() as any) || 'dinner',
      title: m.title,
      recipe_id: m.recipeId,
      notes: m.notes,
      created_at: m.createdAt || '',
    }));
  },

  createMealPlan: async (
    householdId: string,
    data: {
      date: string;
      meal_type: string;
      title: string;
      recipe_id?: string;
      notes?: string;
    }
  ): Promise<MealPlan> => {
    const res = await fetchJson<any>('/meal-planner', {
      method: 'POST',
      body: JSON.stringify({
        date: data.date,
        mealType: data.meal_type,
        title: data.title,
        recipeId: data.recipe_id,
        notes: data.notes,
      }),
    });
    return {
      id: res.id,
      household_id: householdId,
      date: res.date,
      meal_type: (res.mealType?.toLowerCase() as any) || 'dinner',
      title: res.title,
      recipe_id: res.recipeId,
      notes: res.notes,
      created_at: res.createdAt || '',
    };
  },

  deleteMealPlan: (id: string) =>
    fetchJson<{ success: boolean }>(`/meal-planner?id=${id}`, { method: 'DELETE' }),

  // Weekly Meals & Cooking Log
  getWeeklyMeals: async (householdId: string, weekStartDate?: string): Promise<WeeklyMeal[]> => {
    const query = weekStartDate ? `?weekStartDate=${weekStartDate}` : '';
    const list = await fetchJson<any[]>(`/meals/week${query}`);
    return list.map((m) => ({
      id: m.id,
      household_id: m.householdId,
      title: m.title,
      recipe_id: m.recipeId,
      notes: m.notes,
      is_made: Boolean(m.isMade),
      made_date: m.madeDate,
      week_start_date: m.weekStartDate,
      created_at: m.createdAt || '',
    }));
  },

  addWeeklyMeal: async (
    householdId: string,
    data: {
      title: string;
      recipe_id?: string;
      notes?: string;
      week_start_date?: string;
    }
  ): Promise<WeeklyMeal> => {
    const res = await fetchJson<any>('/meals/week', {
      method: 'POST',
      body: JSON.stringify({
        title: data.title,
        recipeId: data.recipe_id,
        notes: data.notes,
        weekStartDate: data.week_start_date,
      }),
    });
    return {
      id: res.id,
      household_id: householdId,
      title: res.title,
      recipe_id: res.recipeId,
      notes: res.notes,
      is_made: Boolean(res.isMade),
      made_date: res.madeDate,
      week_start_date: res.weekStartDate,
      created_at: res.createdAt || '',
    };
  },

  updateWeeklyMeal: async (
    id: string,
    data: {
      is_made?: boolean;
      made_date?: string;
      title?: string;
      notes?: string;
    }
  ): Promise<WeeklyMeal> => {
    const res = await fetchJson<any>('/meals/week', {
      method: 'PATCH',
      body: JSON.stringify({
        id,
        isMade: data.is_made,
        madeDate: data.made_date,
        title: data.title,
        notes: data.notes,
      }),
    });
    return {
      id: res.id,
      household_id: res.householdId,
      title: res.title,
      recipe_id: res.recipeId,
      notes: res.notes,
      is_made: Boolean(res.isMade),
      made_date: res.madeDate,
      week_start_date: res.weekStartDate,
      created_at: res.createdAt || '',
    };
  },

  deleteWeeklyMeal: (id: string) =>
    fetchJson<{ success: boolean }>(`/meals/week?id=${id}`, { method: 'DELETE' }),

  getMealLogs: async (householdId: string): Promise<MealLog[]> => {
    const list = await fetchJson<any[]>('/meals/log');
    return list.map((m) => ({
      id: m.id,
      household_id: m.householdId,
      title: m.title,
      recipe_id: m.recipeId,
      date: m.date,
      notes: m.notes,
      cooked_by_user_id: m.cookedByUserId,
      created_at: m.createdAt || '',
    }));
  },

  logMealMade: async (
    householdId: string,
    data: {
      title: string;
      date?: string;
      recipe_id?: string;
      notes?: string;
      cooked_by_user_id?: string;
      weekly_meal_id?: string;
    }
  ): Promise<MealLog> => {
    const res = await fetchJson<any>('/meals/log', {
      method: 'POST',
      body: JSON.stringify({
        title: data.title,
        recipeId: data.recipe_id,
        date: data.date,
        notes: data.notes,
        cookedByUserId: data.cooked_by_user_id,
        weeklyMealId: data.weekly_meal_id,
      }),
    });
    return {
      id: res.id,
      household_id: householdId,
      title: res.title,
      recipe_id: res.recipeId,
      date: res.date,
      notes: res.notes,
      cooked_by_user_id: res.cookedByUserId,
      created_at: res.createdAt || '',
    };
  },

  deleteMealLog: (id: string) =>
    fetchJson<{ success: boolean }>(`/meals/log?id=${id}`, { method: 'DELETE' }),

  exportMealPlanToGrocery: async (householdId: string, startDate: string, endDate: string) => {
    const meals = await api.getMealPlans(householdId, startDate, endDate);
    let addedCount = 0;
    for (const m of meals) {
      if (m.recipe_id) {
        try {
          const rec = await api.getRecipe(m.recipe_id);
          for (const ing of rec.ingredients) {
            await api.addGroceryItem(householdId, {
              name: ing.item,
              quantity: ing.amount,
              unit: ing.unit,
            });
            addedCount++;
          }
        } catch {}
      }
    }
    return { success: true, itemsAdded: addedCount };
  },

  // Calendar
  getCalendarEvents: async (householdId: string, startDate?: string, endDate?: string): Promise<CalendarEvent[]> => {
    const list = await fetchJson<any[]>('/calendar');
    return list.map((ev) => ({
      id: ev.id,
      household_id: ev.householdId,
      title: ev.title,
      description: ev.description,
      start_time: ev.startTime ? `${ev.date}T${ev.startTime}:00` : `${ev.date}T09:00:00`,
      end_time: ev.endTime ? `${ev.date}T${ev.endTime}:00` : `${ev.date}T10:00:00`,
      is_all_day: !ev.startTime,
      location: ev.location,
      assigned_user_id: ev.assignedMemberId,
      created_at: ev.createdAt,
    }));
  },

  createCalendarEvent: async (
    householdId: string,
    data: {
      title: string;
      description?: string;
      start_time: string;
      end_time: string;
      is_all_day?: boolean;
      location?: string;
      assigned_user_id?: string;
    }
  ): Promise<CalendarEvent> => {
    const date = data.start_time.split('T')[0];
    const startTime = data.start_time.split('T')[1]?.substring(0, 5);
    const endTime = data.end_time.split('T')[1]?.substring(0, 5);

    const res = await fetchJson<any>('/calendar', {
      method: 'POST',
      body: JSON.stringify({
        title: data.title,
        description: data.description,
        date,
        startTime,
        endTime,
        location: data.location,
        assignedMemberId: data.assigned_user_id,
      }),
    });

    return {
      id: res.id,
      household_id: householdId,
      title: res.title,
      description: res.description,
      start_time: data.start_time,
      end_time: data.end_time,
      is_all_day: Boolean(data.is_all_day),
      location: res.location,
      assigned_user_id: res.assignedMemberId,
      created_at: res.createdAt,
    };
  },

  updateCalendarEvent: async (
    householdId: string,
    id: string,
    data: {
      title?: string;
      description?: string;
      start_time?: string;
      end_time?: string;
      is_all_day?: boolean;
      location?: string;
      assigned_user_id?: string;
    }
  ): Promise<CalendarEvent> => {
    const date = data.start_time ? data.start_time.split('T')[0] : undefined;
    const startTime = data.start_time ? data.start_time.split('T')[1]?.substring(0, 5) : undefined;
    const endTime = data.end_time ? data.end_time.split('T')[1]?.substring(0, 5) : undefined;

    const res = await fetchJson<any>('/calendar', {
      method: 'PATCH',
      body: JSON.stringify({
        id,
        title: data.title,
        description: data.description,
        date,
        startTime,
        endTime,
        location: data.location,
        assignedMemberId: data.assigned_user_id,
      }),
    });

    return {
      id: res.id,
      household_id: householdId,
      title: res.title,
      description: res.description,
      start_time: data.start_time || `${res.date}T${res.startTime || '09:00'}:00`,
      end_time: data.end_time || `${res.date}T${res.endTime || '10:00'}:00`,
      is_all_day: Boolean(data.is_all_day),
      location: res.location,
      assigned_user_id: res.assignedMemberId,
      created_at: res.createdAt,
    };
  },

  deleteCalendarEvent: (id: string) =>
    fetchJson<{ success: boolean }>(`/calendar?id=${id}`, { method: 'DELETE' }),

  // Gemini Assistant
  askGemini: async (data: {
    message: string;
    householdId: string;
    userId?: string;
    imageBase64?: string;
    imageMimeType?: string;
    apiKey?: string;
    history?: Array<{ role: string; content: string }>;
    clientDate?: string;
    clientDay?: string;
    clientTime?: string;
    timezone?: string;
  }) => {
    const res = await fetchJson<{ message: string; actions: any[] }>('/assistant', {
      method: 'POST',
      body: JSON.stringify({
        prompt: data.message,
        imageBase64: data.imageBase64,
        imageMimeType: data.imageMimeType,
        activeMemberId: data.userId,
        customApiKey: data.apiKey,
        history: data.history,
        clientDate: data.clientDate,
        clientDay: data.clientDay,
        clientTime: data.clientTime,
        timezone: data.timezone,
      }),
    });
    return {
      response: res.message,
      actionsExecuted: (res.actions || []).map((a) => ({
        tool: a.type,
        summary: a.summary,
        data: a.data,
      })),
    };
  },

  getAssistantStatus: () => fetchJson<{ configured: boolean; model: string }>('/assistant/status'),

  testGeminiKey: (apiKey?: string) =>
    fetchJson<{ success: boolean; message: string }>('/assistant/test', {
      method: 'POST',
      body: JSON.stringify({ apiKey }),
    }),

  // Push Notifications
  getVapidPublicKey: () => fetchJson<{ publicKey: string }>('/push'),
  subscribePush: (data: {
    householdId: string;
    userId?: string;
    subscription: PushSubscriptionJSON;
  }) =>
    fetchJson<{ success: boolean }>('/push', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  sendTestPush: (householdId: string, title?: string, body?: string) =>
    fetchJson<{ success: boolean }>('/push', {
      method: 'POST',
      body: JSON.stringify({ action: 'test_notification', title, message: body }),
    }),
};
