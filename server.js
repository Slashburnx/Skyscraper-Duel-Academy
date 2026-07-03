require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const connectDB = require('./config/db');
const ensureAdminAccount = require('./seed-db');

const dataRoutes = require('./routes/data');
const adminRoutes = require('./routes/admin');
const duelistAuthRoutes = require('./routes/duelist-auth');

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/data', dataRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/duelist-auth', duelistAuthRoutes);

app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;

connectDB().then(async () => {
  await ensureAdminAccount(); // creates the admin account + seeds starting data on first run
  app.listen(PORT, () => {
    console.log(`🏫 YGO Skyscraper Duel Academy running at http://localhost:${PORT}`);
  });
});