// One-time script to import prices + tier symbols from Archetypes1_5(_6).docx
// into your live site's archetype list.
//
// What it does:
//   - For archetypes that ALREADY exist (matched by name, case-insensitive):
//       updates price + symbol only. Owner and status are left completely untouched.
//   - For archetypes that DON'T exist yet:
//       creates them with the docx price + symbol, status:'' and no owner.
//
// Run this from your project folder: node import-archetypes.js
// Requires archetype-price-list.json to be in the same folder.

const readline = require('readline');
const priceList = require('./archetype-price-list.json');

const SITE_URL = 'https://skyscraper-duel-academy.onrender.com'; // <-- change if your URL differs

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, answer => { rl.close(); resolve(answer); }));
}

function parsePrice(raw) {
  const cleaned = String(raw).replace(/,/g, '').trim();
  const n = parseInt(cleaned, 10);
  return Number.isNaN(n) ? null : n;
}

async function main() {
  console.log('This will import prices + tier symbols from the docx price list into your live archetypes.');
  console.log('Existing archetypes: price + symbol updated, owner/status left alone.');
  console.log('New archetypes: created with price + symbol, no owner, no status.\n');
  const confirm1 = await ask('Type YES (all caps) to continue: ');
  if (confirm1 !== 'YES') { console.log('Cancelled — nothing changed.'); return; }

  console.log('\nHow are you logging in?');
  console.log('  1) Admin password');
  console.log('  2) Moderator duelist account (username + password)');
  const mode = await ask('Enter 1 or 2: ');

  let cookie;
  if (mode.trim() === '1') {
    const password = await ask('Admin password: ');
    const res = await fetch(`${SITE_URL}/api/admin/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (!data.success) { console.error('❌ Login failed:', data.message); return; }
    cookie = res.headers.get('set-cookie');
  } else {
    const username = await ask('Username: ');
    const password = await ask('Password: ');
    const res = await fetch(`${SITE_URL}/api/duelist-auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!data.success) { console.error('❌ Login failed:', data.message); return; }
    cookie = res.headers.get('set-cookie');
  }

  console.log('✅ Logged in. Fetching current archetype list...');
  const listRes = await fetch(`${SITE_URL}/api/data/archetypes`);
  const { value: archObj } = await listRes.json();
  const archetypes = { ...(archObj || {}) }; // id -> archetype object

  // Build a case-insensitive name -> id lookup of what's already there
  const byName = {};
  for (const [id, a] of Object.entries(archetypes)) {
    byName[a.name.toLowerCase()] = id;
  }

  let nextIdNum = 1 + Object.keys(archetypes)
    .map(id => parseInt(id.replace(/^a/, ''), 10))
    .filter(n => !Number.isNaN(n))
    .reduce((max, n) => Math.max(max, n), 0);

  const updated = [];
  const created = [];
  const skipped = [];

  for (const row of priceList) {
    const price = parsePrice(row.price_raw);
    if (price === null) {
      skipped.push(`${row.name} (price is "${row.price_raw}", not a number — fix manually)`);
      continue;
    }

    const existingId = byName[row.name.toLowerCase()];
    if (existingId) {
      const existing = archetypes[existingId];
      archetypes[existingId] = { ...existing, price, symbol: row.symbol }; // owner/status untouched
      updated.push(row.name);
    } else {
      const newId = 'a' + (nextIdNum++);
      archetypes[newId] = { id: newId, name: row.name, notes: '', price, status: '', symbol: row.symbol };
      created.push(row.name);
    }
  }

  console.log(`\nAbout to update ${updated.length} existing archetype(s) and create ${created.length} new one(s).`);
  if (skipped.length) {
    console.log(`\n⚠️  Skipping ${skipped.length} row(s) that couldn't be auto-imported:`);
    skipped.forEach(s => console.log('  -', s));
  }
  const confirm2 = await ask('\nType IMPORT to write these changes to the live site: ');
  if (confirm2 !== 'IMPORT') { console.log('Cancelled — nothing changed.'); return; }

  const putRes = await fetch(`${SITE_URL}/api/data/archetypes`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ value: archetypes }),
  });
  const putData = await putRes.json();

  if (putData.success) {
    console.log(`\n✅ Done! Updated ${updated.length}, created ${created.length}.`);
  } else {
    console.error('❌ Import failed:', putData);
  }
}

main();