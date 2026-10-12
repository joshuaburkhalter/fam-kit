import type { IngredientSubstitution } from '../types';

export interface CuratedSubstitutionTemplate {
  name: string;
  ratio: string; // e.g. "1:1 swap", "3/4 amount", "1/4 cup per egg"
  ratioMultiplier?: number; // numeric multiplier if applicable
  fixedAmountPerUnit?: { amount: number; unit: string }; // e.g. 0.25 cup per egg
  unit?: string;
  badge: string; // e.g. "Healthier / High-Protein", "Dairy-Free", "Pantry Swap"
  reason: string;
  groceryItemName: string;
}

export interface CuratedIngredientGroup {
  aliases: string[];
  substitutions: CuratedSubstitutionTemplate[];
}

export const CURATED_SUBSTITUTIONS: CuratedIngredientGroup[] = [
  // 1. SOUR CREAM
  {
    aliases: ['sour cream', 'sourcream', 'crema mexicana', 'crema'],
    substitutions: [
      {
        name: 'Greek Yogurt',
        ratio: '1:1 swap',
        ratioMultiplier: 1,
        badge: 'Healthier / High-Protein',
        reason: 'Identical thick consistency and pleasant tang with 3x protein and significantly less saturated fat. Perfect in baking, dips, dressings, and dollops.',
        groceryItemName: 'Plain Whole Milk Greek Yogurt',
      },
      {
        name: 'Blended Cottage Cheese',
        ratio: '1:1 swap',
        ratioMultiplier: 1,
        badge: 'Ultra High-Protein',
        reason: 'When blended until silky smooth, cottage cheese mimics sour cream with a mild creamy flavor and very high protein.',
        groceryItemName: 'Small Curd Cottage Cheese (4% Milkfat)',
      },
      {
        name: 'Mayonnaise',
        ratio: '1:1 swap in baking',
        ratioMultiplier: 1,
        badge: 'Baking & Moist Cakes',
        reason: 'Provides rich moisture and tenderness in quick breads, cakes, and casseroles without altering the bake chemistry.',
        groceryItemName: 'Mayonnaise',
      },
      {
        name: 'Coconut Cream (Dairy-Free)',
        ratio: '1:1 swap',
        ratioMultiplier: 1,
        badge: 'Dairy-Free / Vegan',
        reason: 'Rich and velvety plant-based alternative. Add 1 teaspoon of lemon juice or apple cider vinegar for that signature tang.',
        groceryItemName: 'Canned Coconut Cream',
      },
      {
        name: 'Buttermilk + Melted Butter',
        ratio: '3/4 cup buttermilk + 1/3 cup melted butter per cup',
        badge: 'Pantry Baking Hack',
        reason: 'Emulates the acidity and fat profile of sour cream for pancakes, biscuits, and loaf cakes.',
        groceryItemName: 'Cultured Buttermilk',
      },
    ],
  },

  // 2. HEAVY CREAM / WHIPPING CREAM
  {
    aliases: ['heavy cream', 'heavy whipping cream', 'whipping cream', 'double cream'],
    substitutions: [
      {
        name: 'Whole Milk + Melted Butter',
        ratio: '3/4 cup milk + 1/4 cup melted butter per cup',
        badge: 'Pantry Staple',
        reason: 'Replaces the fat content and rich mouthfeel in soups, pan sauces, and casseroles (does not whip into stiff peaks).',
        groceryItemName: 'Whole Milk',
      },
      {
        name: 'Full-Fat Coconut Milk',
        ratio: '1:1 swap',
        ratioMultiplier: 1,
        badge: 'Dairy-Free / Vegan',
        reason: 'Provides silky richness and body in soups, curries, and sauces with subtle coconut sweetness.',
        groceryItemName: 'Canned Full-Fat Coconut Milk',
      },
      {
        name: 'Evaporated Milk',
        ratio: '1:1 swap',
        ratioMultiplier: 1,
        badge: 'Lower Fat / Shelf-Stable',
        reason: 'Concentrated milk solids add rich creaminess with 60% less fat than heavy cream in savory dishes.',
        groceryItemName: 'Evaporated Milk (12 oz can)',
      },
      {
        name: 'Greek Yogurt + Milk',
        ratio: '1/2 cup yogurt + 1/2 cup milk per cup',
        badge: 'High-Protein / Tangy',
        reason: 'Whisked together, creates a creamy base for stroganoff, creamy pasta sauces, and dressings.',
        groceryItemName: 'Plain Greek Yogurt',
      },
      {
        name: 'Half-and-Half',
        ratio: '1:1 swap',
        ratioMultiplier: 1,
        badge: 'Lighter Body',
        reason: 'Seamless swap for coffee, pan reductions, and custards with lower butterfat.',
        groceryItemName: 'Half-and-Half',
      },
    ],
  },

  // 3. BUTTERMILK
  {
    aliases: ['buttermilk', 'cultured buttermilk'],
    substitutions: [
      {
        name: 'Milk + Lemon Juice or White Vinegar',
        ratio: '1 cup milk + 1 tbsp lemon juice (let rest 5m)',
        ratioMultiplier: 1,
        badge: 'Instant Kitchen Hack',
        reason: 'The natural acid curdles the milk within 5 minutes, providing the lift and tender crumb buttermilk gives to pancakes and cakes.',
        groceryItemName: 'Whole Milk',
      },
      {
        name: 'Plain Greek Yogurt + Milk',
        ratio: '3/4 cup yogurt + 1/4 cup milk per cup',
        ratioMultiplier: 1,
        badge: 'High-Protein',
        reason: 'Thick, tangy, and rich in enzymes that tenderize meats in marinades and make biscuits extra fluffy.',
        groceryItemName: 'Plain Greek Yogurt',
      },
      {
        name: 'Sour Cream + Water/Milk',
        ratio: '3/4 cup sour cream + 1/4 cup liquid per cup',
        ratioMultiplier: 1,
        badge: 'Pantry Backup',
        reason: 'Thinned sour cream matches buttermilk acidity and viscosity perfectly.',
        groceryItemName: 'Sour Cream',
      },
    ],
  },

  // 4. BUTTER
  {
    aliases: ['butter', 'unsalted butter', 'salted butter', 'sweet cream butter'],
    substitutions: [
      {
        name: 'Extra Virgin Olive Oil or Avocado Oil',
        ratio: '3/4 cup oil per 1 cup butter (3:4 ratio)',
        ratioMultiplier: 0.75,
        badge: 'Heart-Healthy / Dairy-Free',
        reason: 'Replaces saturated fats with heart-healthy monounsaturated fats. Excellent for sautéing, pasta, and rustic cakes.',
        groceryItemName: 'Extra Virgin Olive Oil',
      },
      {
        name: 'Coconut Oil',
        ratio: '1:1 swap',
        ratioMultiplier: 1,
        badge: 'Plant-Based / Baking',
        reason: 'Solid at room temperature like butter, making it the premier choice for flaky pie dough and cookies.',
        groceryItemName: 'Virgin Unrefined Coconut Oil',
      },
      {
        name: 'Unsweetened Applesauce',
        ratio: '1:1 swap in baking',
        ratioMultiplier: 1,
        badge: 'Low-Calorie / Oil-Free',
        reason: 'Drastically cuts fat and calories while keeping muffins, brownies, and quick breads extraordinarily moist.',
        groceryItemName: 'Unsweetened Applesauce',
      },
      {
        name: 'Ghee (Clarified Butter)',
        ratio: '1:1 swap',
        ratioMultiplier: 1,
        badge: 'Lactose-Free / High Heat',
        reason: 'Milk solids removed; delivers an intensely nutty, buttery aroma with a high 485°F smoke point.',
        groceryItemName: 'Organic Grass-Fed Ghee',
      },
      {
        name: 'Greek Yogurt',
        ratio: '1/2 cup yogurt per 1 cup butter in baking',
        ratioMultiplier: 0.5,
        badge: 'High-Protein',
        reason: 'Cuts fat in half while lending tender moisture and protein to baked goods.',
        groceryItemName: 'Plain Greek Yogurt',
      },
    ],
  },

  // 5. EGGS
  {
    aliases: ['egg', 'eggs', 'large egg', 'large eggs', 'whole egg', 'whole eggs'],
    substitutions: [
      {
        name: 'Unsweetened Applesauce',
        ratio: '1/4 cup per egg',
        fixedAmountPerUnit: { amount: 0.25, unit: 'cup' },
        badge: 'Vegan / Baking',
        reason: 'Binds ingredients and traps moisture in cakes, muffins, brownies, and quick breads without altering the sweetness.',
        groceryItemName: 'Unsweetened Applesauce',
      },
      {
        name: 'Flax Egg (Ground Flaxseed + Water)',
        ratio: '1 tbsp ground flax + 3 tbsp warm water (rest 5m) per egg',
        fixedAmountPerUnit: { amount: 1, unit: 'tbsp' },
        badge: 'Vegan / Omega-3 Rich',
        reason: 'Forms a mucilaginous gel that replicates egg binding in cookies, oat bars, pancakes, and hearty loaves.',
        groceryItemName: 'Ground Golden Flaxseed Meal',
      },
      {
        name: 'Mashed Banana',
        ratio: '1/2 medium mashed banana per egg',
        fixedAmountPerUnit: { amount: 0.5, unit: 'banana' },
        badge: 'Natural Sweetness',
        reason: 'Superb binder that infuses natural moisture and a hint of sweetness in pancakes and breakfast bakes.',
        groceryItemName: 'Ripe Bananas',
      },
      {
        name: 'Silken Tofu',
        ratio: '1/4 cup pureed silken tofu per egg',
        fixedAmountPerUnit: { amount: 0.25, unit: 'cup' },
        badge: 'Neutral / High-Protein',
        reason: 'Blends into a completely neutral, creamy binder ideal for dense cakes and savory quiches.',
        groceryItemName: 'Silken Tofu (Firm or Extra Firm)',
      },
      {
        name: 'Aquafaba (Chickpea Brine)',
        ratio: '3 tbsp liquid per whole egg (or 2 tbsp per egg white)',
        fixedAmountPerUnit: { amount: 3, unit: 'tbsp' },
        badge: 'Whippable / Egg-Free',
        reason: 'Whips into stiff, glossy peaks just like egg whites for meringues, macarons, and light batters.',
        groceryItemName: 'Canned Garbanzo Beans (Chickpeas)',
      },
    ],
  },

  // 6. CREAM CHEESE
  {
    aliases: ['cream cheese', 'philadelphia cream cheese', 'creamcheese'],
    substitutions: [
      {
        name: 'Neufchâtel Cheese',
        ratio: '1:1 swap',
        ratioMultiplier: 1,
        badge: '1/3 Less Fat',
        reason: 'Identical taste and smooth spreadability with 33% less fat; completely seamless in cheesecakes and dips.',
        groceryItemName: 'Neufchâtel Cheese (8 oz block)',
      },
      {
        name: 'Strained Greek Yogurt (Labneh)',
        ratio: '1:1 swap',
        ratioMultiplier: 1,
        badge: 'High-Protein',
        reason: 'Strain plain whole milk Greek yogurt through a coffee filter or cheesecloth for a rich, tangy spread.',
        groceryItemName: 'Plain Whole Milk Greek Yogurt',
      },
      {
        name: 'Mascarpone',
        ratio: '1:1 swap',
        ratioMultiplier: 1,
        badge: 'Extra Rich & Velvety',
        reason: 'Italian cream cheese with a luscious, slightly sweet profile ideal for tiramisu, frosting, and pasta.',
        groceryItemName: 'Mascarpone Cheese (8 oz)',
      },
      {
        name: 'Dairy-Free Cream Cheese',
        ratio: '1:1 swap',
        ratioMultiplier: 1,
        badge: 'Plant-Based / Vegan',
        reason: 'Cultured almond or cashew spread matches the texture and tang without any dairy.',
        groceryItemName: 'Plant-Based Cream Cheese',
      },
    ],
  },

  // 7. RICOTTA CHEESE
  {
    aliases: ['ricotta', 'ricotta cheese', 'whole milk ricotta'],
    substitutions: [
      {
        name: 'Cottage Cheese',
        ratio: '1:1 swap (pulse briefly for smooth texture)',
        ratioMultiplier: 1,
        badge: 'High-Protein / Low-Fat',
        reason: 'Lower in calories and higher in protein; bakes wonderfully in lasagna, stuffed pasta shells, and ziti.',
        groceryItemName: 'Small Curd Cottage Cheese',
      },
      {
        name: 'Plain Greek Yogurt',
        ratio: '1:1 swap',
        ratioMultiplier: 1,
        badge: 'Tangy / High-Protein',
        reason: 'Great in dips and fillings; strain slightly if using in baked pasta dishes.',
        groceryItemName: 'Plain Greek Yogurt',
      },
      {
        name: 'Tofu Ricotta',
        ratio: '1:1 swap (crumbled with nutritional yeast and lemon)',
        ratioMultiplier: 1,
        badge: 'Dairy-Free / Vegan',
        reason: 'Crumbled firm tofu holds its structure in lasagna and baked pasta just like traditional ricotta.',
        groceryItemName: 'Extra Firm Tofu',
      },
    ],
  },

  // 8. SOY SAUCE
  {
    aliases: ['soy sauce', 'shoyu', 'dark soy sauce', 'light soy sauce'],
    substitutions: [
      {
        name: 'Tamari',
        ratio: '1:1 swap',
        ratioMultiplier: 1,
        badge: 'Gluten-Free',
        reason: 'Naturally fermented Japanese soy sauce brewed with little or no wheat; deeper, richer umami flavor.',
        groceryItemName: 'Tamari Gluten-Free Soy Sauce',
      },
      {
        name: 'Coconut Aminos',
        ratio: '1:1 swap (add a pinch of salt)',
        ratioMultiplier: 1,
        badge: 'Soy-Free / Low-Sodium',
        reason: 'Paleo, gluten-free, and soy-free with 70% less sodium and a pleasant subtle sweetness.',
        groceryItemName: 'Organic Coconut Aminos',
      },
      {
        name: 'Liquid Aminos',
        ratio: '1:1 swap',
        ratioMultiplier: 1,
        badge: 'Concentrated Umami',
        reason: 'Non-GMO liquid protein with a salty, savory burst similar to traditional soy sauce.',
        groceryItemName: 'Bragg Liquid Aminos',
      },
      {
        name: 'Worcestershire Sauce + Water',
        ratio: '1 part Worcestershire + 1 part water',
        ratioMultiplier: 1,
        badge: 'Pantry Backup',
        reason: 'Delivers savory depth, salt, and fermented tang in stews and marinades.',
        groceryItemName: 'Worcestershire Sauce',
      },
    ],
  },

  // 9. MAYONNAISE
  {
    aliases: ['mayonnaise', 'mayo', 'hellmanns', 'kewpie mayo'],
    substitutions: [
      {
        name: 'Plain Greek Yogurt',
        ratio: '1:1 swap',
        ratioMultiplier: 1,
        badge: 'High-Protein / Low-Calorie',
        reason: 'Lends creamy richness and tangy acidity to tuna salad, chicken salad, coleslaw, and cold dressings.',
        groceryItemName: 'Plain Greek Yogurt',
      },
      {
        name: 'Mashed Avocado / Avocado Mayo',
        ratio: '1:1 swap',
        ratioMultiplier: 1,
        badge: 'Healthy Fats',
        reason: 'Packed with heart-healthy monounsaturated fats and fiber; delicious on burgers and wraps.',
        groceryItemName: 'Avocado Oil Mayonnaise',
      },
      {
        name: 'Sour Cream',
        ratio: '1:1 swap',
        ratioMultiplier: 1,
        badge: 'Rich & Tangy',
        reason: 'Great in creamy dips, pasta salads, and baked potato toppings.',
        groceryItemName: 'Sour Cream',
      },
      {
        name: 'Hummus',
        ratio: '1:1 swap',
        ratioMultiplier: 1,
        badge: 'Plant-Based / Fiber-Rich',
        reason: 'Adds moisture and rich savory flavor to wraps, sandwiches, and grain bowls.',
        groceryItemName: 'Classic Hummus',
      },
    ],
  },

  // 10. DIJON MUSTARD
  {
    aliases: ['dijon mustard', 'dijon', 'grey poupon'],
    substitutions: [
      {
        name: 'Spicy Brown or Stone-Ground Mustard',
        ratio: '1:1 swap',
        ratioMultiplier: 1,
        badge: 'Closest Flavor',
        reason: 'Provides the same assertive pungent bite and coarse grain texture in dressings and marinades.',
        groceryItemName: 'Spicy Brown Mustard',
      },
      {
        name: 'Yellow Mustard + White Wine Vinegar',
        ratio: '1 tsp yellow mustard + 1/4 tsp vinegar/white wine per tsp',
        ratioMultiplier: 1,
        badge: 'Pantry Hack',
        reason: 'Adds the necessary acidity and depth to standard mild yellow mustard.',
        groceryItemName: 'Yellow Mustard',
      },
      {
        name: 'Dry Mustard Powder + Water',
        ratio: '1 tsp powder mixed with 1 tsp water/vinegar per tbsp',
        ratioMultiplier: 0.33,
        badge: 'Concentrated Heat',
        reason: 'Delivers concentrated horseradish-like heat for rubs, sauces, and vinaigrettes.',
        groceryItemName: 'Ground Mustard Powder',
      },
    ],
  },

  // 11. TOMATO SAUCE
  {
    aliases: ['tomato sauce', 'canned tomato sauce', 'passata'],
    substitutions: [
      {
        name: 'Tomato Paste + Water',
        ratio: '1 part paste + 1 part water',
        ratioMultiplier: 1,
        badge: 'Instant Pantry Hack',
        reason: 'Whisk together for an identical consistency and rich concentrated tomato sweetness.',
        groceryItemName: 'Tomato Paste (6 oz can)',
      },
      {
        name: 'Canned Crushed Tomatoes (Blended)',
        ratio: '1:1 swap',
        ratioMultiplier: 1,
        badge: 'Fresh & Rustic',
        reason: 'Blend canned diced or whole peeled tomatoes with their juices until smooth.',
        groceryItemName: 'Crushed Tomatoes (28 oz can)',
      },
      {
        name: 'Marinara / Pasta Sauce',
        ratio: '1:1 swap',
        ratioMultiplier: 1,
        badge: 'Pre-Seasoned',
        reason: 'Pre-seasoned with basil, oregano, and garlic; adjust added salt and herbs in your recipe.',
        groceryItemName: 'Marinara Sauce',
      },
    ],
  },

  // 12. ALL-PURPOSE FLOUR
  {
    aliases: ['all-purpose flour', 'all purpose flour', 'ap flour', 'white flour', 'flour'],
    substitutions: [
      {
        name: '1:1 Gluten-Free Baking Flour',
        ratio: '1:1 swap (measure-for-measure with xanthan gum)',
        ratioMultiplier: 1,
        badge: 'Gluten-Free',
        reason: 'Formulated with rice flour and starches to swap 1-to-1 in cakes, brownies, cookies, and quick breads.',
        groceryItemName: '1-to-1 Gluten-Free Baking Flour (Bob\'s Red Mill or King Arthur)',
      },
      {
        name: 'Oat Flour',
        ratio: '1 1/3 cup oat flour per 1 cup AP flour (or 1:1 by weight)',
        ratioMultiplier: 1.33,
        badge: 'Whole Grain / Fiber-Rich',
        reason: 'Subtle nutty sweetness; yields tender cookies, pancakes, and muffins (make at home by blending rolled oats).',
        groceryItemName: 'Whole Grain Oat Flour',
      },
      {
        name: '50/50 Whole Wheat & All-Purpose Flour',
        ratio: '1:1 swap combined',
        ratioMultiplier: 1,
        badge: 'Nutrient-Dense',
        reason: 'Boosts fiber and whole-grain flavor without making the bake excessively dense.',
        groceryItemName: 'Whole Wheat Flour',
      },
      {
        name: 'Almond Flour',
        ratio: '1:1 swap (best for dense cookies, crusts, and quick breads)',
        ratioMultiplier: 1,
        badge: 'Low-Carb / Grain-Free',
        reason: 'Naturally grain-free with healthy fats and moisture; reduce recipe liquid slightly.',
        groceryItemName: 'Super-Fine Blanched Almond Flour',
      },
    ],
  },

  // 13. BROWN SUGAR
  {
    aliases: ['brown sugar', 'light brown sugar', 'dark brown sugar'],
    substitutions: [
      {
        name: 'White Sugar + Molasses',
        ratio: '1 cup white sugar + 1 tbsp molasses (2 tbsp for dark)',
        ratioMultiplier: 1,
        badge: 'Authentic Match',
        reason: 'Commercial brown sugar is simply white sugar with molasses blended back in.',
        groceryItemName: 'Unsulfured Blackstrap Molasses',
      },
      {
        name: 'Pure Maple Syrup',
        ratio: '3/4 cup syrup per 1 cup brown sugar (reduce recipe liquid by 3 tbsp)',
        ratioMultiplier: 0.75,
        badge: 'Unrefined / Natural',
        reason: 'Infuses deep warm caramel notes with natural antioxidant minerals.',
        groceryItemName: 'Pure Grade A Maple Syrup',
      },
      {
        name: 'Coconut Sugar',
        ratio: '1:1 swap',
        ratioMultiplier: 1,
        badge: 'Low Glycemic',
        reason: 'Natural granular sugar made from coconut palm blossoms with a warm toffee-caramel profile.',
        groceryItemName: 'Organic Coconut Palm Sugar',
      },
      {
        name: 'Granulated White Sugar',
        ratio: '1:1 swap',
        ratioMultiplier: 1,
        badge: 'Pantry Staple',
        reason: 'Delivers clean sweetness; cookies will bake slightly crispier and less chewy.',
        groceryItemName: 'Granulated White Sugar',
      },
    ],
  },

  // 14. HONEY
  {
    aliases: ['honey', 'clover honey', 'raw honey'],
    substitutions: [
      {
        name: 'Pure Maple Syrup',
        ratio: '1:1 swap',
        ratioMultiplier: 1,
        badge: 'Vegan / Natural',
        reason: 'Delicious plant-based liquid sweetener with caramel undertones for dressings, marinades, and baking.',
        groceryItemName: 'Pure Maple Syrup',
      },
      {
        name: 'Agave Nectar',
        ratio: '3/4 cup agave per 1 cup honey',
        ratioMultiplier: 0.75,
        badge: 'Neutral / Vegan',
        reason: 'Milder and thinner than honey, dissolving effortlessly in cold beverages and light dressings.',
        groceryItemName: 'Organic Blue Agave Nectar',
      },
      {
        name: 'Brown Rice Syrup',
        ratio: '1:1 swap',
        ratioMultiplier: 1,
        badge: 'Thick Viscosity',
        reason: 'Matches honey\'s thick sticky texture for binding homemade granola bars.',
        groceryItemName: 'Brown Rice Syrup',
      },
    ],
  },

  // 15. LEMON JUICE
  {
    aliases: ['lemon juice', 'fresh lemon juice', 'lemon'],
    substitutions: [
      {
        name: 'Lime Juice',
        ratio: '1:1 swap',
        ratioMultiplier: 1,
        badge: 'Closest Citrus Match',
        reason: 'Identical pH acidity and bright citrus punch; perfect in marinades, dressings, and guacamole.',
        groceryItemName: 'Limes',
      },
      {
        name: 'White Wine Vinegar',
        ratio: '1/2 amount of lemon juice',
        ratioMultiplier: 0.5,
        badge: 'Savory Deglazing',
        reason: 'Provides crisp acidic brightness in savory sauces, marinades, and salad dressings.',
        groceryItemName: 'White Wine Vinegar',
      },
      {
        name: 'Apple Cider Vinegar',
        ratio: '1/2 amount of lemon juice',
        ratioMultiplier: 0.5,
        badge: 'Fruity Acidity',
        reason: 'Mild fruity tartness that works wonders in slaws and marinades.',
        groceryItemName: 'Organic Apple Cider Vinegar',
      },
    ],
  },

  // 16. WHITE WINE (COOKING)
  {
    aliases: ['white wine', 'dry white wine', 'cooking white wine', 'sauvignon blanc', 'pinot grigio'],
    substitutions: [
      {
        name: 'Chicken or Vegetable Broth + Lemon Juice',
        ratio: '1 cup broth + 1 tbsp fresh lemon juice per cup wine',
        ratioMultiplier: 1,
        badge: 'Alcohol-Free',
        reason: 'Savory broth provides depth while lemon juice delivers the vital acidity to balance richness.',
        groceryItemName: 'Low-Sodium Chicken Broth',
      },
      {
        name: 'White Wine Vinegar (Diluted)',
        ratio: '1 part white wine vinegar + 1 part water or broth',
        ratioMultiplier: 1,
        badge: 'Acidic Deglazer',
        reason: 'Excellent for deglazing a hot pan and lifting fond after searing chicken or fish.',
        groceryItemName: 'White Wine Vinegar',
      },
      {
        name: 'Apple Cider Vinegar + Broth',
        ratio: '2 tbsp cider vinegar + 7/8 cup broth per cup wine',
        ratioMultiplier: 1,
        badge: 'Pantry Swap',
        reason: 'Subtle fruitiness and tang ideal for risotto and braises.',
        groceryItemName: 'Apple Cider Vinegar',
      },
    ],
  },

  // 17. GARLIC
  {
    aliases: ['garlic', 'garlic clove', 'garlic cloves', 'fresh garlic', 'minced garlic'],
    substitutions: [
      {
        name: 'Garlic Powder',
        ratio: '1/8 tsp per clove (or 1/4 tsp granulated garlic)',
        fixedAmountPerUnit: { amount: 0.125, unit: 'tsp' },
        badge: 'Pantry Staple',
        reason: 'Dissolves smoothly into soups, rubs, sauces, and dressings without scorching.',
        groceryItemName: 'Garlic Powder',
      },
      {
        name: 'Minced Shallot',
        ratio: '1 tbsp minced shallot per clove',
        fixedAmountPerUnit: { amount: 1, unit: 'tbsp' },
        badge: 'Mild Allium',
        reason: 'Delicate blend of sweet onion and mild garlic notes; fabulous in pan sauces and vinaigrettes.',
        groceryItemName: 'Fresh Shallots',
      },
      {
        name: 'Chives or Scallions',
        ratio: '1 tbsp minced chives per clove',
        fixedAmountPerUnit: { amount: 1, unit: 'tbsp' },
        badge: 'Fresh Herbaceous',
        reason: 'Gentle green allium flavor added towards the end of cooking or as a garnish.',
        groceryItemName: 'Fresh Chives',
      },
    ],
  },

  // 18. CORNSTARCH
  {
    aliases: ['cornstarch', 'corn starch', 'maizena'],
    substitutions: [
      {
        name: 'All-Purpose Flour',
        ratio: '2 tbsp flour per 1 tbsp cornstarch',
        ratioMultiplier: 2,
        badge: 'Pantry Staple',
        reason: 'Whisk into cold liquid first and simmer for an extra 2 minutes to cook out any raw flour taste.',
        groceryItemName: 'All-Purpose Flour',
      },
      {
        name: 'Arrowroot Starch / Powder',
        ratio: '1:1 swap',
        ratioMultiplier: 1,
        badge: 'Gluten-Free / Glossy',
        reason: 'Creates a crystal-clear glossy finish that withstands acidic ingredients like citrus and vinegar.',
        groceryItemName: 'Arrowroot Flour / Starch',
      },
      {
        name: 'Tapioca Starch / Flour',
        ratio: '2 tbsp tapioca per 1 tbsp cornstarch',
        ratioMultiplier: 2,
        badge: 'Pie & Freezer Friendly',
        reason: 'Maintains thick consistency through freezing and thawing; premier thickener for fruit pies.',
        groceryItemName: 'Tapioca Flour',
      },
    ],
  },

  // 19. BAKING POWDER
  {
    aliases: ['baking powder', 'double-acting baking powder'],
    substitutions: [
      {
        name: 'Baking Soda + Cream of Tartar',
        ratio: '1/4 tsp baking soda + 1/2 tsp cream of tartar per tsp baking powder',
        fixedAmountPerUnit: { amount: 0.75, unit: 'tsp' },
        badge: 'True Chemistry Match',
        reason: 'Combines an alkaline base with an acid salt to produce the exact carbon dioxide bubbles needed for lift.',
        groceryItemName: 'Cream of Tartar',
      },
      {
        name: 'Baking Soda + Buttermilk or Yogurt',
        ratio: '1/4 tsp baking soda + 1/2 cup buttermilk (reduce recipe liquid by 1/2 cup)',
        fixedAmountPerUnit: { amount: 0.25, unit: 'tsp' },
        badge: 'Acid-Activated',
        reason: 'The natural acid in cultured dairy activates the baking soda for light, tender pancakes and biscuits.',
        groceryItemName: 'Baking Soda',
      },
    ],
  },

  // 20. PARMESAN CHEESE
  {
    aliases: ['parmesan', 'parmesan cheese', 'parmigiano', 'parmigiano reggiano', 'grated parmesan'],
    substitutions: [
      {
        name: 'Pecorino Romano',
        ratio: '1:1 swap (slightly saltier)',
        ratioMultiplier: 1,
        badge: 'Sharp & Salty',
        reason: 'Aged sheep\'s milk cheese with intense savory punch; classic in Carbonara and Cacio e Pepe.',
        groceryItemName: 'Pecorino Romano Cheese',
      },
      {
        name: 'Nutritional Yeast',
        ratio: '1:1 swap',
        ratioMultiplier: 1,
        badge: 'Dairy-Free / Vegan',
        reason: 'Flaky seasoning packed with B-vitamins that gives popcorn, pasta, and roasted vegetables a cheesy umami note.',
        groceryItemName: 'Nutritional Yeast Flakes',
      },
      {
        name: 'Asiago or Grana Padano',
        ratio: '1:1 swap',
        ratioMultiplier: 1,
        badge: 'Milder Hard Cheese',
        reason: 'Hard Italian cheeses that grate and melt with rich nutty complexity.',
        groceryItemName: 'Aged Asiago Cheese',
      },
    ],
  },
];

