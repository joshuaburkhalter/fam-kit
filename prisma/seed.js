const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DEFAULT_AISLES = [
  { name: 'Produce', icon: '🥦', orderIndex: 0 },
  { name: 'Bakery & Bread', icon: '🍞', orderIndex: 1 },
  { name: 'Deli & Prepared', icon: '🥪', orderIndex: 2 },
  { name: 'Meat & Seafood', icon: '🥩', orderIndex: 3 },
  { name: 'Dairy & Eggs', icon: '🧀', orderIndex: 4 },
  { name: 'Pantry & Dry Goods', icon: '🥫', orderIndex: 5 },
  { name: 'Snacks & Sweets', icon: '🍿', orderIndex: 6 },
  { name: 'Frozen', icon: '🧊', orderIndex: 7 },
  { name: 'Beverages', icon: '🧃', orderIndex: 8 },
  { name: 'Household & Cleaning', icon: '🧻', orderIndex: 9 },
  { name: 'Personal Care & Pharmacy', icon: '🧴', orderIndex: 10 },
  { name: 'Pet Care', icon: '🐾', orderIndex: 11 },
  { name: 'Other', icon: '📦', orderIndex: 12 },
];

async function main() {
  console.log('Seeding initial data...');

  // 1. Create or find default Household
  let household = await prisma.household.findFirst({
    where: { inviteCode: 'FAMKIT' },
  });

  if (!household) {
    household = await prisma.household.create({
      data: {
        name: 'The Burkhalter Family',
        inviteCode: 'FAMKIT',
      },
    });
  }

  // 2. Create Family Members
  const members = [
    { name: 'Joshua', avatar: '👨‍💻', color: '#6366f1', role: 'Parent', email: 'joshua@redpointaudio.com' },
    { name: 'Sarah', avatar: '👩‍🏫', color: '#ec4899', role: 'Parent', email: 'sarah@famkit.local' },
    { name: 'Leo', avatar: '👦', color: '#f59e0b', role: 'Kid', email: null },
    { name: 'Emma', avatar: '👧', color: '#10b981', role: 'Kid', email: null },
  ];

  const createdMembers = [];
  for (const m of members) {
    let user = await prisma.user.findFirst({
      where: { householdId: household.id, name: m.name },
    });
    if (!user) {
      user = await prisma.user.create({
        data: {
          ...m,
          householdId: household.id,
        },
      });
    }
    createdMembers.push(user);
  }

  // 3. Create Default Aisles
  const createdAisles = {};
  for (const a of DEFAULT_AISLES) {
    const existing = await prisma.aisleCategory.findUnique({
      where: {
        householdId_name: {
          householdId: household.id,
          name: a.name,
        },
      },
    });

    if (!existing) {
      const created = await prisma.aisleCategory.create({
        data: {
          name: a.name,
          icon: a.icon,
          orderIndex: a.orderIndex,
          isDefault: true,
          householdId: household.id,
        },
      });
      createdAisles[a.name] = created;
    } else {
      createdAisles[a.name] = existing;
    }
  }

  // 4. Sample Grocery Items
  const sampleItems = [
    { name: 'Organic Bananas', category: 'Produce', quantity: '1', unit: 'bunch', checked: false },
    { name: 'Baby Spinach', category: 'Produce', quantity: '1', unit: 'tub', checked: false },
    { name: 'Honeycrisp Apples', category: 'Produce', quantity: '4', unit: '', checked: false },
    { name: 'Sourdough Bread', category: 'Bakery & Bread', quantity: '1', unit: 'loaf', checked: false },
    { name: 'Brioche Buns', category: 'Bakery & Bread', quantity: '1', unit: 'pack', checked: true },
    { name: 'Whole Milk', category: 'Dairy & Eggs', quantity: '1', unit: 'gallon', checked: false },
    { name: 'Sharp Cheddar Cheese', category: 'Dairy & Eggs', quantity: '1', unit: 'block', checked: false },
    { name: 'Cage-Free Eggs', category: 'Dairy & Eggs', quantity: '1', unit: 'dozen', checked: false },
    { name: 'Chicken Breasts', category: 'Meat & Seafood', quantity: '2', unit: 'lbs', checked: false },
    { name: 'Atlantic Salmon Fillets', category: 'Meat & Seafood', quantity: '2', unit: 'fillets', checked: false },
    { name: 'Olive Oil (Extra Virgin)', category: 'Pantry & Dry Goods', quantity: '1', unit: 'bottle', checked: false },
    { name: 'Penne Rigate Pasta', category: 'Pantry & Dry Goods', quantity: '2', unit: 'boxes', checked: false },
    { name: 'Marinara Sauce', category: 'Pantry & Dry Goods', quantity: '1', unit: 'jar', checked: false },
    { name: 'Sparkling Water', category: 'Beverages', quantity: '1', unit: '12-pack', checked: false },
    { name: 'Paper Towels', category: 'Household & Cleaning', quantity: '1', unit: 'pack', checked: false },
  ];

  for (const item of sampleItems) {
    const aisle = createdAisles[item.category] || createdAisles['Other'];
    const existing = await prisma.groceryItem.findFirst({
      where: { householdId: household.id, name: item.name },
    });

    if (!existing) {
      await prisma.groceryItem.create({
        data: {
          name: item.name,
          category: item.category,
          aisleId: aisle?.id,
          quantity: item.quantity,
          unit: item.unit,
          checked: item.checked,
          householdId: household.id,
          addedById: createdMembers[0].id,
        },
      });
    }
  }

  // 5. Create a Custom List (e.g. Weekend Camping Trip)
  let customList = await prisma.customList.findFirst({
    where: { householdId: household.id, name: 'Camping Trip Packing List' },
  });

  if (!customList) {
    customList = await prisma.customList.create({
      data: {
        name: 'Camping Trip Packing List',
        type: 'packing',
        icon: '⛺',
        color: '#f59e0b',
        householdId: household.id,
      },
    });

    const packingItems = [
      { name: '4-Person Tent & Stakes', quantity: '1', checked: false },
      { name: 'Sleeping Bags & Pads', quantity: '4', checked: false },
      { name: 'Headlamps & Extra Batteries', quantity: '4', checked: false },
      { name: 'Camp Stove & Fuel Canisters', quantity: '1', checked: false },
      { name: 'First Aid Kit & Bug Spray', quantity: '1', checked: true },
      { name: 'Marshmallow Roasting Sticks', quantity: '4', checked: true },
    ];

    for (const p of packingItems) {
      await prisma.groceryItem.create({
        data: {
          name: p.name,
          category: 'Packing',
          quantity: p.quantity,
          checked: p.checked,
          householdId: household.id,
          listId: customList.id,
          addedById: createdMembers[0].id,
        },
      });
    }
  }

  // 6. Sample Recipes
  const sampleRecipes = [
    {
      title: 'Creamy Garlic Tuscan Chicken',
      description: 'Pan-seared chicken breasts smothered in a rich garlic, sun-dried tomato, and spinach cream sauce.',
      imageUrl: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800&auto=format&fit=crop&q=80',
      prepTime: '15 min',
      cookTime: '25 min',
      servings: '4',
      sourceUrl: 'https://famkit.app/recipes/tuscan-chicken',
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
        'Season chicken breasts with salt, pepper, and Italian seasoning on both sides.',
        'Heat olive oil in a large skillet over medium-high heat. Sear chicken for 5-6 minutes per side until golden and cooked through. Transfer to a plate.',
        'In the same skillet, add minced garlic and sauté for 1 minute until fragrant.',
        'Pour in chicken broth, heavy cream, sun-dried tomatoes, and parmesan cheese. Simmer for 3 minutes until slightly thickened.',
        'Add fresh baby spinach and stir until wilted.',
        'Return chicken breasts to the skillet and spoon the creamy sauce over top. Serve hot with pasta or crusty bread!',
      ]),
    },
    {
      title: 'Sheet Pan Lemon Herb Salmon & Asparagus',
      description: 'An effortless 20-minute healthy dinner with wild salmon, tender asparagus, fresh lemon, and dill butter.',
      imageUrl: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&auto=format&fit=crop&q=80',
      prepTime: '10 min',
      cookTime: '12 min',
      servings: '4',
      sourceUrl: 'https://famkit.app/recipes/salmon-asparagus',
      tags: 'Dinner, Seafood, Healthy, 30-Min',
      ingredients: JSON.stringify([
        { item: '4 salmon fillets (6 oz each)', category: 'Meat & Seafood' },
        { item: '1 lb fresh asparagus, trimmed', category: 'Produce' },
        { item: '2 tbsp melted butter or olive oil', category: 'Dairy & Eggs' },
        { item: '1 lemon, sliced and juiced', category: 'Produce' },
        { item: '2 cloves garlic, minced', category: 'Produce' },
        { item: '1 tbsp fresh dill, chopped', category: 'Produce' },
      ]),
      instructions: JSON.stringify([
        'Preheat oven to 400°F (200°C) and line a large baking sheet with parchment paper.',
        'Arrange salmon fillets and trimmed asparagus on the sheet pan.',
        'Whisk together melted butter, minced garlic, lemon juice, salt, and pepper. Drizzle evenly over salmon and asparagus.',
        'Top salmon with fresh lemon slices and chopped dill.',
        'Bake for 12-15 minutes until salmon flakes easily with a fork and asparagus is tender-crisp.',
      ]),
    },
    {
      title: 'Fluffy Weekend Blueberry Pancakes',
      description: 'Thick, golden, fluffy buttermilk pancakes packed with juicy fresh blueberries and pure maple syrup.',
      imageUrl: 'https://images.unsplash.com/photo-1528207776546-365bb710ee93?w=800&auto=format&fit=crop&q=80',
      prepTime: '10 min',
      cookTime: '15 min',
      servings: '4',
      sourceUrl: 'https://famkit.app/recipes/blueberry-pancakes',
      tags: 'Breakfast, Weekend, Kid-Favorite',
      ingredients: JSON.stringify([
        { item: '2 cups all-purpose flour', category: 'Pantry & Dry Goods' },
        { item: '2 tbsp sugar', category: 'Pantry & Dry Goods' },
        { item: '2 tsp baking powder', category: 'Pantry & Dry Goods' },
        { item: '1/2 tsp salt', category: 'Pantry & Dry Goods' },
        { item: '1.5 cups buttermilk or milk', category: 'Dairy & Eggs' },
        { item: '2 large eggs', category: 'Dairy & Eggs' },
        { item: '3 tbsp melted butter', category: 'Dairy & Eggs' },
        { item: '1 cup fresh blueberries', category: 'Produce' },
      ]),
      instructions: JSON.stringify([
        'In a large bowl, whisk together flour, sugar, baking powder, and salt.',
        'In another bowl, whisk milk, eggs, and melted butter.',
        'Pour wet ingredients into dry ingredients and stir gently until just combined (a few lumps are okay).',
        'Heat a buttered griddle over medium heat. Pour 1/4 cup batter per pancake and drop fresh blueberries on top.',
        'Cook until bubbles form on surface, flip and cook 1-2 minutes more until golden brown.',
      ]),
    }
  ];

  const createdRecipes = [];
  for (const r of sampleRecipes) {
    let recipe = await prisma.recipe.findFirst({
      where: { householdId: household.id, title: r.title },
    });
    if (!recipe) {
      recipe = await prisma.recipe.create({
        data: {
          ...r,
          householdId: household.id,
        },
      });
    }
    createdRecipes.push(recipe);
  }

  // 7. Seed 7-Day Meal Plans (for current week)
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + i);
    const dateStr = targetDate.toISOString().split('T')[0];

    const mealDefs = [
      {
        mealType: 'breakfast',
        title: i === 0 || i === 6 ? 'Fluffy Blueberry Pancakes' : 'Greek Yogurt, Granola & Berries',
        recipeId: i === 0 || i === 6 ? createdRecipes[2]?.id : null,
      },
      {
        mealType: 'lunch',
        title: 'Turkey Club Wrap & Crisp Apple Slices',
        recipeId: null,
      },
      {
        mealType: 'dinner',
        title: i % 2 === 0 ? 'Creamy Garlic Tuscan Chicken with Penne' : 'Sheet Pan Lemon Herb Salmon',
        recipeId: i % 2 === 0 ? createdRecipes[0]?.id : createdRecipes[1]?.id,
      },
    ];

    for (const m of mealDefs) {
      const existing = await prisma.mealPlan.findUnique({
        where: {
          householdId_date_mealType: {
            householdId: household.id,
            date: dateStr,
            mealType: m.mealType,
          },
        },
      });

      if (!existing) {
        await prisma.mealPlan.create({
          data: {
            date: dateStr,
            mealType: m.mealType,
            title: m.title,
            recipeId: m.recipeId,
            householdId: household.id,
          },
        });
      }
    }
  }

  // 8. Seed Calendar Events
  const sampleEvents = [
    {
      title: 'Leo Soccer Practice',
      date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      startTime: '16:30',
      endTime: '17:45',
      category: 'Sports',
      color: '#f59e0b',
      location: 'Community Park Field #2',
      assignedMemberId: createdMembers[2].id,
    },
    {
      title: 'Emma Ballet Class',
      date: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
      startTime: '15:30',
      endTime: '16:30',
      category: 'School',
      color: '#10b981',
      location: 'Downtown Dance Studio',
      assignedMemberId: createdMembers[3].id,
    },
    {
      title: 'Family Movie & Pizza Night 🍕',
      date: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0],
      startTime: '18:30',
      endTime: '21:00',
      category: 'Family',
      color: '#6366f1',
      location: 'Living Room',
      assignedMemberId: createdMembers[0].id,
    },
    {
      title: 'Dentist Checkup (Joshua)',
      date: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
      startTime: '10:00',
      endTime: '11:00',
      category: 'Appointment',
      color: '#ec4899',
      location: 'Oakridge Dental Care',
      assignedMemberId: createdMembers[0].id,
    }
  ];

  for (const ev of sampleEvents) {
    const existing = await prisma.calendarEvent.findFirst({
      where: { householdId: household.id, title: ev.title, date: ev.date },
    });
    if (!existing) {
      await prisma.calendarEvent.create({
        data: {
          ...ev,
          householdId: household.id,
        },
      });
    }
  }

  console.log('Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
