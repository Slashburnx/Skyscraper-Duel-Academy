// One-time script to remove every duelist EXCEPT "Slashburnx" from your live site.
// Run this from your project folder: node wipe-duelists.js
//
// ⚠️ THIS IS IRREVERSIBLE. Make sure you actually want to do this before running it.
// It logs in as admin (or a Moderator account) and deletes every duelist whose
// name isn't exactly "Slashburnx".

const readline = require('readline');

const SITE_URL = 'https://skyscraper-duel-academy.onrender.com'; // <-- change if your URL differs
const KEEP_NAME = 'Slashburnx'; // exact match, case-sensitive

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, answer => { rl.close(); resolve(answer); }));
}

async function main() {
  console.log(`⚠️  This will DELETE every duelist except "${KEEP_NAME}". This cannot be undone.`);
  const confirm1 = await ask('Type YES (all caps) to continue: ');
  if (confirm1 !== 'YES') {
    console.log('Cancelled — nothing was deleted.');
    return;
  }

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

  console.log('✅ Logged in. Fetching duelist list...');
  const listRes = await fetch(`${SITE_URL}/api/data/duelists`);
  const { value: duelistsObj } = await listRes.json();
  const duelists = Object.values(duelistsObj || {});

  const toDelete = duelists.filter(d => d.name !== KEEP_NAME);
  const toKeep   = duelists.filter(d => d.name === KEEP_NAME);

  if (!toKeep.length) {
    console.log(`⚠️  No duelist named exactly "${KEEP_NAME}" was found. Stopping — check the spelling before running again.`);
    return;
  }
  if (!toDelete.length) {
    console.log('Nothing to delete — only', KEEP_NAME, 'exists already.');
    return;
  }

  console.log(`\nAbout to delete ${toDelete.length} duelist(s):`);
  toDelete.forEach(d => console.log('  -', d.name));
  const confirm2 = await ask(`\nType DELETE to confirm removing these ${toDelete.length} duelists: `);
  if (confirm2 !== 'DELETE') {
    console.log('Cancelled — nothing was deleted.');
    return;
  }

  for (const d of toDelete) {
    const res = await fetch(`${SITE_URL}/api/data/duelists/${d.id}`, {
      method: 'DELETE',
      headers: { Cookie: cookie },
    });
    console.log(res.ok ? `✅ Deleted ${d.name}` : `❌ Failed to delete ${d.name}`);
  }

  console.log('\nDone!');
}

main();