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

export interface PromoRedemption {
  id: string;
  promoCode: string;
  householdId?: string | null;
  householdName?: string | null;
  userId?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  redeemedAt: string;
}

export interface PromoCode {
  code: string;
  description: string;
  durationMonths: number | null;
  maxUses: number;
  timesUsed: number;
  isActive: number | boolean;
  assignedTo?: string | null;
  claimedByUserName?: string | null;
  claimedByUserEmail?: string | null;
  claimedByHouseholdName?: string | null;
  claimedAt?: string | null;
  redeemedBy?: string | null;
  redemptions?: PromoRedemption[];
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
  role: 'parent' | 'child' | 'member' | 'admin';
  created_at: string;
}

export interface Aisle {
  id: string;
  household_id: string;
  name: string;
  display_order: number;
  color: string;
  icon?: string;
  list_id?: string;
}

export interface GroceryItem {
  id: string;
  household_id: string;
  aisle_id: string;
  category?: string;
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

export interface GrocerySuggestion {
  name: string;
  aisleId: string;
  category: string;
  quantity?: string;
  unit?: string;
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
  scheduled_date?: string;
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
  assignedMemberId?: string | null;
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

export interface FeedbackRequest {
  id: string;
  type: 'bug' | 'feature';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'planned' | 'resolved' | 'closed';
  submitted_by_user_id?: string;
  submittedByUserId?: string;
  submitted_by_user_name: string;
  submittedByUserName?: string;
  submitted_by_user_email?: string;
  submittedByUserEmail?: string;
  household_id?: string;
  householdId?: string;
  household_name?: string;
  householdName?: string;
  admin_response?: string;
  adminResponse?: string;
  admin_responded_at?: string;
  adminRespondedAt?: string;
  admin_responded_by?: string;
  adminRespondedBy?: string;
  upvotes?: number;
  upvoters?: string[];
  has_upvoted?: boolean;
  hasUpvoted?: boolean;
  created_at: string;
  createdAt?: string;
  updated_at: string;
  updatedAt?: string;
}

export const isUserAdmin = (user?: { role?: string; username?: string; email?: string } | null): boolean => {
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
};

export interface AdminOverviewStats {
  totalUsers: number;
  totalHouseholds: number;
  activeHouseholds: number;
  totalRecipes: number;
  aiRecipes: number;
  totalGroceryItems: number;
  checkedGroceryItems: number;
  totalMealPlans: number;
  totalCalendarEvents: number;
  totalFeedbackRequests: number;
  openFeedbackRequests: number;
  totalPromoCodes: number;
  claimedPromoCodes: number;
}

export interface AdminOverviewData {
  stats: AdminOverviewStats;
  recentUsers: AdminUser[];
  recentRedemptions: any[];
  recentFeedback: any[];
  recentRecipes: any[];
}

export interface AdminUser {
  id: string;
  name: string;
  username?: string;
  email?: string;
  avatar?: string;
  color?: string;
  role: string;
  householdId: string;
  householdName?: string;
  householdInviteCode?: string;
  subscriptionStatus?: string;
  subscriptionPlan?: string;
  subscriptionExpiresAt?: string;
  createdAt?: string;
  householdRecipeCount?: number;
  householdGroceryCount?: number;
  householdEventCount?: number;
}

export interface AdminHousehold {
  id: string;
  name: string;
  inviteCode: string;
  createdAt: string;
  subscriptionStatus: string;
  subscriptionPlan?: string;
  subscriptionExpiresAt?: string;
  promoCodeUsed?: string;
  memberCount: number;
  memberNames?: string;
  recipeCount: number;
  groceryCount: number;
  eventCount: number;
}

export type PantryLocation = 'fridge' | 'freezer' | 'pantry';
export type FreshnessStatus = 'fresh' | 'expiring_soon' | 'expired';

export interface InventoryItem {
  id: string;
  householdId: string;
  name: string;
  barcode?: string | null;
  category: string;
  location: PantryLocation;
  quantity?: string | null;
  unit?: string | null;
  imageUrl?: string | null;
  isStock: boolean;
  restockCadenceDays?: number | null;
  lastRestockedAt?: string | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  daysUntilExpiry?: number;
  freshness: FreshnessStatus;
  isDuplicate?: boolean;
}

export interface IngredientInventoryMatch {
  matched: Array<{
    ingredient: string;
    inStockItem: InventoryItem;
    isFresh: boolean;
  }>;
  missing: Array<{
    item: string;
    amount?: string;
    unit?: string;
  }>;
}

