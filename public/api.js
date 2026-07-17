// ═══════════════════════════════════════════════════════════
// YGO SKYSCRAPER — API.JS
// Drop-in replacement for firebase.js. Same function names
// (fbGet, fbSet, fbUpdate, fbRemove, fbListen, PATHS) but talks
// to our own Node.js/Express/MongoDB backend instead of Firebase.
// ═══════════════════════════════════════════════════════════

const API_BASE = '/api/data';

export async function fbGet(path) {
  const res = await fetch(`${API_BASE}/${path}`);
  const { value } = await res.json();
  return value;
}

export async function fbSet(path, value) {
  await fetch(`${API_BASE}/${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ value }),
  });
}

export async function fbUpdate(path, value) {
  await fetch(`${API_BASE}/${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ value }),
  });
}

export async function fbRemove(path) {
  await fetch(`${API_BASE}/${path}`, {
    method: 'DELETE',
    credentials: 'include',
  });
}

// Firebase's onValue() pushed live updates over a socket. We don't have that
// server, so we poll every few seconds instead — same callback signature,
// so nothing else in the app needs to change.
const POLL_MS = 4000;

export function fbListen(path, callback) {
  let last = undefined;

  async function tick() {
    try {
      const value = await fbGet(path);
      const serialized = JSON.stringify(value);
      if (serialized !== last) {
        last = serialized;
        callback(value);
      }
    } catch (err) {
      console.error('fbListen poll failed for', path, err);
    }
  }

  tick();
  const timer = setInterval(tick, POLL_MS);
  return () => clearInterval(timer); // caller can stop listening if needed
}

export const PATHS = {
  announcement  : 'announcement',
  duelists      : 'duelists',
  archetypes    : 'archetypes',
  tickets       : 'tickets',
  shopBudget    : 'shop/budget',
  shopPremium   : 'shop/premium',
  rules         : 'rules',
  exams         : 'exams',
  wheelItems    : 'wheel/items',
  wheelResult   : 'wheel/result',
  wheelHistory  : 'wheel/history',
  bracketPlayers: 'bracket/players',
  bracketWinners: 'bracket/winners',
  bracketRotationIndex: 'bracket/rotationIndex',
  bracketTypeOverride : 'bracket/typeOverride',
  tournamentHistory   : 'bracket/history',
};

// ── Admin auth (new — replaces the old "password stored in Firebase" scheme) ──
export async function adminLogin(password) {
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ password }),
  });
  return res.json(); // { success, message? }
}

export async function adminLogout() {
  await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' });
}

export async function adminCheck() {
  const res = await fetch('/api/admin/check', { credentials: 'include' });
  const { isAdmin } = await res.json();
  return isAdmin;
}

export async function adminChangePassword(currentPassword, newPassword) {
  const res = await fetch('/api/admin/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  return res.json();
}