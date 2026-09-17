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

  // Test household subscription columns
  const demoHousehold = queryOne('SELECT id, name, subscriptionStatus, subscriptionPlan, subscriptionExpiresAt, promoCodeUsed FROM households WHERE id = "fam_default_1"');
  console.log('4. Demo household status:');
  console.log('   ', demoHousehold);

  if (!demoHousehold || demoHousehold.subscriptionStatus !== 'active') {
    throw new Error('Demo household should be active');
  }

  console.log('--- All subscription tests PASSED successfully! ---');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