/**
 * Normalizes an ingredient name for flexible matching (removes numbers, punctuation, common adjectives).
 */
export function normalizeIngredientName(raw: string): string {
  if (!raw) return '';
  return raw
    .toLowerCase()
    .trim()
    .replace(/^[\d\s\/\.\,\-\u00BC-\u00BE\u2150-\u215E]+/g, '') // remove leading fractions/numbers
    .replace(/\b(fresh|organic|raw|light|low-fat|fat-free|reduced-fat|plain|unsalted|salted|chilled|softened|melted|chopped|diced|minced|sliced|grated|shredded)\b/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse an amount string (e.g. "1 1/2", "1/2", "2") to a numeric float
 */
export function parseNumericAmount(amountStr?: string): number | null {
  if (!amountStr) return null;
  const clean = amountStr.trim();
  // Check simple integer/float
  const floatVal = parseFloat(clean);
  if (!isNaN(floatVal) && !clean.includes('/')) return floatVal;

  // Check fractions: "1 1/2" or "1/2"
  const parts = clean.split(/\s+/);
  if (parts.length === 2 && parts[1].includes('/')) {
    const whole = parseFloat(parts[0]);
    const [num, den] = parts[1].split('/').map(Number);
    if (!isNaN(whole) && !isNaN(num) && !isNaN(den) && den !== 0) {
      return whole + num / den;
    }
  } else if (parts.length === 1 && parts[0].includes('/')) {
    const [num, den] = parts[0].split('/').map(Number);
    if (!isNaN(num) && !isNaN(den) && den !== 0) {
      return num / den;
    }
  }

  return isNaN(floatVal) ? null : floatVal;
}

/**
 * Format numeric quantity into clean cooking fraction or clean decimal
 */
export function formatCookQuantity(val: number): string {
  if (val <= 0) return '';
  const rounded = Math.round(val * 100) / 100;
  const whole = Math.floor(rounded);
  const frac = rounded - whole;

  let fracStr = '';
  if (Math.abs(frac - 0.25) < 0.05) fracStr = '1/4';
  else if (Math.abs(frac - 0.33) < 0.05) fracStr = '1/3';
  else if (Math.abs(frac - 0.5) < 0.05) fracStr = '1/2';
  else if (Math.abs(frac - 0.66) < 0.05) fracStr = '2/3';
  else if (Math.abs(frac - 0.75) < 0.05) fracStr = '3/4';
  else if (frac > 0.05) fracStr = frac.toFixed(1).replace(/^0\./, '.');

  if (whole === 0 && fracStr) return fracStr;
  if (whole > 0 && fracStr) return `${whole} ${fracStr}`;
  return String(whole);
}

/**
 * Searches the curated database for matching substitutions
 */
export function getCuratedSubstitutions(
  ingredientName: string,
  amount?: string,
  unit?: string
): IngredientSubstitution[] {
  if (!ingredientName) return [];
  const normalized = normalizeIngredientName(ingredientName);
  const rawLower = ingredientName.toLowerCase().trim();

  // Find best matching group
  let matchGroup: CuratedIngredientGroup | undefined;

  for (const group of CURATED_SUBSTITUTIONS) {
    for (const alias of group.aliases) {
      const aliasLower = alias.toLowerCase();
      if (
        normalized === aliasLower ||
        rawLower.includes(aliasLower) ||
        aliasLower.includes(normalized) ||
        (aliasLower.endsWith('s') && normalized === aliasLower.slice(0, -1)) ||
        (normalized.endsWith('s') && normalized.slice(0, -1) === aliasLower)
      ) {
        matchGroup = group;
        break;
      }
    }
    if (matchGroup) break;
  }

  if (!matchGroup) return [];

  const parsedAmount = parseNumericAmount(amount);

  return matchGroup.substitutions.map((sub, idx) => {
    let convertedAmount = amount || '';
    let convertedUnit = unit || sub.unit || '';

    if (parsedAmount !== null && parsedAmount > 0) {
      if (sub.fixedAmountPerUnit) {
        const total = parsedAmount * sub.fixedAmountPerUnit.amount;
        convertedAmount = formatCookQuantity(total);
        convertedUnit = sub.fixedAmountPerUnit.unit;
      } else if (sub.ratioMultiplier) {
        const total = parsedAmount * sub.ratioMultiplier;
        convertedAmount = formatCookQuantity(total);
        if (sub.unit) convertedUnit = sub.unit;
      }
    }

    return {
      id: `curated-${idx}-${sub.name.toLowerCase().replace(/\s+/g, '-')}`,
      name: sub.name,
      amount: convertedAmount,
      unit: convertedUnit,
      ratio: sub.ratio,
      badge: sub.badge,
      reason: sub.reason,
      groceryItemName: sub.groceryItemName || sub.name,
      isAiGenerated: false,
    };
  });
}
