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

  console.log('--- All subscription & tracking tests PASSED successfully! ---');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
