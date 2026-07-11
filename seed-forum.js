// One-time script to migrate the old rulebook content into actual forum
// threads in the "Official Rules" category, authored by Slashburnx.
// Run this from your project folder: node seed-forum.js
//
// Safe to run more than once — it skips any rule title that's already
// been posted as a thread.

const readline = require('readline');
const rules = require('./new-rules.json'); // the 26-section rulebook from earlier

const SITE_URL = 'https://skyscraper-duel-academy.onrender.com'; // <-- change if your URL differs
const AUTHOR_NAME = 'Slashburnx'; // exact match, case-sensitive

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, answer => { rl.close(); resolve(answer); }));
}

async function main() {
  console.log(`This will post ${rules.length} rule sections as forum threads, authored by "${AUTHOR_NAME}".`);
  const username = await ask(`Log in as ${AUTHOR_NAME} — username: `);
  const password = await ask('Password: ');

  const loginRes = await fetch(`${SITE_URL}/api/duelist-auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const loginData = await loginRes.json();
  if (!loginData.success) { console.error('❌ Login failed:', loginData.message); return; }
  if (loginData.name !== AUTHOR_NAME) {
    console.error(`❌ Logged in as "${loginData.name}", not "${AUTHOR_NAME}". Stopping to be safe.`);
    return;
  }
  const cookie = loginRes.headers.get('set-cookie');
  console.log(`✅ Logged in as ${loginData.name}.`);

  // Check what's already been posted, so re-running this script doesn't duplicate.
  const existingRes = await fetch(`${SITE_URL}/api/forum/threads?categoryId=official-rules`);
  const existing = (await existingRes.json()).threads.map(t => t.title);

  let posted = 0, skipped = 0;
  for (const rule of rules) {
    if (existing.includes(rule.title)) {
      console.log(`⏭️  Skipping "${rule.title}" — already posted.`);
      skipped++;
      continue;
    }

    const res = await fetch(`${SITE_URL}/api/forum/threads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ categoryId: 'official-rules', title: rule.title, body: rule.body }),
    });
    const data = await res.json();
    if (data.success) {
      console.log(`✅ Posted "${rule.title}"`);
      posted++;
    } else {
      console.log(`❌ Failed "${rule.title}":`, data.message);
    }
  }

  console.log(`\nDone! Posted ${posted}, skipped ${skipped} already-existing.`);
}

main();