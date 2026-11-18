// Armurerie — serveur de synchronisation multi-utilisateurs (aucune dépendance externe)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const ADMIN_USER = (process.env.ADMIN_USER || 'admin').trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || process.env.APP_PASSWORD || '';
const SECRET = process.env.APP_SECRET || '';
const PUBLIC_DIR = path.join(__dirname, 'public');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const COLLECTIONS = new Set(['items', 'purchases', 'recipes', 'batches', 'sessions', 'weapons', 'maintenance', 'adjustments']);

if (!SECRET || SECRET.length < 16) { console.error('⚠️  APP_SECRET doit être défini (au moins 16 caractères, ex. openssl rand -hex 32).'); process.exit(1); }
fs.mkdirSync(DATA_DIR, { recursive: true });

// ---------- Stockage ----------
let db = { seq: 0, records: {}, users: {}, spaces: {}, invites: {} };
if (fs.existsSync(DB_FILE)) {
  try { db = { users: {}, spaces: {}, invites: {}, ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) }; }
  catch (e) { console.error('db.json illisible', e); process.exit(1); }
}

let saveTimer = null;
function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 300); }
function saveNow() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, DB_FILE);
  const day = new Date().toISOString().slice(0, 10);
  const bdir = path.join(DATA_DIR, 'backups');
  fs.mkdirSync(bdir, { recursive: true });
  const bfile = path.join(bdir, `db-${day}.json`);
  if (!fs.existsSync(bfile)) {
    fs.copyFileSync(DB_FILE, bfile);
    const all = fs.readdirSync(bdir).filter(f => f.startsWith('db-')).sort();
    all.slice(0, Math.max(0, all.length - 14)).forEach(f => fs.unlinkSync(path.join(bdir, f)));
  }
}
process.on('SIGTERM', () => { clearTimeout(saveTimer); saveNow(); process.exit(0); });
process.on('SIGINT', () => { clearTimeout(saveTimer); saveNow(); process.exit(0); });

// ---------- Mots de passe ----------
function hashPw(pw, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.scryptSync(String(pw), salt, 64).toString('hex') };
}
function checkPw(user, pw) {
  const h = crypto.scryptSync(String(pw || ''), user.salt, 64);
  const ref = Buffer.from(user.hash, 'hex');
  return h.length === ref.length && crypto.timingSafeEqual(h, ref);
}
const rid = (n = 9) => crypto.randomBytes(n).toString('base64url');
const personalSpace = (uid) => 'p:' + uid;
const validUsername = (u) => /^[a-z0-9._-]{3,32}$/.test(u);

function createUser(username, password, role = 'user') {
  const id = rid();
  db.users[id] = { id, username, role, createdAt: Date.now(), ...hashPw(password) };
  db.spaces[personalSpace(id)] = { id: personalSpace(id), name: 'Perso', personal: true, owner: id, members: [id] };
  return db.users[id];
}
const findUser = (username) => Object.values(db.users).find(u => u.username === username);

// Premier démarrage / migration de l'ancienne version (un seul mot de passe)
if (!Object.keys(db.users).length) {
  if (!ADMIN_PASSWORD) { console.error('⚠️  Premier démarrage : définis ADMIN_PASSWORD pour créer le compte administrateur.'); process.exit(1); }
  const admin = createUser(ADMIN_USER, ADMIN_PASSWORD, 'admin');
  for (const r of Object.values(db.records)) if (!r.space) r.space = personalSpace(admin.id);
  saveNow();
  console.log(`Compte administrateur « ${ADMIN_USER} » créé.`);
}

// ---------- Jetons ----------
function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return body + '.' + crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
}
function verify(token) {
  if (!token || typeof token !== 'string') return null;
  const [body, mac] = token.split('.');
  if (!body || !mac) return null;
  const exp = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  const a = Buffer.from(mac), b = Buffer.from(exp);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    const u = db.users[p.uid];
    if (!u || p.exp < Date.now() || (u.tokenVersion || 0) !== (p.v || 0)) return null;
    return u;
  } catch { return null; }
}
const tokenFor = (u) => sign({ uid: u.id, v: u.tokenVersion || 0, exp: Date.now() + 365 * 864e5 });

