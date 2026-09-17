export interface Household {
  id: string;
  name: string;
  invite_code: string;
  inviteCode?: string;
  subscription_status?: 'active' | 'unpaid' | 'expired';
  subscriptionStatus?: 'active' | 'unpaid' | 'expired';
  subscription_plan?: string | null;
  subscriptionPlan?: string | null;
  subscription_expires_at?: string | null;
  subscriptionExpiresAt?: string | null;
  promo_code_used?: string | null;
  promoCodeUsed?: string | null;
  has_active_access?: boolean;
  hasActiveAccess?: boolean;
  created_at: string;
}

export interface SubscriptionStatus {
  householdId: string;
  householdName: string;
  subscriptionStatus: 'active' | 'unpaid' | 'expired';
  subscriptionPlan: string | null;
  subscriptionExpiresAt: string | null;
  promoCodeUsed: string | null;
  hasActiveAccess: boolean;
}

export interface PromoCode {
  code: string;
  description: string;
  durationMonths: number | null;
  maxUses: number;
  timesUsed: number;
  isActive: number | boolean;
  createdAt: string;
}

export interface User {
  id: string;
  household_id: string;
  name: string;
  username?: string;
  email?: string;
  avatar?: string;
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
  is_google_event?: boolean;
  google_event_id?: string;
  created_at: string;
}

export interface GoogleSyncStatus {
  userId: string;
  connected: boolean;
  googleEmail: string | null;
  selectedCalendarCount?: number;
  lastSyncedAt: string | null;
}

export interface GoogleCalendarEntry {
  id: string;
  summary: string;
  description?: string;
  primary?: boolean;
  backgroundColor?: string;
  foregroundColor?: string;
  selected: boolean;
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

export type NotificationCategory =
  | 'grocery_added'
  | 'grocery_completed'
  | 'calendar_events'
  | 'meal_plans'
  | 'recipes_added'
  | 'assistant_actions'
  | 'test';

export interface NotificationPreferences {
  userId: string;
  householdId: string;
  groceryAdded: boolean;
  groceryCompleted: boolean;
  calendarEvents: boolean;
  mealPlans: boolean;
  recipesAdded: boolean;
  assistantActions: boolean;
  notifyOwnActions: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  updatedAt?: string;
}

