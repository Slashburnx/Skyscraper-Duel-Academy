// ═══════════════════════════════════════════════════════════
// YGO SKYSCRAPER — STORE.JS
// Provides getDuelists(), getRules(), saveRules(), etc. as plain
// global functions (window.*) so bracket.js / decklists.js / exams.js /
// rules.js / shop.js / wheel.js — which already call these names —
// work without any changes to those files.
//
// How it works: on page load we do ONE synchronous fetch of the
// entire data tree (so the very first render, which happens
// immediately and can't "await" anything, already has real data —
// same as the old localStorage days). After that, every save*()
// call writes straight to the server and updates the local copy.
// ═══════════════════════════════════════════════════════════

import { fbSet, PATHS } from './api.js';

const cache = {
  duelists: {}, archetypes: {}, tickets: {}, rules: {}, exams: {},
  wheel: { items: [], result: null, history: {} },
  bracket: { players: [], winners: {} },
  shop: { budget: [], premium: [] },
};

// ── ONE synchronous load so data is ready before the page's own
//    script runs its first render (mirrors old localStorage behavior) ──
(function loadInitialTreeSync() {
  try {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/data/', false); // false = synchronous
    xhr.send(null);
    if (xhr.status >= 200 && xhr.status < 300) {
      const { value } = JSON.parse(xhr.responseText);
      if (value) Object.assign(cache, value);
    }
  } catch (err) {
    console.error('store.js: initial data load failed', err);
  }
  cache.wheel   = cache.wheel   || { items: [], result: null, history: [] };
  cache.bracket = cache.bracket || { players: [], winners: {} };
  cache.shop    = cache.shop    || { budget: [], premium: [] };
})();

// ── Helpers ─────────────────────────────────────────────────
function toIdObject(arr, prefix) {
  const obj = {};
  (arr || []).forEach((item, i) => {
    const hasId = item && item.id !== undefined && item.id !== null && item.id !== '';
    const key = hasId ? String(item.id) : `${prefix}${Date.now()}_${i}`;
    obj[key] = hasId ? item : { ...item, id: Number(Date.now()) + i };
  });
  return obj;
}

// ── Getters (always read from the local cache — synchronous) ──
function getDuelists()    { return Object.values(cache.duelists || {}); }
function getArchetypes()  { return Object.values(cache.archetypes || {}); }
function getTickets()     { return Object.values(cache.tickets || {}); }
function getRules()       { return Object.values(cache.rules || {}); }
function getExams()       { return Object.values(cache.exams || {}); }
function getWheelItems()   { return [...(cache.wheel.items || [])]; }
function getWheelResult()  { return cache.wheel.result || null; }
function getWheelHistory() { return [...(cache.wheel.history || [])]; }
function getBracketPlayers() { return [...(cache.bracket.players || [])]; }
function getBracketWinners() { return { ...(cache.bracket.winners || {}) }; }
function getShopBudget()   { return [...(cache.shop.budget || [])]; }
function getShopPremium()  { return [...(cache.shop.premium || [])]; }
function getArchOwners(name, duelists) {
  return (duelists || getDuelists())
    .filter(d => (d.archs || []).includes(name))
    .map(d => ({ id: d.id, name: d.name }));
}

// ── Setters (persist to the server, then update the cache) ────
async function saveTickets(arr) {
  const obj = {};
  (arr || []).forEach((t, i) => { obj['t' + (i + 1)] = t; });
  cache.tickets = obj;
  await fbSet(PATHS.tickets, obj);
}
async function saveRules(arr) {
  const obj = toIdObject(arr, 'r');
  cache.rules = obj;
  await fbSet(PATHS.rules, obj);
}
async function saveExams(arr) {
  const obj = toIdObject(arr, 'e');
  cache.exams = obj;
  await fbSet(PATHS.exams, obj);
}
async function saveWheelItems(arr)   { cache.wheel.items = arr;   await fbSet(PATHS.wheelItems, arr); }
async function saveWheelResult(entry) { cache.wheel.result = entry; await fbSet(PATHS.wheelResult, entry); }
async function saveWheelHistory(arr)  { cache.wheel.history = arr;  await fbSet(PATHS.wheelHistory, arr); }
async function saveBracketPlayers(arr) { cache.bracket.players = arr; await fbSet(PATHS.bracketPlayers, arr); }
async function saveBracketWinners(obj) { cache.bracket.winners = obj; await fbSet(PATHS.bracketWinners, obj); }
async function saveShopBudget(arr)  { cache.shop.budget = arr;  await fbSet(PATHS.shopBudget, arr); }
async function saveShopPremium(arr) { cache.shop.premium = arr; await fbSet(PATHS.shopPremium, arr); }

// ── Expose as plain globals — the page scripts call these bare,
//    the same way they'd call any other global function ──────
Object.assign(window, {
  getDuelists, getArchetypes, getTickets, getRules, getExams,
  getWheelItems, getWheelResult, getWheelHistory,
  getBracketPlayers, getBracketWinners,
  getShopBudget, getShopPremium, getArchOwners,
  saveTickets, saveRules, saveExams,
  saveWheelItems, saveWheelResult, saveWheelHistory,
  saveBracketPlayers, saveBracketWinners,
  saveShopBudget, saveShopPremium,
});