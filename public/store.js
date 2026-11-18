// Stockage local (IndexedDB) + file d'attente hors-ligne + synchronisation + comptes/espaces
const DB_NAME = 'armurerie';
const COLS = ['items', 'purchases', 'recipes', 'batches', 'sessions', 'weapons', 'maintenance', 'adjustments'];

let idb;
const data = Object.fromEntries(COLS.map(c => [c, new Map()]));
const listeners = new Set();
const ls = {
  get: (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const status = { online: navigator.onLine, syncing: false, pending: 0, lastSync: null, error: null, authed: !!ls.get('token') };
let meInfo = ls.get('me');            // { user, spaces }
let currentSpace = ls.get('space');

function openDB() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      d.createObjectStore('records', { keyPath: 'key' });
      d.createObjectStore('outbox', { keyPath: 'key' });
      d.createObjectStore('meta', { keyPath: 'k' });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
const tx = (store, mode = 'readonly') => idb.transaction(store, mode).objectStore(store);
const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const done = (t) => new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); });

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10));

function emit() { listeners.forEach(fn => fn()); }
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function getStatus() { return status; }

// ----- Compte & espaces -----
export const me = () => meInfo;
export const spaces = () => meInfo?.spaces || [];
export const space = () => spaces().find(s => s.id === currentSpace) || spaces().find(s => s.personal) || null;
export function setSpace(id) { currentSpace = id; ls.set('space', id); emit(); }
function setMe(m) {
  meInfo = { user: m.user, spaces: m.spaces };
  ls.set('me', meInfo);
  if (!spaces().some(s => s.id === currentSpace)) setSpace(spaces().find(s => s.personal)?.id || spaces()[0]?.id);
}

// ----- Lecture (filtrée sur l'espace courant) -----
export function all(col) { const sp = space()?.id; return [...data[col].values()].filter(r => !r.deleted && r.space === sp); }
export function get(col, id) { const r = data[col].get(id); return r && !r.deleted && r.space === space()?.id ? r : null; }
export function countIn(spaceId) { let n = 0; for (const c of COLS) for (const r of data[c].values()) if (!r.deleted && r.space === spaceId) n++; return n; }

