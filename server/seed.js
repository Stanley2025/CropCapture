'use strict';
/**
 * Seed demo farmers (with farms, seasons, harvests and expenses) into the same
 * Supabase project the mobile app uses.
 *
 *   npm run ussd:seed               upsert demo data (idempotent: fixed IDs)
 *   npm run ussd:seed -- --clean    delete demo farmers + the "new farmer" demo phone, then exit
 *   npm run ussd:seed -- --reset    clean, then seed again (use before each demo run)
 *
 * Seeded rows are tagged source = 'seed' (or with the text "Demo seed data" if the
 * source column migration has not been applied), so the activity log labels them honestly.
 */
const { loadEnv, supabaseConfig } = require('./index');
const { createSupabaseRepository } = require('./ussd/repository');
const { buildDemoRows, DEMO_FARMERS, NEW_FARMER_DEMO_PHONE } = require('./ussd/demoData');

const ORDER = ['farmers', 'farms', 'farm_seasons', 'harvest_batches', 'expenses'];

async function clean(repo) {
  const demoIds = DEMO_FARMERS.map((d) => d.farmer.id);
  const registered = (await repo.findFarmersByPhone(NEW_FARMER_DEMO_PHONE)).map((f) => f.id);
  await repo.deleteFarmers([...demoIds, ...registered]);
  console.log(`Removed ${demoIds.length} demo farmers and ${registered.length} farmer(s) registered on ${NEW_FARMER_DEMO_PHONE}.`);
}

async function seed(repo) {
  const rows = buildDemoRows();
  for (const table of ORDER) {
    await repo.upsertRows(table, rows[table], 'seed');
    console.log(`  ${table}: ${rows[table].length} rows`);
  }
  console.log('Demo farmers:');
  for (const { farmer, farms } of DEMO_FARMERS) {
    console.log(`  ${farmer.full_name.padEnd(14)} ${farmer.phone_number}  ${farms.map((f) => f.name).join(', ')}`);
  }
  console.log(`New-farmer demo phone (unregistered): ${NEW_FARMER_DEMO_PHONE}`);
}

async function main() {
  loadEnv();
  const cfg = supabaseConfig();
  if (!cfg.configured) {
    console.error('Supabase is not configured (.env EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY). Memory mode seeds itself automatically.');
    process.exit(1);
  }
  const repo = createSupabaseRepository({ url: cfg.url, key: cfg.key });
  const args = process.argv.slice(2);
  if (args.includes('--clean') || args.includes('--reset')) await clean(repo);
  if (!args.includes('--clean')) await seed(repo);
}

main().catch((e) => {
  console.error('Seed failed:', e.message);
  process.exit(1);
});
