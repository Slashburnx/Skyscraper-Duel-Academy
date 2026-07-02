# YGO Skyscraper Duel Academy — Website

Your duel academy site, now running on Node.js + MongoDB instead of Firebase.
Same 9 pages, same look — the "backend" underneath is different.

---

## WHAT CHANGED FROM THE FIREBASE VERSION

- All data (duelists, archetypes, tickets, rules, exams, wheel, bracket, shop,
  announcement) now lives in **MongoDB** instead of Firebase.
- The admin password is no longer stored in the database in plain text — it's
  hashed, and only the server can check it. Nobody can read it, even by
  poking around in the database.
- **The admin ("mod") still has full control** — everything they could edit
  before (duelists, archetypes, prices, rules, exams, the wheel, the bracket,
  shop stock, tickets, the announcement banner) they can still edit, from the
  same buttons on the same pages. Nothing was taken away.
- I also found and fixed a real bug: 6 of your 9 pages (Bracket, Decklists,
  Exams, Rules, Shop, Wheel) were calling data functions
  (`getDuelists()`, `saveRules()`, etc.) that were **never actually defined
  anywhere** in the project — they were left over from an earlier,
  unfinished version of the site. Those pages could never have saved data
  correctly, even before Firebase. They're wired up for real now.

---

## SETUP GUIDE (Step by Step)

### Step 1 — Install Node.js
Download from: https://nodejs.org (get the LTS version)

### Step 2 — Install dependencies
Open a terminal in this folder and run:
```
npm install
```

### Step 3 — Set up MongoDB Atlas (FREE)
1. Go to https://mongodb.com/atlas
2. Create a free account
3. Create a free cluster
4. Click "Connect" → "Connect your application"
5. Copy the connection string (looks like `mongodb+srv://user:pass@cluster...`)

### Step 4 — Create your .env file
Copy `.env.example` to `.env`:
```
cp .env.example .env
```
Then open `.env` and fill in:
- `MONGODB_URI` — the connection string from Step 3
- `JWT_SECRET` — any long random string (mash your keyboard)
- `INITIAL_ADMIN_PASSWORD` — the password the admin will log in with the
  very first time (they can change it from the site afterward, under
  Admin → Change Password)

### Step 5 — Start the server
```
npm start
```
The first time it runs, it automatically creates the admin account and
fills the database with your existing duelists, archetypes, tickets, and
rules — you don't need to do anything else.

### Step 6 — Open the website
http://localhost:3000

---

## HOW ADMIN LOGIN WORKS NOW

Click "🔒 Admin" in the nav bar → enter the password from `INITIAL_ADMIN_PASSWORD`
(or whatever it's since been changed to) → you're logged in for 12 hours.
Every page checks with the server, not just your browser, so admin-only
actions (edit, delete, add) are actually protected — not just hidden buttons.

---

## DEPLOYMENT (Make it live online)

### Railway.app (Recommended, FREE to start)
1. Go to https://railway.app
2. Connect your GitHub account
3. Push this project to a GitHub repo first
4. Create a new project from that GitHub repo
5. Add your environment variables (`MONGODB_URI`, `JWT_SECRET`,
   `INITIAL_ADMIN_PASSWORD`) in Railway's Variables tab
6. Railway deploys automatically and gives you a live URL

### Render.com (also FREE to start)
Same idea — connect the GitHub repo, add the same environment variables,
deploy. Render's dashboard walks you through it.

---

## PROJECT STRUCTURE

```
server.js              → starts everything
seed-db.js              → creates the admin account + fills starting data (first run only)
initial-data.json       → your original duelists/archetypes/tickets/rules, extracted from data.js
config/db.js             → connects to MongoDB
models/Store.js          → the site's data (one JSON tree, same shape Firebase used)
models/Admin.js           → the admin account (hashed password)
routes/data.js            → read/write API for site data
routes/admin.js           → login / logout / change password
middleware/auth.js        → checks you're really logged in before allowing edits
public/                   → your website — same HTML/CSS as before
public/api.js             → replaces firebase.js — same function names, talks to our own API
public/store.js           → powers Bracket/Decklists/Exams/Rules/Shop/Wheel (previously broken)
```

## IF SOMETHING'S NOT WORKING

- "Failed to connect to MongoDB" → double check `MONGODB_URI` in `.env`,
  and that your Atlas cluster allows connections from your IP (Atlas →
  Network Access → Add IP Address → Allow from anywhere, for testing).
- Admin login says "wrong password" → check `INITIAL_ADMIN_PASSWORD` in
  `.env` matches what you're typing, and that this is really the *first*
  run (after that, the password only lives in the database, changing
  `.env` won't do anything).
- A page looks broken / edits don't save → open the browser console
  (F12 → Console tab) and check for red errors; that'll usually say exactly
  which request failed.
