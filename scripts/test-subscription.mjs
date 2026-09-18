import { getDb, queryAll, queryOne, execute, generateSecureVoucherCode } from '../server/db.ts';

async function runTests() {
  console.log('--- Testing Subscription & Voucher Code System ---');

  const db = await getDb();
  console.log('1. DB initialized successfully.');

  // Test promo codes table
  const promoCodes = queryAll('SELECT * FROM promo_codes');
  console.log(`2. Found ${promoCodes.length} seeded promo codes:`);
  promoCodes.forEach(p => {
    console.log(`   - Code: ${p.code} (${p.description}), Duration: ${p.durationMonths ? p.durationMonths + ' months' : 'Lifetime'}, Uses: ${p.timesUsed}/${p.maxUses}`);
  });

  if (promoCodes.length === 0) {
    throw new Error('Expected seeded promo codes, found none!');
  }

  // Test secure voucher generator
  const code3 = generateSecureVoucherCode('HB3');
  const code6 = generateSecureVoucherCode('HB6');
  const codeL = generateSecureVoucherCode('HBL');
  console.log('3. Generated sample secure voucher codes:');
  console.log('   - 3-Month voucher:', code3);
  console.log('   - 6-Month voucher:', code6);
  console.log('   - Lifetime voucher:', codeL);

  if (!code3.startsWith('HB3-') || !code6.startsWith('HB6-') || !codeL.startsWith('HBL-')) {
    throw new Error('Generated voucher codes do not match expected prefix patterns');
  }

  // Test resilient promo code lookup (case insensitive, dash-insensitive, space-insensitive)
  function findPromo(input) {
    const raw = (input || '').trim().toUpperCase();
    const clean = raw.replace(/[\s\-_]/g, '');
    let row = queryOne('SELECT * FROM promo_codes WHERE UPPER(code) = ?', [raw]);
    if (!row) {
      row = queryOne("SELECT * FROM promo_codes WHERE REPLACE(REPLACE(REPLACE(UPPER(code), '-', ''), ' ', ''), '_', '') = ?", [clean]);
    }
    return row;
  }

  const testInputs = [
    ['hb37x9k2m4p', 'HB3-7X9K-2M4P'],
    ['HB3-7X9K-2M4P', 'HB3-7X9K-2M4P'],
    ['homebase vip', 'HOMEBASEVIP'],
    ['familyvip', 'FAMILYVIP'],
    ['hbl 5t2n 8b7c', 'HBL-5T2N-8B7C'],
    ['HBL-5T2N-8B7C', 'HBL-5T2N-8B7C'],
  ];

  for (const [inp, expected] of testInputs) {
    const res = findPromo(inp);
    if (!res || res.code !== expected) {
      throw new Error(`Lookup failed for "${inp}": expected "${expected}", got "${res?.code}"`);
    }
  }
  // Test assignedTo voucher creation & query
  const testCode = 'TEST-JOHNSON-VIP';
  execute(
    `INSERT OR REPLACE INTO promo_codes (code, description, durationMonths, maxUses, timesUsed, isActive, assignedTo, createdAt) VALUES (?, ?, ?, ?, 0, 1, ?, ?)`,
    [testCode, 'Johnson Family Lifetime Pass', null, 1, 'The Johnson Family', new Date().toISOString()]
  );

  const tracked = queryOne(`
    SELECT p.*,
      (SELECT group_concat(h.name, ', ') FROM households h WHERE UPPER(h.promoCodeUsed) = UPPER(p.code)) as redeemedBy
    FROM promo_codes p
    WHERE p.code = ?
  `, [testCode]);

  console.log('6. Tracked promo code with assigned recipient:');
  console.log('   ', { code: tracked.code, assignedTo: tracked.assignedTo, description: tracked.description });

  // Test redemption with person name and household name
  const redeemCode = 'TEST-REDEEM-NAME';
  execute(
    `INSERT OR REPLACE INTO promo_codes (code, description, durationMonths, maxUses, timesUsed, isActive, assignedTo, createdAt) VALUES (?, ?, ?, ?, 0, 1, ?, ?)`,
    [redeemCode, 'Test Name Pass', null, 1, 'Sarah Miller', new Date().toISOString()]
  );

  // Simulate household redemption by a user
  execute(
    `UPDATE promo_codes
     SET timesUsed = timesUsed + 1,
         claimedByUserName = ?,
         claimedByUserEmail = ?,
         claimedByHouseholdName = ?,
         claimedAt = ?
     WHERE code = ?`,
    ['Sarah Miller', 'sarah@miller.com', 'The Millers', new Date().toISOString(), redeemCode]
  );

  const redeemedTracked = queryOne(`
    SELECT p.* FROM promo_codes p WHERE p.code = ?
  `, [redeemCode]);

  console.log('7. Verified claimed promo code shows person and household:');
  console.log('   ', {
    code: redeemedTracked.code,
    claimedByUserName: redeemedTracked.claimedByUserName,
    claimedByUserEmail: redeemedTracked.claimedByUserEmail,
    claimedByHouseholdName: redeemedTracked.claimedByHouseholdName
  });

  if (redeemedTracked.claimedByUserName !== 'Sarah Miller' || redeemedTracked.claimedByHouseholdName !== 'The Millers') {
    throw new Error('Claimed person full name and household were not saved or retrieved');
  }

  // 8. Test Deli vs Meat Grocery Categorization
  function cleanIngredientName(raw) {
    return raw
      .toLowerCase()
      .replace(/^[\d\s½⅓⅔¼¾⅛⅜⅝⅞/.,-]+(?:to\s+[\d\s½⅓⅔¼¾⅛⅜⅝⅞/.,-]+)?/i, '')
      .replace(/\b(?:cups?|c|tablespoons?|tbsp?|teaspoons?|tsp?|pounds?|lbs?|ounces?|oz|grams?|g|kg|ml|liters?|pinches?|cloves?|stalks?|bunches?|cans?|bottles?|packages?|pkgs?|slices?|pieces?)\b/gi, '')
      .replace(/\([^)]*\)/g, '')
      .replace(/\b(?:divided|optional|to taste|for serving|freshly|grated|chopped|sliced|diced|minced|cubed|crushed|plus more as needed)\b/gi, '')
      .replace(/[^\w\s-]/g, ' ')
      .trim();
  }

  function guessAisleForGroceryItem(rawName, aisles) {
    const clean = cleanIngredientName(rawName);
    const lower = rawName.toLowerCase();
    const findAisle = (regex) => aisles.find((a) => regex.test(a.name));

    if (
      /\b(?:deli|lunch\s*meat|lunchmeat|cold\s*cuts?|prosciutto|salami|pepperoni|bologna|pastrami|capicola|pancetta|mortadella)\b/i.test(lower) ||
      (/\b(?:sliced|shaved|deli)\b/i.test(lower) && /\b(?:turkey|chicken|ham|roast\s*beef|beef|pastrami)\b/i.test(lower) && !/\b(?:ground|raw|whole)\b/i.test(lower)) ||
      /\b(?:turkey|chicken|ham|beef|roast\s*beef)\s+(?:slices?|cold\s*cuts?|lunch\s*meat)\b/i.test(lower) ||
      /\b(?:rotisserie\s*chicken|potato\s*salad|macaroni\s*salad|coleslaw|chicken\s*salad|egg\s*salad|tuna\s*salad|hummus|tzatziki)\b/i.test(lower)
    ) {
      return findAisle(/deli|prepared/i) || findAisle(/meat|seafood/i);
    }
    if (/\b(?:chicken|beef|pork|steak|bacon|turkey|salmon|fish|shrimp|sausage|lamb|tuna|meat|prawns?|scallops?|halibut|cod|tilapia|ribs?|ground beef|ground turkey)\b/i.test(clean)) {
      return findAisle(/meat|seafood/i);
    }
    return findAisle(/other/i);
  }

  const mockAisles = [
    { id: 'a1', name: 'Produce' },
    { id: 'a2', name: 'Bakery & Bread' },
    { id: 'a3', name: 'Deli & Prepared' },
    { id: 'a4', name: 'Meat & Seafood' },
    { id: 'a5', name: 'Dairy & Eggs' },
  ];

  const deliTests = [
    ['sliced turkey', 'Deli & Prepared'],
    ['1/2 lb sliced honey turkey breast', 'Deli & Prepared'],
    ['deli turkey', 'Deli & Prepared'],
    ['shaved ham', 'Deli & Prepared'],
    ['roast beef deli slices', 'Deli & Prepared'],
    ['lunch meat', 'Deli & Prepared'],
    ['prosciutto', 'Deli & Prepared'],
    ['salami', 'Deli & Prepared'],
    ['rotisserie chicken', 'Deli & Prepared'],
    ['ground turkey', 'Meat & Seafood'],
    ['chicken breasts', 'Meat & Seafood'],
    ['raw steak', 'Meat & Seafood'],
  ];

  for (const [item, expected] of deliTests) {
    const result = guessAisleForGroceryItem(item, mockAisles);
    if (!result || result.name !== expected) {
      throw new Error(`Deli test failed for "${item}": expected "${expected}", got "${result?.name}"`);
    }
  }
  console.log('8. Verified all Deli vs Meat categorization tests pass.');

  console.log('--- All subscription & tracking tests PASSED successfully! ---');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