export async function init() {
  idb = await openDB();
  const recs = await req(tx('records').getAll());
  for (const r of recs) data[r.col]?.set(r.id, r);
  status.pending = (await req(tx('outbox').getAllKeys())).length;
  status.lastSync = (await req(tx('meta').get('lastSync')))?.v || null;
  window.addEventListener('online', () => { status.online = true; emit(); sync(); });
  window.addEventListener('offline', () => { status.online = false; emit(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });
  setInterval(sync, 30_000);
  emit();
}

async function countPending() { status.pending = (await req(tx('outbox').getAllKeys())).length; }

export async function save(col, obj) {
  const sp = obj.space || space()?.id;
  if (!sp) throw new Error('Aucun espace sélectionné');
  const rec = { ...obj, col, id: obj.id || uid(), space: sp, updatedAt: Date.now(), by: meInfo?.user?.username };
  if (!rec.createdAt) rec.createdAt = rec.updatedAt;
  const key = col + ':' + rec.id;
  data[col].set(rec.id, rec);
  const t = idb.transaction(['records', 'outbox'], 'readwrite');
  t.objectStore('records').put({ ...rec, key });
  t.objectStore('outbox').put({ ...rec, key });
  await done(t);
  await countPending();
  emit();
  queueSync();
  return rec;
}
export async function remove(col, id) {
  const cur = data[col].get(id); if (!cur) return;
  await save(col, { ...cur, deleted: true });
}

let syncTimer;
function queueSync() { clearTimeout(syncTimer); syncTimer = setTimeout(sync, 600); }

// ----- API -----
export async function api(method, path, body) {
  const token = ls.get('token');
  let r;
  try {
    r = await fetch(path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  } catch { throw new Error('Pas de connexion au serveur'); }
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && token) { status.authed = false; emit(); }
  if (!r.ok) throw new Error(j.error || 'Erreur ' + r.status);
  if (j.spaces && j.user) { setMe(j); emit(); }
  return j;
}

async function wipeLocal() {
  for (const c of COLS) data[c].clear();
  if (!idb) return;
  const t = idb.transaction(['records', 'outbox', 'meta'], 'readwrite');
  ['records', 'outbox', 'meta'].forEach(s => t.objectStore(s).clear());
  await done(t);
  status.pending = 0; status.lastSync = null;
}

async function startSession(j) {
  // Si un autre compte utilisait cet appareil, on repart de zéro
  if (meInfo?.user?.id && meInfo.user.id !== j.user.id) await wipeLocal();
  ls.set('token', j.token);
  setMe(j);
  status.authed = true; status.error = null; emit();
  await sync();
}
export async function login(username, password) { await startSession(await api('POST', '/api/login', { username, password })); }
export async function register(code, username, password) { await startSession(await api('POST', '/api/register', { code, username, password })); }
export async function changePassword(current, next) { const j = await api('POST', '/api/password', { current, next }); ls.set('token', j.token); }
export async function logout() {
  await wipeLocal();
  ls.set('token', null); ls.set('me', null); ls.set('space', null);
  meInfo = null; currentSpace = null;
  status.authed = false; emit();
}

// ----- Synchronisation -----
export async function sync(again = false) {
  const token = ls.get('token');
  if (!token || status.syncing || !idb) return;
  status.syncing = true; emit();
  let resync = false;
  try {
    const outbox = await req(tx('outbox').getAll());
    const since = (await req(tx('meta').get('seq')))?.v || 0;
    const r = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ since, changes: outbox.map(({ key, ...r }) => r) }),
    });
    if (r.status === 401) { status.authed = false; throw new Error('Session expirée, reconnecte-toi'); }
    if (!r.ok) throw new Error('Erreur serveur ' + r.status);
    const j = await r.json();
    setMe(j);

    const allowed = new Set(spaces().map(s => s.id));
    const knownKey = (await req(tx('meta').get('spacesKey')))?.v || '';
    const newKey = [...allowed].sort().join(',');
    const t = idb.transaction(['outbox', 'records', 'meta'], 'readwrite');
    const ob = t.objectStore('outbox'), rs = t.objectStore('records');
    for (const o of outbox) {
      const cur = data[o.col]?.get(o.id);
      if (!cur || cur.updatedAt === o.updatedAt || !allowed.has(o.space)) ob.delete(o.key);
    }
    for (const rec of j.changes) {
      const { _seq, ...clean } = rec;
      const local = data[clean.col]?.get(clean.id);
      if (local && local.updatedAt > clean.updatedAt) continue;
      data[clean.col]?.set(clean.id, clean);
      rs.put({ ...clean, key: clean.col + ':' + clean.id });
    }
    // Espaces quittés : on efface leurs données de l'appareil
    for (const c of COLS) for (const [id, r] of data[c]) if (!allowed.has(r.space)) { data[c].delete(id); rs.delete(c + ':' + id); }
    // Nouvel espace rejoint : on recharge tout depuis le début
    const added = knownKey && newKey.split(',').some(s => !knownKey.split(',').includes(s));
    t.objectStore('meta').put({ k: 'seq', v: added ? 0 : j.seq });
    t.objectStore('meta').put({ k: 'spacesKey', v: newKey });
    const now = Date.now();
    t.objectStore('meta').put({ k: 'lastSync', v: now });
    await done(t);
    resync = added && !again;
    status.lastSync = now; status.error = null; status.online = true;
    await countPending();
  } catch (e) {
    status.error = e.message;
    if (e instanceof TypeError) status.online = false;
  } finally {
    status.syncing = false; emit();
  }
  if (resync) await sync(true);
}

// ----- Sauvegarde / restauration (espace courant) -----
export function exportAll() {
  return { app: 'armurerie', version: 2, space: space()?.name, exportedAt: new Date().toISOString(), data: Object.fromEntries(COLS.map(c => [c, all(c)])) };
}
export async function importAll(json) {
  if (!json?.data) throw new Error('Fichier invalide');
  for (const c of COLS) for (const r of json.data[c] || []) { const { col, updatedAt, space: _s, by, ...rest } = r; await save(c, rest); }
}
