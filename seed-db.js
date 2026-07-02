const bcrypt = require('bcryptjs');
const Store = require('./models/Store');
const Admin = require('./models/Admin');
const initialData = require('./initial-data.json');

// Runs once every time the server starts. Does nothing if data/admin already exist,
// so it's always safe to leave this in place.
async function ensureAdminAccount() {
  // 1. Make sure there's an admin account.
  const existingAdmin = await Admin.findById('site-admin');
  if (!existingAdmin) {
    const initialPassword = process.env.INITIAL_ADMIN_PASSWORD || 'duelacademy2024';
    const passwordHash = await bcrypt.hash(initialPassword, 10);
    await Admin.create({ _id: 'site-admin', passwordHash });
    console.log(`✅ Admin account created. Initial password: "${initialPassword}" (change it from the site once logged in!)`);
  }

  // 2. Make sure there's starting data, but only if the database is totally empty.
  let doc = await Store.findById('root');
  if (!doc) doc = await Store.create({ _id: 'root', data: {} });

  if (doc.data && doc.data.duelists) {
    return; // already has data, don't overwrite anything
  }

  console.log('🌱 Seeding starting data...');

  const duelists = {};
  initialData.INITIAL_DUELISTS.forEach((d) => { duelists[d.id] = d; });

  const archetypes = {};
  initialData.INITIAL_ARCHETYPES.forEach((a) => { archetypes[a.id] = a; });

  const tickets = {};
  initialData.INITIAL_TICKETS.forEach((t, i) => {
    const id = 't' + (i + 1);
    tickets[id] = { ...t, id };
  });

  const rules = {};
  initialData.INITIAL_RULES.forEach((r) => { rules[String(r.id)] = { ...r }; });

  doc.data = {
    announcement: initialData.DEFAULT_ANNOUNCEMENT,
    duelists,
    archetypes,
    tickets,
    shop: {
      budget: initialData.SHOP_BUDGET_DEFAULT,
      premium: initialData.SHOP_PREMIUM_DEFAULT,
    },
    rules,
    exams: {},
    wheel: {
      items: ['Obelisk Blue', 'Ra Yellow', 'Slifer Red'],
      result: null,
      history: [],
    },
    bracket: {
      players: {},
      winners: {},
    },
  };
  doc.markModified('data');
  await doc.save();

  console.log('✅ Starting data seeded!');
}

module.exports = ensureAdminAccount;
