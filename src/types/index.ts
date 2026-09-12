export interface Household {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
}

export interface User {
  id: string;
  household_id: string;
  name: string;
  email?: string;
  avatar_color: string;
  role: 'parent' | 'child' | 'member';
  created_at: string;
}

export interface Aisle {
  id: string;
  household_id: string;
  name: string;
  display_order: number;
  color: string;
}

export interface GroceryItem {
  id: string;
  household_id: string;
  aisle_id: string;
  name: string;
  quantity?: string;
  unit?: string;
  notes?: string;
  is_completed: boolean;
  added_by_user_id?: string;
  added_by_user_name?: string;
  list_type: string; // 'grocery' | custom list id
  created_at: string;
  updated_at: string;
}

export interface CustomList {
  id: string;
  household_id: string;
  title: string;
  icon: string;
  color: string;
  created_at: string;
}

export interface Recipe {
  id: string;
  household_id: string;
  title: string;
  description?: string;
  prep_time_minutes?: number;
  cook_time_minutes?: number;
  servings?: number;
  source_url?: string;
  image_url?: string;
  tags: string[];
  ingredients: {
    item: string;
    amount?: string;
    unit?: string;
    category?: string;
  }[];
  instructions: string[];
  created_at: string;
}

export interface MealPlan {
  id: string;
  household_id: string;
  date: string; // YYYY-MM-DD
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  title: string;
  recipe_id?: string;
  notes?: string;
  created_at: string;
}

export interface WeeklyMeal {
  id: string;
  household_id: string;
  title: string;
  recipe_id?: string;
  notes?: string;
  is_made: boolean;
  made_date?: string;
  week_start_date: string;
  created_at: string;
}

export interface MealLog {
  id: string;
  household_id: string;
  title: string;
  recipe_id?: string;
  date: string; // YYYY-MM-DD
  notes?: string;
  cooked_by_user_id?: string;
  created_at: string;
}

export interface CalendarEvent {
  id: string;
  household_id: string;
  title: string;
  description?: string;
  start_time: string; // ISO string
  end_time: string; // ISO string
  is_all_day: boolean;
  location?: string;
  assigned_user_id?: string;
  assigned_user_name?: string;
  created_at: string;
}

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  imageUrl?: string;
  actionsExecuted?: {
    tool: string;
    summary: string;
    data?: any;
  }[];
}
