export interface Aisle {
  id: string;
  name: string;
  icon: string;
  orderIndex: number;
  isDefault: boolean;
  itemCount?: number;
}

export interface GroceryItemData {
  id: string;
  name: string;
  category: string;
  aisleId?: string | null;
  aisle?: Aisle | null;
  quantity?: string | null;
  unit?: string | null;
  note?: string | null;
  checked: boolean;
  householdId: string;
  listId?: string | null;
  addedById?: string | null;
  addedBy?: FamilyMember | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomListData {
  id: string;
  name: string;
  type: string; // grocery, packing, todo, checklist
  icon: string;
  color: string;
  householdId: string;
  items?: GroceryItemData[];
  itemCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface FamilyMember {
  id: string;
  name: string;
  email?: string | null;
  avatar: string;
  color: string;
  role: string;
  householdId: string;
}

export interface HouseholdData {
  id: string;
  name: string;
  inviteCode: string;
  members: FamilyMember[];
}

export interface RecipeIngredient {
  item: string;
  amount?: string;
  unit?: string;
  category?: string;
}

export interface RecipeData {
  id: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  prepTime?: string | null;
  cookTime?: string | null;
  servings?: string | null;
  sourceUrl?: string | null;
  ingredients: string; // JSON parsed into RecipeIngredient[]
  instructions: string; // JSON parsed into string[]
  tags?: string | null;
  householdId: string;
  createdAt: string;
  updatedAt: string;
}

export interface MealPlanData {
  id: string;
  date: string; // YYYY-MM-DD
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  title: string;
  notes?: string | null;
  recipeId?: string | null;
  recipe?: RecipeData | null;
  householdId: string;
}

export interface CalendarEventData {
  id: string;
  title: string;
  description?: string | null;
  date: string; // YYYY-MM-DD
  startTime?: string | null; // HH:mm
  endTime?: string | null;
  allDay: boolean;
  category: 'Family' | 'School' | 'Sports' | 'Work' | 'Appointment' | 'Celebration';
  color?: string | null;
  location?: string | null;
  assignedMemberId?: string | null;
  assignedMember?: FamilyMember | null;
  householdId: string;
}

export interface AssistantAction {
  type: 'grocery_added' | 'calendar_event_added' | 'meal_planned' | 'list_created' | 'recipe_imported' | 'info';
  summary: string;
  data?: any;
}