const failures = new Map();
function throttled(ip) { const f = failures.get(ip); return f && f.until > Date.now(); }
function fail(ip) { const f = failures.get(ip); const n = (f?.n || 0) + 1; failures.set(ip, { n, until: n >= 5 ? Date.now() + 60_000 : 0 }); }

// ---------- Vues ----------
const userSpaces = (u) => Object.values(db.spaces).filter(s => s.members.includes(u.id));
const spaceView = (s) => ({
  id: s.id, name: s.name, personal: !!s.personal, owner: db.users[s.owner]?.username,
  members: s.members.map(id => db.users[id]?.username).filter(Boolean),
});
const me = (u) => ({ user: { id: u.id, username: u.username, role: u.role }, spaces: userSpaces(u).map(spaceView) });

// ---------- HTTP ----------
function send(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}
function readBody(req, limit = 10 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > limit) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString() || '{}')); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png',
};
const validRecord = (r) => r && typeof r === 'object' && COLLECTIONS.has(r.col) && typeof r.id === 'string' && r.id.length > 0 && r.id.length <= 64
  && typeof r.updatedAt === 'number' && isFinite(r.updatedAt) && typeof r.space === 'string';

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;
  const P = url.pathname, M = req.method;

  try {
    // ----- Public -----
    if (P === '/api/login' && M === 'POST') {
      if (throttled(ip)) return send(res, 429, { error: 'Trop de tentatives, réessaie dans une minute.' });
      const { username, password } = await readBody(req, 10_000);
      const u = findUser(String(username || '').trim().toLowerCase());
      if (!u || !checkPw(u, password)) { fail(ip); return send(res, 401, { error: 'Identifiant ou mot de passe incorrect' }); }
      failures.delete(ip);
      return send(res, 200, { token: tokenFor(u), ...me(u) });
    }
    if (P === '/api/register' && M === 'POST') {
      if (throttled(ip)) return send(res, 429, { error: 'Trop de tentatives, réessaie dans une minute.' });
      const { code, username, password } = await readBody(req, 10_000);
      const inv = db.invites[String(code || '').trim().toUpperCase()];
      if (!inv || inv.usedBy || (inv.expires && inv.expires < Date.now())) { fail(ip); return send(res, 400, { error: 'Code d\'invitation invalide ou déjà utilisé' }); }
      const name = String(username || '').trim().toLowerCase();
      if (!validUsername(name)) return send(res, 400, { error: 'Identifiant : 3 à 32 caractères (lettres, chiffres, . _ -)' });
      if (findUser(name)) return send(res, 400, { error: 'Cet identifiant est déjà pris' });
      if (String(password || '').length < 8) return send(res, 400, { error: 'Mot de passe : 8 caractères minimum' });
      const u = createUser(name, password);
      inv.usedBy = u.id; inv.usedAt = Date.now();
      if (inv.spaceId && db.spaces[inv.spaceId] && !db.spaces[inv.spaceId].members.includes(u.id)) db.spaces[inv.spaceId].members.push(u.id);
      scheduleSave();
      return send(res, 200, { token: tokenFor(u), ...me(u) });
    }

    if (P.startsWith('/api/')) {
      const user = verify((req.headers.authorization || '').replace(/^Bearer /, ''));
      if (!user) return send(res, 401, { error: 'Session expirée, reconnecte-toi' });
      const isAdmin = user.role === 'admin';

      if (P === '/api/me') return send(res, 200, me(user));

      if (P === '/api/sync' && M === 'POST') {
        const { since = 0, changes = [] } = await readBody(req);
        const mine = new Set(userSpaces(user).map(s => s.id));
        const winners = [];
        for (const r of Array.isArray(changes) ? changes : []) {
          if (!validRecord(r) || !mine.has(r.space)) continue;
          const key = r.col + ':' + r.id;
          const cur = db.records[key];
          if (cur && cur.space !== r.space) continue;          // pas de déplacement entre espaces
          if (cur && cur.updatedAt > r.updatedAt) { winners.push(cur); continue; }
          const { _seq, ...clean } = r;
          db.records[key] = { ...clean, by: user.username, _seq: ++db.seq };
        }
        if (changes.length) scheduleSave();
        const out = Object.values(db.records).filter(r => r._seq > Number(since) && mine.has(r.space));
        for (const w of winners) if (!out.includes(w)) out.push(w);
        return send(res, 200, { seq: db.seq, changes: out, ...me(user) });
      }

      if (P === '/api/password' && M === 'POST') {
        const { current, next } = await readBody(req, 10_000);
        if (!checkPw(user, current)) return send(res, 400, { error: 'Mot de passe actuel incorrect' });
        if (String(next || '').length < 8) return send(res, 400, { error: 'Nouveau mot de passe : 8 caractères minimum' });
        Object.assign(user, hashPw(next)); user.tokenVersion = (user.tokenVersion || 0) + 1;
        scheduleSave();
        return send(res, 200, { token: tokenFor(user) });
      }

      // ----- Espaces partagés -----
      if (P === '/api/spaces' && M === 'POST') {
        const name = String((await readBody(req, 10_000)).name || '').trim().slice(0, 40);
        if (!name) return send(res, 400, { error: 'Donne un nom à l\'espace' });
        const id = 's:' + rid();
        db.spaces[id] = { id, name, owner: user.id, members: [user.id] };
        scheduleSave();
        return send(res, 200, me(user));
      }
      let m;
      if ((m = P.match(/^\/api\/spaces\/([^/]+)$/))) {
        const s = db.spaces[decodeURIComponent(m[1])];
        if (!s || s.personal || !s.members.includes(user.id)) return send(res, 404, { error: 'Espace introuvable' });
        if (M === 'PATCH') {
          const name = String((await readBody(req, 10_000)).name || '').trim().slice(0, 40);
          if (name) s.name = name;
        } else if (M === 'DELETE') {
          if (s.owner !== user.id) return send(res, 403, { error: 'Seul le créateur peut supprimer l\'espace' });
          for (const [k, r] of Object.entries(db.records)) if (r.space === s.id) delete db.records[k];
          delete db.spaces[s.id];
        }
        scheduleSave();
        return send(res, 200, me(user));
      }
      if ((m = P.match(/^\/api\/spaces\/([^/]+)\/members(?:\/([^/]+))?$/))) {
        const s = db.spaces[decodeURIComponent(m[1])];
        if (!s || s.personal || !s.members.includes(user.id)) return send(res, 404, { error: 'Espace introuvable' });
        if (M === 'POST') {
          if (s.owner !== user.id) return send(res, 403, { error: 'Seul le créateur peut ajouter des membres' });
          const target = findUser(String((await readBody(req, 10_000)).username || '').trim().toLowerCase());
          if (!target) return send(res, 404, { error: 'Aucun utilisateur avec cet identifiant' });
          if (!s.members.includes(target.id)) s.members.push(target.id);
        } else if (M === 'DELETE') {
          const target = findUser(decodeURIComponent(m[2] || ''));
          if (!target) return send(res, 404, { error: 'Utilisateur introuvable' });
          if (target.id !== user.id && s.owner !== user.id) return send(res, 403, { error: 'Seul le créateur peut retirer des membres' });
          if (target.id === s.owner) return send(res, 400, { error: 'Le créateur ne peut pas quitter son espace (supprime-le)' });
          s.members = s.members.filter(id => id !== target.id);
        }
        scheduleSave();
        return send(res, 200, me(user));
      }

      // ----- Invitations -----
      if (P === '/api/invites') {
        if (M === 'GET') {
          const list = Object.values(db.invites).filter(i => !i.usedBy && (!i.expires || i.expires > Date.now()) && (isAdmin || i.createdBy === user.id))
            .map(i => ({ code: i.code, expires: i.expires, space: db.spaces[i.spaceId]?.name || null }));
          return send(res, 200, { invites: list });
        }
        if (M === 'POST') {
          const { spaceId } = await readBody(req, 10_000);
          // L'admin invite librement ; un membre peut inviter dans un espace partagé qu'il a créé
          const sp = spaceId ? db.spaces[spaceId] : null;
          if (!isAdmin && !(sp && !sp.personal && sp.owner === user.id)) return send(res, 403, { error: 'Seul l\'administrateur peut créer des invitations' });
          if (sp && (sp.personal || !sp.members.includes(user.id))) return send(res, 400, { error: 'Espace invalide' });
          const code = crypto.randomBytes(4).toString('hex').toUpperCase().replace(/(.{4})/, '$1-');
          db.invites[code] = { code, createdBy: user.id, createdAt: Date.now(), expires: Date.now() + 14 * 864e5, spaceId: sp?.id || null };
          scheduleSave();
          return send(res, 200, { code, expires: db.invites[code].expires });
        }
      }
      if ((m = P.match(/^\/api\/invites\/([^/]+)$/)) && M === 'DELETE') {
        const inv = db.invites[decodeURIComponent(m[1])];
        if (inv && (isAdmin || inv.createdBy === user.id)) { delete db.invites[inv.code]; scheduleSave(); }
        return send(res, 200, { ok: true });
      }

      // ----- Administration -----
      if (P === '/api/users' && M === 'GET') {
        if (!isAdmin) return send(res, 403, { error: 'Réservé à l\'administrateur' });
        return send(res, 200, { users: Object.values(db.users).map(u => ({ username: u.username, role: u.role, createdAt: u.createdAt })) });
      }
      if ((m = P.match(/^\/api\/users\/([^/]+)$/)) && M === 'DELETE') {
        if (!isAdmin) return send(res, 403, { error: 'Réservé à l\'administrateur' });
        const target = findUser(decodeURIComponent(m[1]));
        if (!target || target.id === user.id) return send(res, 400, { error: 'Impossible de supprimer ce compte' });
        for (const [k, r] of Object.entries(db.records)) if (r.space === personalSpace(target.id)) delete db.records[k];
        delete db.spaces[personalSpace(target.id)];
        for (const s of Object.values(db.spaces)) {
          s.members = s.members.filter(id => id !== target.id);
          if (s.owner === target.id) s.owner = s.members[0] || user.id;
          if (!s.members.length) s.members = [user.id];
        }
        delete db.users[target.id];
        scheduleSave();
        return send(res, 200, { ok: true });
      }
      if ((m = P.match(/^\/api\/users\/([^/]+)\/reset$/)) && M === 'POST') {
        if (!isAdmin) return send(res, 403, { error: 'Réservé à l\'administrateur' });
        const target = findUser(decodeURIComponent(m[1]));
        if (!target) return send(res, 404, { error: 'Utilisateur introuvable' });
        const temp = rid(6);
        Object.assign(target, hashPw(temp)); target.tokenVersion = (target.tokenVersion || 0) + 1;
        scheduleSave();
        return send(res, 200, { password: temp });
      }
      return send(res, 404, { error: 'Not found' });
    }

    // ----- Fichiers statiques -----
    const p = path.normalize(decodeURIComponent(P));
    let file = path.join(PUBLIC_DIR, p);
    if (!file.startsWith(PUBLIC_DIR)) return send(res, 403, { error: 'Forbidden' });
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(PUBLIC_DIR, 'index.html');
    const noCache = ['index.html', 'sw.js', 'manifest.webmanifest'].includes(path.basename(file));
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': noCache ? 'no-cache' : 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    });
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    console.error(e);
    send(res, 400, { error: 'Requête invalide' });
  }
});

server.listen(PORT, () => console.log(`Armurerie prête sur http://localhost:${PORT}`));
