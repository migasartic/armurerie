import * as S from './store.js';
import * as C from './calc.js';

// ---------- Utilitaires ----------
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => new Date().toLocaleDateString('sv-SE');
const thisYear = () => new Date().getFullYear();
const nf = (d = 0) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtN = (v, d = 0) => nf(d).format(Number(v) || 0);
const fmtEur = (v, d) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: d ?? (Math.abs(v) < 10 && v % 1 ? 2 : 0), maximumFractionDigits: d ?? (Math.abs(v) < 10 && v % 1 ? 2 : 0) }).format(Number(v) || 0);
const fmtEur2 = (v) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v) || 0);
const fmtDate = (d, long) => {
  if (!d) return '';
  const dt = new Date(d + 'T12:00');
  const o = { day: 'numeric', month: long ? 'long' : 'short' };
  if (dt.getFullYear() !== thisYear()) o.year = 'numeric';
  return dt.toLocaleDateString('fr-FR', o);
};
const unitOf = (it) => (it?.kind === 'poudre' ? 'g' : 'pcs');
const fmtQty = (it, q) => {
  if (it?.kind === 'poudre') return Math.abs(q) >= 1000 ? fmtN(q / 1000, 2) + ' kg' : fmtN(q, 0) + ' g';
  return fmtN(q, 0);
};
const parseNum = (v) => { if (v === '' || v == null) return ''; const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.')); return isFinite(n) ? n : ''; };
const itemLabel = (it) => it ? [it.name, it.details, it.caliber && C.KINDS[it.kind] && it.kind !== 'poudre' && it.kind !== 'amorce' ? it.caliber : ''].filter(Boolean).join(' · ') : '—';
const CALIBERS = ['.22 LR', '9x19', '.38 Special', '.357 Magnum', '.40 S&W', '.45 ACP', '10mm Auto', '.44 Magnum', '.223 Rem', '5.56x45', '7.62x39', '.308 Win', '6.5 Creedmoor', '.300 Win Mag', '.30-06', '12/70', '12/76'];
let toastTimer;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200); }

// ---------- Icônes ----------
const P = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  press: '<rect x="8" y="9" width="8" height="12" rx="1.5"/><path d="M9 9V7.5C9 5 10.5 3 12 3s3 2 3 4.5V9M8 17h8"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
  wallet: '<rect x="3" y="6" width="18" height="14" rx="2.5"/><path d="M3 10h18M16 15h2"/><path d="M6 6V5a2 2 0 0 1 2-2h9"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3h2.6l2.4 12.2a1 1 0 0 0 1 .8h9.4a1 1 0 0 0 1-.8L21 7H6"/>',
  wrench: '<path d="M14.7 6.3a4 4 0 0 0 5 5L21 13l-8 8a2.8 2.8 0 0 1-4-4l8-8z" transform="rotate(0)"/><path d="M14.7 6.3 17 4a4 4 0 0 1 3 3l-2.3 2.3"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  scope: '<circle cx="12" cy="12" r="7"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4L21 8"/><path d="M21 3v5h-5"/>',
  download: '<path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v3h16v-3"/>',
  upload: '<path d="M12 21V9m0 0-4 4m4-4 4 4M4 7V4h16v3"/>',
  out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3M15 8l2 2"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
};
const ic = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${P[n] || ''}</svg>`;
const KIND_ICON = { poudre: 'drop', amorce: 'target', ogive: 'press', douille: 'press', munition: 'press' };

// ---------- État UI ----------
const ui = { stockSeg: 'comp', stockKind: 'all', atelierSeg: 'recipes', tirSeg: 'sessions', depYear: thisYear(), showEmptyBatches: false };
const route = () => (location.hash.replace('#/', '') || 'home');

// ---------- Rendu principal ----------
function render() {
  const st = S.getStatus();
  const app = $('#app');
  if (!st.authed) return renderLogin();
  const c = C.compute();
  const r = route();
  const views = { home: viewHome, stock: viewStock, atelier: viewAtelier, tir: viewTir, depenses: viewDepenses };
  const v = (views[r] || viewHome)(c);
  const tabs = [['home', 'home', 'Accueil'], ['stock', 'box', 'Stock'], ['atelier', 'press', 'Atelier'], ['tir', 'target', 'Tir'], ['depenses', 'wallet', 'Dépenses']];
  const scroll = window.scrollY;
  app.innerHTML = `<div class="shell">
    <nav class="tabbar"><div class="side-brand"><img src="/icons/icon.svg" alt="">Armurerie</div>
      ${tabs.map(([k, i, l]) => `<a class="tab ${r === k || (!views[r] && k === 'home') ? 'active' : ''}" href="#/${k}">${ic(i)}<span>${l}</span></a>`).join('')}
    </nav>
    <main class="main">${v.html}</main>
  </div>${v.fab ? `<button class="fab" data-act="${v.fab}" aria-label="Ajouter">${ic('plus')}</button>` : ''}`;
  window.scrollTo(0, scroll);
}

function syncChip() {
  const s = S.getStatus();
  let cls = '', txt = 'À jour';
  if (s.syncing) { cls = 'busy'; txt = 'Synchro…'; }
  else if (!s.online) { cls = 'off'; txt = 'Hors-ligne' + (s.pending ? ` · ${s.pending}` : ''); }
  else if (s.pending) { cls = 'off'; txt = `${s.pending} en attente`; }
  else if (s.error) { cls = 'off'; txt = 'Non synchronisé'; }
  return `<button class="sync ${cls}" data-act="syncNow"><span class="dot"></span>${txt}</button>`;
}
const spacePill = () => { const sp = S.space(); return sp ? `<button class="space-pill" data-act="spaces">${ic(sp.personal ? 'user' : 'users')}<span>${esc(sp.personal ? 'Perso' : sp.name)}</span><svg viewBox="0 0 12 8" width="10" height="8" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M1 1.5l5 5 5-5"/></svg></button>` : ''; };
const shared = () => S.space() && !S.space().personal;
const byTag = (r) => (shared() && r?.by ? ' · ' + r.by : '');
const topbar = (title, sub) => `${spacePill()}<div class="topbar"><div><h1>${title}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div><div class="top-actions">${syncChip()}<button class="icon-btn" data-act="settings" aria-label="Réglages">${ic('gear')}</button></div></div>`;
const empty = (icon, title, text, act, label) => `<div class="empty"><div class="em-ico">${ic(icon)}</div><b>${title}</b><p>${text}</p>${act ? `<button class="btn primary small" data-act="${act}">${ic('plus')}${label}</button>` : ''}</div>`;
const seg = (key, opts) => `<div class="seg">${opts.map(([v, l]) => `<button class="${ui[key] === v ? 'on' : ''}" data-act="seg" data-k="${key}" data-v="${v}">${l}</button>`).join('')}</div>`;

// ---------- Accueil ----------
function readyByCaliber(c) {
  const m = new Map();
  const key = (cal) => { const k = C.norm(cal) || '?'; if (!m.has(k)) m.set(k, { cal: cal || 'Sans calibre', reload: 0, factory: 0 }); return m.get(k); };
  for (const b of S.all('batches')) { const left = c.batchLeft.get(b.id) || 0; if (left > 0) key(b.caliber).reload += left; }
  for (const i of S.all('items')) if (i.kind === 'munition') { const q = c.itemQty.get(i.id) || 0; if (q > 0) key(i.caliber).factory += q; }
  return [...m.values()].sort((a, b) => b.reload + b.factory - (a.reload + a.factory));
}
function roundsIn(filter) { let n = 0; for (const s of S.all('sessions')) if (filter(s.date || '')) for (const l of s.lines || []) n += Number(l.qty) || 0; return n; }
function avgRoundCost(c) {
  let tot = 0, n = 0;
  for (const b of S.all('batches')) { const rc = C.roundCost(c, b); if (rc != null) { tot += rc * (Number(b.qty) || 0); n += Number(b.qty) || 0; } }
  return n ? tot / n : null;
}
function alerts(c) {
  const out = [];
  for (const i of S.all('items')) {
    const q = c.itemQty.get(i.id) || 0;
    if (q < -0.5) out.push(`<button class="alert" data-act="itemDetail" data-id="${i.id}">${ic('alert')}<div><b>${esc(i.name)}</b> : stock négatif (${fmtQty(i, q)}). Pense à corriger.</div></button>`);
    else if (Number(i.lowThreshold) > 0 && q <= Number(i.lowThreshold)) out.push(`<button class="alert" data-act="itemDetail" data-id="${i.id}">${ic('alert')}<div><b>${esc(i.name)}</b> : stock bas — ${fmtQty(i, q)} ${i.kind === 'poudre' ? '' : 'restant(e)s'}</div></button>`);
  }
  for (const w of S.all('weapons')) {
    const ms = C.weaponMaintenanceStatus(c, w);
    if (ms.due) out.push(`<button class="alert" data-act="weaponDetail" data-id="${w.id}">${ic('wrench')}<div><b>${esc(w.name)}</b> : entretien conseillé (${fmtN(ms.since)} coups depuis le dernier)</div></button>`);
  }
  return out;
}
function monthsSeries(exps, year) {
  const keys = [];
  if (year) for (let m = 1; m <= 12; m++) keys.push(`${year}-${String(m).padStart(2, '0')}`);
  else { const d = new Date(); d.setDate(1); for (let k = 11; k >= 0; k--) { const x = new Date(d.getFullYear(), d.getMonth() - k, 1); keys.push(x.toLocaleDateString('sv-SE').slice(0, 7)); } }
  const sums = new Map(keys.map(k => [k, 0]));
  for (const e of exps) { const k = (e.date || '').slice(0, 7); if (sums.has(k)) sums.set(k, sums.get(k) + e.amount); }
  return keys.map(k => ({ k, v: sums.get(k) }));
}
function monthsChart(series) {
  const max = Math.max(1, ...series.map(s => s.v));
  const cur = today().slice(0, 7);
  return `<div class="months">${series.map(s => {
    const lbl = new Date(s.k + '-15').toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '').slice(0, 3);
    return `<div class="month" title="${lbl} : ${fmtEur(s.v)}"><div class="col ${s.v > 0 ? 'has' : ''} ${s.k === cur ? 'cur' : ''}" style="height:${Math.max(2, (s.v / max) * 100)}%"></div><small>${lbl}</small></div>`;
  }).join('')}</div>`;
}
function catBars(exps) {
  const m = new Map();
  for (const e of exps) m.set(e.cat, (m.get(e.cat) || 0) + e.amount);
  const rows = [...m.entries()].sort((a, b) => b[1] - a[1]);
  if (!rows.length) return '<div class="tiny">Aucune dépense sur la période.</div>';
  const max = rows[0][1];
  return `<div class="bars">${rows.map(([k, v]) => `<div class="bar-row"><div class="bar-top"><span>${C.EXPENSE_CATS[k] || k}</span><span class="num">${fmtEur(v)}</span></div><div class="track"><i style="width:${(v / max) * 100}%;background:${C.CAT_COLORS[k] || '#888'}"></i></div></div>`).join('')}</div>`;
}
function recentActivity() {
  const ev = [];
  for (const p of S.all('purchases')) ev.push({ t: p.createdAt, date: p.date, icon: 'cart', title: p.label || S.get('items', p.itemId)?.name || 'Achat', meta: (C.EXPENSE_CATS[p.category] || 'Achat') + (p.qty && p.itemId ? ' · +' + fmtQty(S.get('items', p.itemId), p.qty) : '') + byTag(p), end: p.amount ? fmtEur(p.amount) : '', act: 'editPurchase', id: p.id });
  for (const b of S.all('batches')) ev.push({ t: b.createdAt, date: b.date, icon: 'press', title: `Lot ${b.code || ''} · ${b.caliber || ''}`, meta: (S.get('recipes', b.recipeId)?.name || 'Rechargement') + byTag(b), end: '+' + fmtN(b.qty), act: 'batchDetail', id: b.id });
  for (const s of S.all('sessions')) ev.push({ t: s.createdAt, date: s.date, icon: 'target', title: 'Séance' + (s.place ? ' · ' + s.place : ''), meta: (S.get('weapons', s.weaponId)?.name || '') + byTag(s), end: '−' + fmtN((s.lines || []).reduce((a, l) => a + (Number(l.qty) || 0), 0)), act: 'editSession', id: s.id });
  for (const m of S.all('maintenance')) ev.push({ t: m.createdAt, date: m.date, icon: 'wrench', title: m.type || 'Entretien', meta: (S.get('weapons', m.weaponId)?.name || '') + byTag(m), end: m.amount ? fmtEur(m.amount) : '', act: 'editMaintenance', id: m.id });
  return ev.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.t || 0) - (a.t || 0)).slice(0, 7);
}
const row = (o) => `<button class="row" ${o.act ? `data-act="${o.act}" data-id="${o.id}"` : ''}>
  <div class="ico" ${o.color ? `style="background:${o.color}22;color:${o.color}"` : ''}>${o.icon ? ic(o.icon) : esc(o.letter || '')}</div>
  <div class="body"><div class="title">${o.title}</div>${o.meta ? `<div class="meta">${o.meta}</div>` : ''}</div>
  ${o.end != null ? `<div class="end"><div class="big num">${o.end}</div>${o.endSmall ? `<div class="small">${o.endSmall}</div>` : ''}</div>` : ''}
</button>`;

function viewHome(c) {
  const ready = readyByCaliber(c);
  const totalReload = ready.reduce((a, r) => a + r.reload, 0), totalFactory = ready.reduce((a, r) => a + r.factory, 0);
  const y = String(thisYear());
  const exps = C.expenses();
  const yearExp = exps.filter(e => (e.date || '').startsWith(y));
  const firedYear = roundsIn(d => d.startsWith(y));
  const m30 = new Date(Date.now() - 30 * 864e5).toLocaleDateString('sv-SE');
  const fired30 = roundsIn(d => d >= m30);
  const arc = avgRoundCost(c);
  const al = alerts(c);
  const maxCal = Math.max(1, ...ready.map(r => r.reload + r.factory));
  const act = recentActivity();
  const isNew = !S.all('items').length && !S.all('weapons').length && !S.all('purchases').length;

  const html = `${topbar('Armurerie', new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }))}
  <div class="kpis home">
    <div class="kpi hero"><div class="label">Prêtes à tirer</div><div class="value num">${fmtN(totalReload + totalFactory)}</div><div class="hint">${fmtN(totalReload)} rechargées · ${fmtN(totalFactory)} du commerce</div></div>
    <div class="kpi"><div class="label">Tirées en ${y}</div><div class="value num">${fmtN(firedYear)}</div><div class="hint">${fmtN(fired30)} sur 30 jours</div></div>
    <div class="kpi"><div class="label">Dépenses ${y}</div><div class="value num">${fmtEur(yearExp.reduce((a, e) => a + e.amount, 0), 0)}</div><div class="hint">${yearExp.length} opération${yearExp.length > 1 ? 's' : ''}</div></div>
    <div class="kpi"><div class="label">Coût moyen / coup</div><div class="value num">${arc != null ? fmtEur2(arc) : '—'}</div><div class="hint">rechargé, hors douille</div></div>
  </div>
  <div class="quick">
    <button data-act="newPurchase"><span class="qi">${ic('cart')}</span>Achat</button>
    <button data-act="newBatch"><span class="qi">${ic('press')}</span>Charger</button>
    <button data-act="newSession"><span class="qi">${ic('target')}</span>Séance</button>
    <button data-act="newMaintenance"><span class="qi">${ic('wrench')}</span>Entretien</button>
  </div>
  ${isNew ? `<div class="section"><div class="card"><b>Bienvenue 👋</b><p class="muted" style="margin:6px 0 14px;font-size:14px">Commence par ajouter tes composants (poudre, amorces, ogives, douilles) avec ton stock actuel, puis tes armes. Ensuite tout se calcule tout seul : chaque lot chargé déduit les composants, chaque séance déduit les munitions et compte les coups.</p><div class="actions" style="margin:0"><button class="btn primary small" data-act="newItem">${ic('plus')}Composant</button><button class="btn small" data-act="newWeapon">${ic('plus')}Arme</button></div></div></div>` : ''}
  ${al.length ? `<div class="section"><div class="section-head"><h2>À surveiller</h2></div>${al.join('')}</div>` : ''}
  <div class="grid-2">
    <div class="section"><div class="section-head"><h2>Prêtes par calibre</h2><a class="link" href="#/stock" data-act="seg" data-k="stockSeg" data-v="ammo">Détail</a></div>
      <div class="card">${ready.length ? `<div class="bars">${ready.map(r => `<div class="bar-row"><div class="bar-top"><span>${esc(r.cal)}</span><span class="num">${fmtN(r.reload + r.factory)}</span></div><div class="track">${r.reload ? `<i style="width:${(r.reload / maxCal) * 100}%;background:var(--brass)"></i>` : ''}${r.factory ? `<i style="width:${(r.factory / maxCal) * 100}%;background:var(--green)"></i>` : ''}</div></div>`).join('')}</div>
        <div class="legend"><span><i style="background:var(--brass)"></i>Rechargées</span><span><i style="background:var(--green)"></i>Commerce</span></div>`
        : '<div class="tiny">Aucune munition prête. Charge un lot ou ajoute des munitions du commerce.</div>'}</div></div>
    <div class="section"><div class="section-head"><h2>Dépenses · 12 mois</h2><a class="link" href="#/depenses">Tout voir</a></div>
      <div class="card">${(() => { const s = monthsSeries(exps); const t = s.reduce((a, x) => a + x.v, 0); return `<div class="chart-total"><b class="num">${fmtEur(t, 0)}</b><span>≈ ${fmtEur(t / 12, 0)} / mois</span></div>${monthsChart(s)}`; })()}</div></div>
  </div>
  <div class="grid-2">
    <div class="section"><div class="section-head"><h2>Par catégorie · ${y}</h2></div><div class="card">${catBars(yearExp)}</div></div>
    <div class="section"><div class="section-head"><h2>Activité récente</h2></div>
      ${act.length ? `<div class="list">${act.map(a => row({ ...a, title: esc(a.title), meta: esc([fmtDate(a.date), a.meta].filter(Boolean).join(' · ')) })).join('')}</div>` : '<div class="card tiny">Rien pour l\'instant.</div>'}</div>
  </div>`;
  return { html };
}

// ---------- Stock ----------
function viewStock(c) {
  let body = '';
  if (ui.stockSeg === 'comp') {
    const items = S.all('items').filter(i => i.kind !== 'munition');
    const kinds = ['poudre', 'amorce', 'ogive', 'douille'];
    const chips = `<div class="chips">${[['all', 'Tout'], ...kinds.map(k => [k, C.KINDS[k].plural])].map(([k, l]) => `<button class="${ui.stockKind === k ? 'on' : ''}" data-act="seg" data-k="stockKind" data-v="${k}">${l}</button>`).join('')}</div>`;
    const groups = kinds.filter(k => ui.stockKind === 'all' || ui.stockKind === k).map(k => {
      const list = items.filter(i => i.kind === k).sort((a, b) => (a.caliber || '').localeCompare(b.caliber || '') || a.name.localeCompare(b.name));
      if (!list.length) return '';
      return `<div class="section"><div class="section-head"><h2>${C.KINDS[k].plural}</h2></div><div class="list">${list.map(i => {
        const q = c.itemQty.get(i.id) || 0;
        const low = Number(i.lowThreshold) > 0 && q <= Number(i.lowThreshold);
        return row({ act: 'itemDetail', id: i.id, icon: KIND_ICON[k], title: esc(i.name), meta: esc([i.brand, i.details, k !== 'poudre' && k !== 'amorce' ? i.caliber : ''].filter(Boolean).join(' · ')) || C.KINDS[k].label, end: fmtQty(i, q), endSmall: q < 0 ? '<span class="badge bad">négatif</span>' : low ? '<span class="badge warn">bas</span>' : (k === 'poudre' ? '' : 'pcs') });
      }).join('')}</div></div>`;
    }).join('');
    body = chips + (items.length ? groups : empty('box', 'Aucun composant', 'Ajoute ta poudre, tes amorces, ogives et douilles avec le stock que tu as déjà.', 'newItem', 'Ajouter un composant'));
  } else {
    const byCal = new Map();
    const push = (cal, html) => { const k = C.norm(cal) || '?'; if (!byCal.has(k)) byCal.set(k, { cal: cal || 'Sans calibre', rows: [], total: 0 }); byCal.get(k).rows.push(html); return byCal.get(k); };
    for (const b of S.all('batches').sort((a, b) => (b.date || '').localeCompare(a.date || ''))) {
      const left = c.batchLeft.get(b.id) || 0;
      if (left <= 0 && !ui.showEmptyBatches) continue;
      const g = push(b.caliber, row({ act: 'batchDetail', id: b.id, icon: 'press', color: '#d4a84b', title: `Lot ${esc(b.code || '')}`, meta: esc([S.get('recipes', b.recipeId)?.name, fmtDate(b.date)].filter(Boolean).join(' · ')), end: fmtN(left), endSmall: `sur ${fmtN(b.qty)}` }));
      g.total += Math.max(0, left);
    }
    for (const i of S.all('items').filter(i => i.kind === 'munition')) {
      const q = c.itemQty.get(i.id) || 0;
      if (q <= 0 && !ui.showEmptyBatches) continue;
      const g = push(i.caliber, row({ act: 'itemDetail', id: i.id, icon: 'press', color: '#7fbf8e', title: esc(i.name), meta: esc(['Commerce', i.brand, i.details].filter(Boolean).join(' · ')), end: fmtN(q), endSmall: Number(i.lowThreshold) > 0 && q <= i.lowThreshold ? '<span class="badge warn">bas</span>' : 'pcs' }));
      g.total += Math.max(0, q);
    }
    const groups = [...byCal.values()].sort((a, b) => b.total - a.total);
    body = `<div class="chips"><button class="${ui.showEmptyBatches ? 'on' : ''}" data-act="toggleEmpty">Afficher les lots épuisés</button><button data-act="newFactory">＋ Munitions du commerce</button></div>`
      + (groups.length ? groups.map(g => `<div class="section"><div class="section-head"><h2>${esc(g.cal)}</h2><span class="tiny num">${fmtN(g.total)} prêtes</span></div><div class="list">${g.rows.join('')}</div></div>`).join('')
        : empty('press', 'Aucune munition', 'Charge un lot depuis l\'Atelier, ou enregistre un achat de munitions du commerce.', 'newBatch', 'Charger un lot'));
  }
  return { html: topbar('Stock') + seg('stockSeg', [['comp', 'Composants'], ['ammo', 'Munitions']]) + body, fab: ui.stockSeg === 'comp' ? 'newItem' : 'newBatch' };
}

// ---------- Atelier ----------
function viewAtelier(c) {
  let body = '';
  if (ui.atelierSeg === 'recipes') {
    const recs = S.all('recipes').sort((a, b) => (a.caliber || '').localeCompare(b.caliber || '') || (a.name || '').localeCompare(b.name || ''));
    body = recs.length ? `<div class="grid-2" style="gap:10px">${recs.map(r => {
      const cap = C.capacity(c, r), cost = C.roundCost(c, r);
      const comp = [['Ogive', r.bulletId], ['Poudre', r.powderId], ['Amorce', r.primerId], ['Douille', r.caseId]];
      return `<div class="card" style="margin:0">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><div><div style="font-weight:650;font-size:17px">${esc(r.name || 'Recette')}</div><div class="tiny" style="margin-top:2px">${esc(r.caliber || '')}${r.oal ? ' · COL ' + fmtN(r.oal, 2) + ' mm' : ''}</div></div><span class="badge brass num">${r.chargeGr ? fmtN(r.chargeGr, 1) + ' gr' : '—'}</span></div>
        <div class="kv" style="margin:12px 0">${comp.map(([l, id]) => `<div><small>${l}</small><b style="font-size:13.5px">${esc(S.get('items', id)?.name || '—')}</b></div>`).join('')}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
          <div><div class="num" style="font-weight:650">${cap ? fmtN(cap.n) + ' possibles' : '—'}</div><div class="tiny">${cap ? 'limité par ' + cap.k : ''}${cost != null ? ' · ' + fmtEur2(cost) + '/coup' : ''}</div></div>
          <div style="display:flex;gap:8px"><button class="icon-btn" data-act="editRecipe" data-id="${r.id}" aria-label="Modifier">${ic('edit')}</button><button class="btn primary small" data-act="newBatch" data-id="${r.id}">Charger</button></div>
        </div></div>`;
    }).join('')}</div>` : empty('press', 'Aucune recette', 'Une recette = ta charge (ogive, poudre et dose, amorce, douille). Ensuite, charger un lot déduit tout du stock.', 'newRecipe', 'Créer une recette');
  } else {
    const bs = S.all('batches').sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0));
    const y = String(thisYear());
    const loadedYear = bs.filter(b => (b.date || '').startsWith(y)).reduce((a, b) => a + (Number(b.qty) || 0), 0);
    body = bs.length ? `<div class="kpis" style="margin-bottom:16px"><div class="kpi"><div class="label">Chargées en ${y}</div><div class="value num">${fmtN(loadedYear)}</div></div><div class="kpi"><div class="label">Lots</div><div class="value num">${bs.length}</div></div></div>
      <div class="list">${bs.map(b => { const left = c.batchLeft.get(b.id) || 0; return row({ act: 'batchDetail', id: b.id, icon: 'press', color: left > 0 ? '#d4a84b' : '#6d7277', title: `${esc(b.code || 'Lot')} · ${esc(b.caliber || '')}`, meta: esc([fmtDate(b.date), S.get('recipes', b.recipeId)?.name].filter(Boolean).join(' · ') + byTag(b)), end: fmtN(b.qty), endSmall: left > 0 ? `reste ${fmtN(left)}` : 'épuisé' }); }).join('')}</div>`
      : empty('press', 'Aucun lot', 'Chaque lot chargé est déduit de tes composants automatiquement.', 'newBatch', 'Charger un lot');
  }
  return { html: topbar('Atelier', 'Recettes & rechargement') + seg('atelierSeg', [['recipes', 'Recettes'], ['batches', 'Lots chargés']]) + body, fab: ui.atelierSeg === 'recipes' ? 'newRecipe' : 'newBatch' };
}

// ---------- Tir & armes ----------
function viewTir(c) {
  let body = '';
  if (ui.tirSeg === 'sessions') {
    const ss = S.all('sessions').sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0));
    const mk = today().slice(0, 7), y = String(thisYear());
    body = `<div class="kpis" style="margin-bottom:16px"><div class="kpi"><div class="label">Ce mois-ci</div><div class="value num">${fmtN(roundsIn(d => d.startsWith(mk)))}<small>coups</small></div></div><div class="kpi"><div class="label">En ${y}</div><div class="value num">${fmtN(roundsIn(d => d.startsWith(y)))}<small>coups</small></div><div class="hint">${ss.filter(s => (s.date || '').startsWith(y)).length} séances</div></div></div>`
      + (ss.length ? `<div class="list">${ss.map(s => { const n = (s.lines || []).reduce((a, l) => a + (Number(l.qty) || 0), 0); return row({ act: 'editSession', id: s.id, icon: 'target', title: esc(S.get('weapons', s.weaponId)?.name || 'Séance'), meta: esc([fmtDate(s.date), s.place].filter(Boolean).join(' · ') + byTag(s)), end: fmtN(n), endSmall: 'coups' }); }).join('')}</div>`
        : empty('target', 'Aucune séance', 'Note tes séances : les munitions sont déduites du stock et les coups comptés sur l\'arme.', 'newSession', 'Nouvelle séance'));
  } else {
    const ws = S.all('weapons').sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    body = ws.length ? `<div class="list">${ws.map(w => {
      const ms = C.weaponMaintenanceStatus(c, w);
      return row({ act: 'weaponDetail', id: w.id, icon: 'scope', title: esc(w.name), meta: esc([w.caliber, w.model].filter(Boolean).join(' · ')) + (ms.due ? ' <span class="badge warn">entretien</span>' : ''), end: fmtN(c.weaponRounds.get(w.id) || 0), endSmall: 'coups' });
    }).join('')}</div>` : empty('scope', 'Aucune arme', 'Ajoute tes armes pour suivre le nombre de coups, les entretiens et les dépenses associées.', 'newWeapon', 'Ajouter une arme');
  }
  return { html: topbar('Tir', 'Séances & armes') + seg('tirSeg', [['sessions', 'Séances'], ['weapons', 'Armes']]) + body, fab: ui.tirSeg === 'sessions' ? 'newSession' : 'newWeapon' };
}

// ---------- Dépenses ----------
function viewDepenses() {
  const exps = C.expenses();
  const years = [...new Set([thisYear(), ...exps.map(e => Number((e.date || '').slice(0, 4))).filter(Boolean)])].sort((a, b) => b - a);
  const y = ui.depYear;
  const list = y === 'all' ? exps : exps.filter(e => (e.date || '').startsWith(String(y)));
  const total = list.reduce((a, e) => a + e.amount, 0);
  const byMonth = new Map();
  for (const e of list) { const k = (e.date || '').slice(0, 7); if (!byMonth.has(k)) byMonth.set(k, []); byMonth.get(k).push(e); }
  const chips = `<div class="chips">${years.map(v => `<button class="${y === v ? 'on' : ''}" data-act="depYear" data-v="${v}">${v}</button>`).join('')}<button class="${y === 'all' ? 'on' : ''}" data-act="depYear" data-v="all">Tout</button></div>`;
  const html = topbar('Dépenses') + chips + `
    <div class="grid-2">
      <div class="card"><div class="chart-total"><b class="num">${fmtEur(total, 0)}</b><span>${list.length} opération${list.length > 1 ? 's' : ''}</span></div>${monthsChart(monthsSeries(exps, y === 'all' ? null : y))}</div>
      <div class="card">${catBars(list)}</div>
    </div>
    ${list.length ? [...byMonth.entries()].map(([k, es]) => `<div class="section"><div class="section-head"><h2>${new Date(k + '-15').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</h2><span class="tiny num">${fmtEur(es.reduce((a, e) => a + e.amount, 0))}</span></div>
      <div class="list">${es.map(e => row({ act: e.col === 'purchases' ? 'editPurchase' : 'editMaintenance', id: e.id, icon: e.col === 'maintenance' ? 'wrench' : 'cart', color: C.CAT_COLORS[e.cat], title: esc(e.label), meta: esc([fmtDate(e.date), C.EXPENSE_CATS[e.cat], S.get('weapons', e.weaponId)?.name, e.shop].filter(Boolean).join(' · ') + byTag(S.get(e.col, e.id))), end: fmtEur(e.amount) })).join('')}</div></div>`).join('')
      : `<div class="section">${empty('wallet', 'Aucune dépense', 'Tout ce que tu achètes (composants, munitions, pièces, produits d\'entretien…) apparaît ici.', 'newPurchase', 'Ajouter une dépense')}</div>`}`;
  return { html, fab: 'newPurchase' };
}

// ---------- Feuilles (modales) ----------
let closeSheet = () => {};
function openSheet({ title, body, foot = '', onMount }) {
  const root = $('#sheet-root');
  root.innerHTML = `<div class="overlay"><div class="sheet" role="dialog" aria-modal="true"><div class="sheet-head"><h3>${esc(title)}</h3><button class="icon-btn" data-close aria-label="Fermer">${ic('x')}</button></div><div class="sheet-body">${body}</div>${foot ? `<div class="sheet-foot">${foot}</div>` : ''}</div></div>`;
  const ov = root.firstElementChild;
  const close = () => { root.innerHTML = ''; document.removeEventListener('keydown', onKey); closeSheet = () => {}; };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  ov.addEventListener('click', (e) => { if (e.target === ov || e.target.closest('[data-close]')) close(); });
  closeSheet = close;
  onMount?.(ov);
  return close;
}

function opt(options, val) {
  let html = '', grp = null;
  for (const o of options) {
    if (o.group !== grp) { if (grp != null) html += '</optgroup>'; if (o.group != null) html += `<optgroup label="${esc(o.group)}">`; grp = o.group; }
    html += `<option value="${esc(o.v)}" ${String(o.v) === String(val ?? '') ? 'selected' : ''}>${esc(o.l)}</option>`;
  }
  if (grp != null) html += '</optgroup>';
  return html;
}
function fieldHtml(f, v) {
  const val = v[f.k] ?? '';
  let input;
  if (f.type === 'select') input = `<select name="${f.k}" ${f.rr ? 'data-rr' : ''}>${opt(f.options, val)}</select>`;
  else if (f.type === 'textarea') input = `<textarea name="${f.k}" placeholder="${esc(f.ph || '')}">${esc(val)}</textarea>`;
  else if (f.type === 'lines') input = linesHtml(f, v);
  else if (f.type === 'number') input = `<div class="input-wrap"><input name="${f.k}" inputmode="decimal" autocomplete="off" value="${esc(val === '' ? '' : String(val).replace('.', ','))}" placeholder="${esc(f.ph || '')}" ${f.rr ? 'data-rr' : ''} style="${f.suffix ? 'padding-right:52px' : ''}">${f.suffix ? `<span class="suffix">${esc(f.suffix)}</span>` : ''}</div>`;
  else input = `<input name="${f.k}" type="${f.type || 'text'}" value="${esc(val)}" placeholder="${esc(f.ph || '')}" ${f.list ? `list="dl-${f.k}"` : ''} autocomplete="off">${f.list ? `<datalist id="dl-${f.k}">${f.list.map(x => `<option value="${esc(x)}">`).join('')}</datalist>` : ''}`;
  return `<div class="field ${f.half ? 'half' : ''}"><label>${esc(f.label)}${f.req ? ' *' : ''}</label>${input}${f.help ? `<div class="help">${f.help}</div>` : ''}</div>`;
}
function linesHtml(f, v) {
  const lines = v[f.k]?.length ? v[f.k] : [{}];
  return `<div class="lines">${lines.map((l, i) => `<div class="line" data-line="${i}">
    <div class="full"><label>Munition</label><select data-lk="src" data-rr>${opt(f.options, l.src)}</select></div>
    <div><label>Coups tirés</label><input data-lk="qty" inputmode="numeric" value="${esc(l.qty ?? '')}" placeholder="0"></div>
    <div><label>Douilles récup.</label><input data-lk="recovered" inputmode="numeric" value="${esc(l.recovered ?? '')}" placeholder="0"></div>
    <button type="button" class="rm" data-line-rm="${i}" aria-label="Retirer">${ic('trash')}</button>
  </div>`).join('')}<button type="button" class="btn small" data-line-add>${ic('plus')}Ajouter une munition</button></div>`;
}

function openForm(cfg) {
  let values = { ...cfg.values };
  let delArmed = false;
  const foot = `${cfg.onDelete ? `<button class="btn danger" data-del style="flex:0 0 auto">${ic('trash')}</button>` : ''}<button class="btn primary" data-save>${esc(cfg.saveLabel || 'Enregistrer')}</button>`;
  openSheet({
    title: cfg.title, body: '<form class="fields" onsubmit="return false"></form><div data-pv></div>', foot,
    onMount(ov) {
      const form = $('form', ov), pv = $('[data-pv]', ov);
      const defs = () => cfg.fields(values).filter(f => !f.show || f.show(values));
      const draw = () => { form.innerHTML = defs().map(f => fieldHtml(f, values)).join(''); drawPv(); };
      const drawPv = () => { pv.innerHTML = cfg.preview ? cfg.preview(values) || '' : ''; };
      const collect = () => {
        for (const f of defs()) {
          if (f.type === 'lines') {
            values[f.k] = [...form.querySelectorAll('.line')].map(el => ({ src: $('[data-lk=src]', el).value, qty: parseNum($('[data-lk=qty]', el).value), recovered: parseNum($('[data-lk=recovered]', el).value) }));
            continue;
          }
          const el = form.querySelector(`[name="${f.k}"]`); if (!el) continue;
          values[f.k] = f.type === 'number' ? parseNum(el.value) : el.value;
        }
      };
      form.addEventListener('change', (e) => { if (e.target.matches('[data-rr]')) { collect(); cfg.onChange?.(values, e.target.name || e.target.dataset.lk); draw(); } });
      form.addEventListener('input', () => { collect(); drawPv(); });
      form.addEventListener('click', (e) => {
        const add = e.target.closest('[data-line-add]'), rm = e.target.closest('[data-line-rm]');
        if (add) { collect(); values.lines = [...(values.lines || []), {}]; draw(); }
        if (rm) { collect(); values.lines.splice(Number(rm.dataset.lineRm), 1); draw(); }
      });
      $('[data-save]', ov).addEventListener('click', async () => {
        collect();
        const miss = defs().find(f => f.req && (values[f.k] === '' || values[f.k] == null));
        if (miss) { toast(`« ${miss.label} » est requis`); return; }
        const err = cfg.validate?.(values); if (err) { toast(err); return; }
        try { await cfg.onSave(values); closeSheet(); toast('Enregistré ✓'); } catch (e) { console.error(e); toast('Erreur : ' + e.message); }
      });
      $('[data-del]', ov)?.addEventListener('click', async (e) => {
        if (!delArmed) { delArmed = true; e.currentTarget.innerHTML = 'Confirmer'; e.currentTarget.style.flex = '1'; return; }
        await cfg.onDelete(); closeSheet(); toast('Supprimé');
      });
      draw();
    },
  });
}

// ---------- Options de listes ----------
const itemOpts = (kind, blank = '— Aucun —', filterCal) => {
  const c = C.compute();
  let items = S.all('items').filter(i => i.kind === kind);
  return [{ v: '', l: blank }, ...items.sort((a, b) => (filterCal ? (C.norm(b.caliber) === C.norm(filterCal)) - (C.norm(a.caliber) === C.norm(filterCal)) : 0) || a.name.localeCompare(b.name))
    .map(i => ({ v: i.id, l: `${itemLabel(i)} (${fmtQty(i, c.itemQty.get(i.id) || 0)}${kind === 'poudre' ? '' : ' pcs'})` }))];
};
const weaponOpts = (blank = '— Aucune —') => [{ v: '', l: blank }, ...S.all('weapons').sort((a, b) => a.name.localeCompare(b.name)).map(w => ({ v: w.id, l: w.name + (w.caliber ? ' · ' + w.caliber : '') }))];
const calList = () => [...new Set([...CALIBERS, ...S.all('items').map(i => i.caliber), ...S.all('weapons').map(w => w.caliber), ...S.all('recipes').map(r => r.caliber)].filter(Boolean))];

// ---------- Formulaires métier ----------
function itemForm(item, presetKind) {
  const isNew = !item;
  openForm({
    title: isNew ? (presetKind === 'munition' ? 'Munitions du commerce' : 'Nouveau composant') : 'Modifier',
    values: item || { kind: presetKind || 'poudre' },
    fields: (v) => {
      const k = v.kind, pcs = k !== 'poudre';
      const detailsLbl = { poudre: 'Type / usage', amorce: 'Taille', ogive: 'Poids / type', douille: 'Détails', munition: 'Ogive / poids' }[k];
      const detailsPh = { poudre: 'ex. Vitesse moyenne, carabine', amorce: 'ex. Small Rifle, Large Pistol', ogive: 'ex. 168 gr HPBT', douille: 'ex. Lapua, 3e rechargement', munition: 'ex. 124 gr FMJ' }[k];
      return [
        { k: 'kind', label: 'Type', type: 'select', rr: true, options: Object.entries(C.KINDS).map(([v, o]) => ({ v, l: o.label })) },
        { k: 'name', label: 'Nom', req: true, ph: { poudre: 'ex. Vihtavuori N140', amorce: 'ex. CCI 400', ogive: 'ex. Sierra MatchKing', douille: 'ex. Lapua .308', munition: 'ex. Sellier & Bellot 9mm' }[k] },
        { k: 'brand', label: 'Marque', half: true },
        { k: 'caliber', label: 'Calibre', half: true, list: calList(), show: (v) => !['poudre', 'amorce'].includes(v.kind), req: ['ogive', 'douille', 'munition'].includes(k) },
        { k: 'details', label: detailsLbl, ph: detailsPh, half: ['poudre', 'amorce'].includes(k) },
        { k: 'lowThreshold', label: 'Alerte stock bas', type: 'number', suffix: pcs ? 'pcs' : 'g', half: true },
        { k: 'refPrice', label: pcs ? 'Prix réf. / unité' : 'Prix réf. / kg', type: 'number', suffix: '€', half: true, help: 'Sert au coût par coup tant qu\'aucun achat n\'est saisi.' },
        ...(isNew ? [{ k: 'initQty', label: 'Stock actuel', type: 'number', suffix: pcs ? 'pcs' : 'g', help: pcs ? 'Ce que tu as déjà.' : 'En grammes (1 kg = 1000 g, 1 lb ≈ 454 g).' }] : []),
        { k: 'notes', label: 'Notes', type: 'textarea' },
      ];
    },
    async onSave(v) {
      const { initQty, ...rest } = v;
      const rec = await S.save('items', rest);
      if (isNew && Number(initQty)) await S.save('adjustments', { date: today(), target: 'i:' + rec.id, delta: Number(initQty), reason: 'Stock initial' });
    },
    onDelete: isNew ? null : () => S.remove('items', item.id),
  });
}

function purchaseForm(p, preset = {}) {
  const isNew = !p;
  openForm({
    title: isNew ? 'Nouvel achat / dépense' : 'Modifier la dépense',
    values: p || { date: today(), category: 'entretien', ...preset },
    onChange(v, k) { if (k === 'category') v.itemId = ''; },
    fields: (v) => {
      const isComp = !!C.KINDS[v.category];
      const it = S.get('items', v.itemId);
      const pcs = v.category !== 'poudre';
      return [
        { k: 'date', label: 'Date', type: 'date', half: true, req: true },
        { k: 'category', label: 'Catégorie', type: 'select', rr: true, half: true, options: Object.entries(C.EXPENSE_CATS).map(([v, l]) => ({ v, l })) },
        { k: 'itemId', label: C.KINDS[v.category]?.label || 'Article', type: 'select', rr: true, show: () => isComp, options: [...itemOpts(v.category, '— Choisir —'), { v: '__new', l: '＋ Nouveau…' }], help: 'La quantité sera ajoutée au stock automatiquement.' },
        { k: 'newName', label: 'Nom du nouvel article', req: true, show: () => isComp && v.itemId === '__new', ph: 'ex. CCI 400' },
        { k: 'newCaliber', label: 'Calibre', list: calList(), show: () => isComp && v.itemId === '__new' && !['poudre', 'amorce'].includes(v.category) },
        { k: 'qty', label: 'Quantité', type: 'number', suffix: pcs ? 'pcs' : 'g', req: isComp && !!v.itemId, show: () => isComp && !!v.itemId, half: true, help: pcs ? '' : '1 kg = 1000 g' },
        { k: 'amount', label: 'Montant', type: 'number', suffix: '€', half: isComp && !!v.itemId, req: true },
        { k: 'label', label: 'Libellé', ph: isComp ? (it?.name || '') : 'ex. Huile Ballistol, ressort de rappel…', show: () => !isComp || !v.itemId },
        { k: 'weaponId', label: 'Arme concernée', type: 'select', options: weaponOpts(), show: () => ['arme', 'piece', 'entretien', 'accessoire'].includes(v.category) },
        { k: 'shop', label: 'Vendeur / armurerie', half: false },
        { k: 'notes', label: 'Notes', type: 'textarea' },
      ];
    },
    preview(v) {
      if (Number(v.qty) > 0 && Number(v.amount) > 0) {
        const pcs = v.category !== 'poudre';
        return `<div class="preview">Prix unitaire : <b>${pcs ? fmtEur2(v.amount / v.qty) + ' / pièce' : fmtEur2(v.amount / v.qty * 1000) + ' / kg'}</b></div>`;
      }
    },
    async onSave(v) {
      const { newName, newCaliber, ...rest } = v;
      if (rest.itemId === '__new') { const it = await S.save('items', { kind: rest.category, name: newName, caliber: newCaliber || '' }); rest.itemId = it.id; }
      if (!C.KINDS[rest.category]) { rest.itemId = ''; rest.qty = ''; }
      await S.save('purchases', rest);
    },
    onDelete: isNew ? null : () => S.remove('purchases', p.id),
  });
}

function recipeForm(r) {
  const isNew = !r;
  openForm({
    title: isNew ? 'Nouvelle recette' : 'Modifier la recette',
    values: r || {},
    fields: (v) => [
      { k: 'name', label: 'Nom', req: true, ph: 'ex. .308 Match 168' },
      { k: 'caliber', label: 'Calibre', req: true, list: calList(), half: true },
      { k: 'oal', label: 'COL', type: 'number', suffix: 'mm', half: true },
      { k: 'bulletId', label: 'Ogive', type: 'select', options: itemOpts('ogive', '— Aucune —', v.caliber) },
      { k: 'powderId', label: 'Poudre', type: 'select', options: itemOpts('poudre') },
      { k: 'chargeGr', label: 'Charge', type: 'number', suffix: 'gr', half: true, req: true, help: '' },
      { k: 'primerId', label: 'Amorce', type: 'select', half: true, options: itemOpts('amorce') },
      { k: 'caseId', label: 'Douille', type: 'select', options: itemOpts('douille', '— Aucune —', v.caliber) },
      { k: 'notes', label: 'Notes (vitesse, groupement, sertissage…)', type: 'textarea' },
    ],
    preview(v) {
      const c = C.compute(); const cost = C.roundCost(c, v); const cap = C.capacity(c, v);
      const g = Number(v.chargeGr) > 0 ? `${fmtN(v.chargeGr, 1)} gr = ${fmtN(v.chargeGr * C.GR_TO_G, 3)} g` : '';
      const parts = [g, cost != null ? `${fmtEur2(cost)} / coup` : '', cap ? `${fmtN(cap.n)} chargeables (limité par ${cap.k})` : ''].filter(Boolean);
      return parts.length ? `<div class="preview">${parts.join(' · ')}</div>` : '';
    },
    onSave: (v) => S.save('recipes', v),
    onDelete: isNew ? null : () => S.remove('recipes', r.id),
  });
}

function nextBatchCode(date) {
  const yy = (date || today()).slice(2, 4);
  const n = S.all('batches').filter(b => (b.code || '').startsWith('L' + yy)).length + 1;
  return `L${yy}-${String(n).padStart(3, '0')}`;
}
function batchForm(b, recipeId) {
  const isNew = !b;
  const recs = S.all('recipes');
  if (isNew && !recs.length) { toast('Crée d\'abord une recette'); recipeForm(); return; }
  const r0 = S.get('recipes', recipeId) || (recs.length === 1 ? recs[0] : null);
  openForm({
    title: isNew ? 'Charger un lot' : 'Modifier le lot',
    values: b || { date: today(), recipeId: r0?.id || '', caseId: r0?.caseId || '', code: nextBatchCode() },
    onChange(v, k) { if (k === 'recipeId') { const r = S.get('recipes', v.recipeId); v.caseId = r?.caseId || ''; } },
    fields: (v) => [
      { k: 'recipeId', label: 'Recette', type: 'select', rr: true, req: true, options: [{ v: '', l: '— Choisir —' }, ...recs.map(r => ({ v: r.id, l: `${r.name} · ${r.caliber || ''}` }))] },
      { k: 'qty', label: 'Cartouches chargées', type: 'number', req: true, half: true, ph: '100' },
      { k: 'date', label: 'Date', type: 'date', half: true },
      { k: 'caseId', label: 'Douilles utilisées', type: 'select', options: itemOpts('douille', '— Ne pas déduire —', S.get('recipes', v.recipeId)?.caliber) },
      { k: 'code', label: 'N° de lot', half: true },
      { k: 'notes', label: 'Notes', type: 'textarea' },
    ],
    preview(v) {
      const r = S.get('recipes', v.recipeId); const q = Number(v.qty) || 0;
      if (!r || !q) return '';
      const c = C.compute();
      // En édition, on « rend » d'abord la consommation du lot actuel
      const back = (id, n) => (b && id ? n : 0);
      const lines = [];
      let short = false;
      const chk = (id, need, unitFn) => {
        if (!id) return; const it = S.get('items', id); if (!it) return;
        const prevNeed = b ? (it.kind === 'poudre' ? (Number(b.qty) || 0) * b.chargeGr * C.GR_TO_G : Number(b.qty) || 0) : 0;
        const have = (c.itemQty.get(id) || 0) + ([b?.powderId, b?.primerId, b?.bulletId, b?.caseId].includes(id) ? prevNeed : 0);
        if (need > have + 0.01) short = true;
        lines.push(`${esc(it.name)} : −${unitFn(it, need)} <span style="opacity:.7">(reste ${unitFn(it, have - need)})</span>`);
      };
      chk(r.powderId, q * r.chargeGr * C.GR_TO_G, fmtQty);
      chk(r.primerId, q, fmtQty);
      chk(r.bulletId, q, fmtQty);
      chk(v.caseId, q, fmtQty);
      const cost = C.roundCost(c, r);
      return `<div class="preview ${short ? 'bad' : ''}">${short ? '<b>Stock insuffisant</b><br>' : '<b>Sera déduit du stock</b><br>'}${lines.join('<br>')}${cost != null ? `<br>Coût du lot ≈ <b>${fmtEur2(cost * q)}</b> (${fmtEur2(cost)}/coup)` : ''}</div>`;
    },
    async onSave(v) {
      const r = S.get('recipes', v.recipeId);
      const snap = b && b.recipeId === v.recipeId ? { powderId: b.powderId, chargeGr: b.chargeGr, primerId: b.primerId, bulletId: b.bulletId, caliber: b.caliber }
        : { powderId: r.powderId || '', chargeGr: Number(r.chargeGr) || 0, primerId: r.primerId || '', bulletId: r.bulletId || '', caliber: r.caliber || '' };
      await S.save('batches', { ...(b || {}), ...v, ...snap });
    },
    onDelete: isNew ? null : () => S.remove('batches', b.id),
  });
}

function sessionForm(s, preset = {}) {
  const isNew = !s;
  const c = C.compute();
  const srcOpts = (weaponId, current = []) => {
    const w = S.get('weapons', weaponId);
    const out = [{ v: '', l: '— Choisir —' }];
    const cand = [];
    for (const b of S.all('batches')) { const left = c.batchLeft.get(b.id) || 0; if (left > 0 || current.includes('b:' + b.id)) cand.push({ v: 'b:' + b.id, cal: b.caliber, l: `Lot ${b.code || ''} · ${b.caliber || ''} — reste ${fmtN(left)}` }); }
    for (const i of S.all('items').filter(i => i.kind === 'munition')) { const q = c.itemQty.get(i.id) || 0; if (q > 0 || current.includes('i:' + i.id)) cand.push({ v: 'i:' + i.id, cal: i.caliber, l: `${i.name} · ${i.caliber || ''} — ${fmtN(q)}` }); }
    const match = (x) => w?.caliber && C.norm(x.cal) === C.norm(w.caliber);
    const a = cand.filter(match), o = cand.filter(x => !match(x));
    if (a.length) out.push(...a.map(x => ({ ...x, group: 'Calibre ' + w.caliber })), ...o.map(x => ({ ...x, group: 'Autres' })));
    else out.push(...cand);
    return out;
  };
  openForm({
    title: isNew ? 'Séance de tir' : 'Modifier la séance',
    values: s ? { ...s, lines: (s.lines || []).map(l => ({ ...l })) } : { date: today(), lines: [{}], ...preset },
    fields: (v) => [
      { k: 'date', label: 'Date', type: 'date', half: true, req: true },
      { k: 'weaponId', label: 'Arme', type: 'select', half: true, rr: true, options: weaponOpts('— Aucune —') },
      { k: 'place', label: 'Lieu', ph: 'ex. Stand du club', list: [...new Set(S.all('sessions').map(x => x.place).filter(Boolean))] },
      { k: 'lines', label: 'Munitions utilisées', type: 'lines', options: srcOpts(v.weaponId, (v.lines || []).map(l => l.src)) },
      { k: 'notes', label: 'Notes (conditions, résultats…)', type: 'textarea' },
    ],
    preview(v) {
      const n = (v.lines || []).reduce((a, l) => a + (Number(l.qty) || 0), 0);
      return n ? `<div class="preview"><b>${fmtN(n)} coups</b> seront déduits du stock${v.weaponId ? ' et ajoutés au compteur de l\'arme' : ''}.</div>` : '';
    },
    validate(v) { v.lines = (v.lines || []).filter(l => l.src && Number(l.qty) > 0); if (!v.lines.length) return 'Ajoute au moins une munition avec un nombre de coups'; },
    onSave: (v) => S.save('sessions', v),
    onDelete: isNew ? null : () => S.remove('sessions', s.id),
  });
}

function weaponForm(w) {
  const isNew = !w;
  openForm({
    title: isNew ? 'Nouvelle arme' : 'Modifier l\'arme',
    values: w || { type: 'pistolet' },
    fields: () => [
      { k: 'name', label: 'Nom', req: true, ph: 'ex. CZ Shadow 2' },
      { k: 'type', label: 'Type', type: 'select', half: true, options: [['pistolet', 'Pistolet'], ['revolver', 'Revolver'], ['carabine', 'Carabine'], ['fusil', 'Fusil'], ['autre', 'Autre']].map(([v, l]) => ({ v, l })) },
      { k: 'caliber', label: 'Calibre', half: true, list: calList() },
      { k: 'model', label: 'Marque / modèle', half: true },
      { k: 'purchaseDate', label: 'Date d\'acquisition', type: 'date', half: true },
      { k: 'initialRounds', label: 'Coups déjà tirés', type: 'number', half: true, help: 'Avant d\'utiliser l\'appli' },
      { k: 'maintenanceEvery', label: 'Entretien tous les', type: 'number', suffix: 'coups', half: true, help: 'Alerte automatique' },
      { k: 'notes', label: 'Notes', type: 'textarea' },
    ],
    onSave: (v) => S.save('weapons', v),
    onDelete: isNew ? null : () => S.remove('weapons', w.id),
  });
}

function maintenanceForm(m, preset = {}) {
  const isNew = !m;
  openForm({
    title: isNew ? 'Entretien' : 'Modifier l\'entretien',
    values: m || { date: today(), type: 'Nettoyage', ...preset },
    fields: () => [
      { k: 'date', label: 'Date', type: 'date', half: true, req: true },
      { k: 'weaponId', label: 'Arme', type: 'select', half: true, req: true, options: weaponOpts('— Choisir —') },
      { k: 'type', label: 'Type', type: 'select', options: ['Nettoyage', 'Graissage', 'Remplacement de pièce', 'Révision armurier', 'Réglage / optique', 'Autre'].map(v => ({ v, l: v })) },
      { k: 'label', label: 'Détail', ph: 'ex. Ressort de rappel 13 lb' },
      { k: 'amount', label: 'Coût (optionnel)', type: 'number', suffix: '€', help: 'Si renseigné, compté dans les dépenses (catégorie Entretien).' },
      { k: 'notes', label: 'Notes', type: 'textarea' },
    ],
    onSave: (v) => S.save('maintenance', v),
    onDelete: isNew ? null : () => S.remove('maintenance', m.id),
  });
}

function adjustForm(target, label, current, it) {
  openForm({
    title: 'Corriger le stock', saveLabel: 'Corriger',
    values: { counted: Math.round(current * 100) / 100 },
    fields: () => [
      { k: 'counted', label: `Quantité réelle — ${label}`, type: 'number', req: true, suffix: it?.kind === 'poudre' ? 'g' : 'pcs', help: `Actuellement calculé : ${fmtQty(it, current)}` },
      { k: 'reason', label: 'Raison', ph: 'ex. Inventaire, perte, don…' },
    ],
    preview: (v) => v.counted !== '' ? `<div class="preview">Écart : ${(v.counted - current) >= 0 ? '+' : ''}${fmtQty(it, v.counted - current)}</div>` : '',
    onSave: (v) => S.save('adjustments', { date: today(), target, delta: v.counted - current, reason: v.reason || 'Inventaire' }),
  });
}

// ---------- Détails ----------
function itemDetail(id) {
  const it = S.get('items', id); if (!it) return;
  const c = C.compute(); const q = c.itemQty.get(id) || 0;
  const hist = C.itemHistory(c, id);
  const uc = c.unitCost.get(id);
  const usedIn = S.all('recipes').filter(r => [r.powderId, r.primerId, r.bulletId, r.caseId].includes(id));
  openSheet({
    title: it.name,
    body: `<div class="detail-hero"><div class="big num">${fmtQty(it, q)}</div><div class="cap">${C.KINDS[it.kind]?.label}${it.caliber && !['poudre', 'amorce'].includes(it.kind) ? ' · ' + esc(it.caliber) : ''}${it.kind !== 'poudre' ? ' · pièces' : ''}</div></div>
      <div class="kv">
        <div><small>Marque</small><b>${esc(it.brand || '—')}</b></div><div><small>${it.kind === 'poudre' ? 'Prix moyen / kg' : 'Prix moyen / pièce'}</small><b class="num">${uc != null ? fmtEur2(it.kind === 'poudre' ? uc * 1000 : uc) : '—'}</b></div>
        <div><small>Détails</small><b>${esc(it.details || '—')}</b></div><div><small>Alerte stock bas</small><b class="num">${it.lowThreshold ? fmtQty(it, it.lowThreshold) : '—'}</b></div>
        ${it.kind === 'poudre' && usedIn.length ? usedIn.map(r => `<div><small>${esc(r.name)}</small><b class="num">≈ ${fmtN(Math.max(0, q) / (r.chargeGr * C.GR_TO_G || 1))} cartouches</b></div>`).join('') : ''}
      </div>
      ${it.notes ? `<div class="notes">${esc(it.notes)}</div>` : ''}
      <div class="actions"><button class="btn primary" data-act="buyItem" data-id="${id}">${ic('cart')}Achat</button><button class="btn" data-act="adjustItem" data-id="${id}">Corriger</button><button class="btn" data-act="editItem" data-id="${id}">${ic('edit')}Modifier</button></div>
      <div class="section-head"><h2>Historique</h2></div>
      ${hist.length ? `<div class="list">${hist.map(h => row({ letter: h.delta >= 0 ? '+' : '−', title: esc(h.label), meta: esc(fmtDate(h.date)) + (h.amount ? ' · ' + fmtEur(h.amount) : ''), end: `<span class="${h.delta >= 0 ? 'delta-pos' : 'delta-neg'}">${h.delta >= 0 ? '+' : '−'}${fmtQty(it, Math.abs(h.delta))}</span>` })).join('')}</div>` : '<div class="tiny">Aucun mouvement.</div>'}`,
  });
}

function batchDetail(id) {
  const b = S.get('batches', id); if (!b) return;
  const c = C.compute(); const left = c.batchLeft.get(id) || 0;
  const cost = C.roundCost(c, b); const r = S.get('recipes', b.recipeId);
  const uses = [];
  for (const s of S.all('sessions')) for (const l of s.lines || []) if (l.src === 'b:' + id) uses.push({ s, l });
  openSheet({
    title: `Lot ${b.code || ''}`,
    body: `<div class="detail-hero"><div class="big num">${fmtN(left)}</div><div class="cap">restantes sur ${fmtN(b.qty)} · ${esc(b.caliber || '')}</div></div>
      <div class="kv">
        <div><small>Recette</small><b>${esc(r?.name || '—')}</b></div><div><small>Date</small><b>${fmtDate(b.date, true)}</b></div>
        <div><small>Poudre</small><b>${esc(S.get('items', b.powderId)?.name || '—')}</b></div><div><small>Charge</small><b class="num">${b.chargeGr ? fmtN(b.chargeGr, 1) + ' gr' : '—'}</b></div>
        <div><small>Ogive</small><b>${esc(S.get('items', b.bulletId)?.name || '—')}</b></div><div><small>Amorce</small><b>${esc(S.get('items', b.primerId)?.name || '—')}</b></div>
        <div><small>Douilles</small><b>${esc(S.get('items', b.caseId)?.name || '—')}</b></div><div><small>Coût / coup</small><b class="num">${cost != null ? fmtEur2(cost) : '—'}</b></div>
      </div>
      ${b.notes ? `<div class="notes">${esc(b.notes)}</div>` : ''}
      <div class="actions"><button class="btn" data-act="adjustBatch" data-id="${id}">Corriger</button><button class="btn" data-act="editBatch" data-id="${id}">${ic('edit')}Modifier</button></div>
      <div class="section-head"><h2>Utilisation</h2></div>
      ${uses.length ? `<div class="list">${uses.map(({ s, l }) => row({ icon: 'target', title: esc(S.get('weapons', s.weaponId)?.name || 'Séance'), meta: esc([fmtDate(s.date), s.place].filter(Boolean).join(' · ')), end: '−' + fmtN(l.qty), endSmall: l.recovered ? `${fmtN(l.recovered)} récup.` : '' })).join('')}</div>` : '<div class="tiny">Pas encore tiré.</div>'}`,
  });
}

function weaponDetail(id) {
  const w = S.get('weapons', id); if (!w) return;
  const c = C.compute(); const ms = C.weaponMaintenanceStatus(c, w);
  const spent = C.expenses().filter(e => e.weaponId === id);
  const ev = [];
  for (const s of S.all('sessions')) if (s.weaponId === id) ev.push({ date: s.date, icon: 'target', title: 'Séance' + (s.place ? ' · ' + s.place : ''), end: fmtN((s.lines || []).reduce((a, l) => a + (Number(l.qty) || 0), 0)), endSmall: 'coups', act: 'editSession', id: s.id });
  for (const m of S.all('maintenance')) if (m.weaponId === id) ev.push({ date: m.date, icon: 'wrench', title: m.type + (m.label ? ' · ' + m.label : ''), end: m.amount ? fmtEur(m.amount) : '', act: 'editMaintenance', id: m.id });
  for (const p of S.all('purchases')) if (p.weaponId === id) ev.push({ date: p.date, icon: 'cart', title: p.label || C.EXPENSE_CATS[p.category], end: fmtEur(p.amount), act: 'editPurchase', id: p.id });
  ev.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  openSheet({
    title: w.name,
    body: `<div class="detail-hero"><div class="big num">${fmtN(c.weaponRounds.get(id) || 0)}</div><div class="cap">coups tirés · ${esc([w.caliber, w.model].filter(Boolean).join(' · '))}</div></div>
      <div class="kv">
        <div><small>Depuis le dernier entretien</small><b class="num">${fmtN(ms.since)} coups ${ms.due ? '<span class="badge warn">à faire</span>' : ''}</b></div>
        <div><small>Dernier entretien</small><b>${ms.last ? fmtDate(ms.last.date) : '—'}</b></div>
        <div><small>Dépenses liées</small><b class="num">${fmtEur(spent.reduce((a, e) => a + e.amount, 0))}</b></div>
        <div><small>Entretien conseillé</small><b class="num">${ms.interval ? 'tous les ' + fmtN(ms.interval) : '—'}</b></div>
      </div>
      ${w.notes ? `<div class="notes">${esc(w.notes)}</div>` : ''}
      <div class="actions"><button class="btn primary" data-act="newSession" data-weapon="${id}">${ic('target')}Séance</button><button class="btn" data-act="newMaintenance" data-weapon="${id}">${ic('wrench')}Entretien</button><button class="btn" data-act="editWeapon" data-id="${id}">${ic('edit')}Modifier</button></div>
      <div class="section-head"><h2>Historique</h2></div>
      ${ev.length ? `<div class="list">${ev.map(e => row({ ...e, title: esc(e.title), meta: fmtDate(e.date) })).join('')}</div>` : '<div class="tiny">Rien pour l\'instant.</div>'}`,
  });
}

function settings() {
  const s = S.getStatus(), m = S.me(), isAdmin = m?.user?.role === 'admin';
  openSheet({
    title: 'Réglages',
    body: `<div class="account"><div class="avatar">${esc((m?.user?.username || '?')[0].toUpperCase())}</div><div><b>${esc(m?.user?.username || '')}</b><div class="tiny">${isAdmin ? 'Administrateur' : 'Utilisateur'} · ${S.spaces().length} espace${S.spaces().length > 1 ? 's' : ''}</div></div></div>
      <div class="kv">
        <div><small>Connexion</small><b>${s.online ? 'En ligne' : 'Hors-ligne'}</b></div>
        <div><small>Dernière synchro</small><b>${s.lastSync ? new Date(s.lastSync).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</b></div>
        <div><small>En attente d'envoi</small><b class="num">${s.pending}</b></div>
        <div><small>Espace affiché</small><b>${esc(S.space()?.personal ? 'Perso' : S.space()?.name || '—')}</b></div>
      </div>
      ${s.error ? `<div class="preview bad" style="margin:0 0 14px">${esc(s.error)}</div>` : ''}
      <div class="list" style="margin-bottom:14px">
        ${row({ act: 'syncNow', icon: 'refresh', title: 'Synchroniser maintenant', meta: 'Les modifs hors-ligne partent dès que le réseau revient' })}
        ${row({ act: 'spaces', icon: 'users', title: 'Espaces & partage', meta: 'Perso, stocks partagés, membres' })}
        ${row({ act: 'invites', icon: 'key', title: 'Codes d\'invitation', meta: isAdmin ? 'Inviter quelqu\'un à créer un compte' : 'Pour tes espaces partagés' })}
        ${isAdmin ? row({ act: 'users', icon: 'user', title: 'Utilisateurs', meta: 'Comptes, réinitialisation de mot de passe' }) : ''}
        ${row({ act: 'changePw', icon: 'key', title: 'Changer mon mot de passe', meta: 'Déconnecte tes autres appareils' })}
      </div>
      <div class="list" style="margin-bottom:14px">
        ${row({ act: 'exportJson', icon: 'download', title: 'Exporter une sauvegarde', meta: 'Fichier .json de l\'espace affiché' })}
        ${row({ act: 'importJson', icon: 'upload', title: 'Restaurer une sauvegarde', meta: 'Dans l\'espace affiché' })}
        ${row({ act: 'exportCsv', icon: 'download', title: 'Exporter les dépenses (CSV)', meta: 'Ouvrable dans Excel' })}
        ${row({ act: 'logout', icon: 'out', title: 'Se déconnecter', meta: s.pending ? `⚠️ ${s.pending} modif(s) pas encore envoyée(s)` : 'Efface les données de cet appareil (elles restent sur le serveur)' })}
      </div>
      <div class="tiny" style="line-height:1.5"><b style="color:var(--text-2)">Installer l'appli</b><br>iPhone : Safari → Partager → « Sur l'écran d'accueil ».<br>Android : Chrome → ⋮ → « Installer l'application ».<br>PC : icône d'installation dans la barre d'adresse.</div>`,
  });
}

// ---------- Espaces ----------
function spacesSheet() {
  const cur = S.space()?.id;
  const list = S.spaces().slice().sort((a, b) => (b.personal - a.personal) || a.name.localeCompare(b.name));
  openSheet({
    title: 'Espaces',
    body: `<p class="tiny" style="margin:0 0 12px;line-height:1.5">Chaque espace a son propre stock, ses armes et ses dépenses. <b style="color:var(--text-2)">Perso</b> n'est visible que par toi ; un espace partagé est visible et modifiable par tous ses membres.</p>
      <div class="list" style="margin-bottom:14px">${list.map(sp => `<div class="row space-row">
        <button class="space-pick" data-act="pickSpace" data-id="${esc(sp.id)}">
          <div class="ico" ${sp.id === cur ? 'style="background:var(--brass-soft);color:var(--brass)"' : ''}>${ic(sp.id === cur ? 'check' : sp.personal ? 'user' : 'users')}</div>
          <div class="body"><div class="title">${esc(sp.personal ? 'Perso' : sp.name)}</div><div class="meta">${sp.personal ? 'Visible par toi seul' : esc(sp.members.join(', '))}</div></div>
        </button>
        ${sp.personal ? '' : `<button class="btn small" data-act="manageSpace" data-id="${esc(sp.id)}">Gérer</button>`}
      </div>`).join('')}</div>
      <button class="btn block" data-act="newSpace">${ic('plus')}Créer un espace partagé</button>
      <p class="tiny" style="margin:12px 0 0;line-height:1.5">Pour rejoindre l'espace de quelqu'un, demande-lui de t'ajouter avec ton identifiant : <b style="color:var(--text-2)">${esc(S.me()?.user?.username || '')}</b>.</p>`,
  });
}

function manageSpace(id) {
  const sp = S.spaces().find(s => s.id === id); if (!sp) return;
  const mine = sp.owner === S.me()?.user?.username;
  let delArmed = false;
  openSheet({
    title: sp.name,
    body: `<div class="section-head"><h2>Membres</h2><span class="tiny">créé par ${esc(sp.owner || '?')}</span></div>
      <div class="list" style="margin-bottom:14px">${sp.members.map(u => `<div class="row"><div class="ico">${esc(u[0].toUpperCase())}</div><div class="body"><div class="title">${esc(u)}</div>${u === sp.owner ? '<div class="meta">Créateur</div>' : ''}</div>
        ${mine && u !== sp.owner ? `<button class="icon-btn" data-sp-rm="${esc(u)}" aria-label="Retirer">${ic('x')}</button>` : ''}</div>`).join('')}</div>
      ${mine ? `<div class="field" style="margin-bottom:10px"><label>Ajouter un membre (son identifiant)</label><div style="display:flex;gap:8px"><input data-sp-user placeholder="ex. marc" autocapitalize="off" autocomplete="off"><button class="btn primary" data-sp-add style="flex:none">Ajouter</button></div><div class="help">La personne doit déjà avoir un compte.</div></div>
        <button class="btn block" data-sp-invite style="margin-bottom:14px">${ic('key')}Inviter quelqu'un sans compte</button><div data-sp-code></div>` : ''}
      <div class="actions">${mine ? `<button class="btn" data-sp-rename>${ic('edit')}Renommer</button><button class="btn danger" data-sp-del>${ic('trash')}Supprimer l'espace</button>` : `<button class="btn danger" data-sp-leave>${ic('out')}Quitter l'espace</button>`}</div>`,
    onMount(ov) {
      const run = async (fn, ok) => { try { await fn(); if (ok) toast(ok); } catch (e) { toast(e.message); } };
      ov.addEventListener('click', async (e) => {
        const t = e.target.closest('button'); if (!t) return;
        const sid = encodeURIComponent(sp.id);
        if (t.matches('[data-sp-add]')) { const u = $('[data-sp-user]', ov).value.trim(); if (!u) return; await run(() => S.api('POST', `/api/spaces/${sid}/members`, { username: u }), `${u} ajouté ✓`); await S.sync(); manageSpace(id); }
        if (t.matches('[data-sp-rm]')) { await run(() => S.api('DELETE', `/api/spaces/${sid}/members/${encodeURIComponent(t.dataset.spRm)}`), 'Membre retiré'); manageSpace(id); }
        if (t.matches('[data-sp-leave]')) { await run(() => S.api('DELETE', `/api/spaces/${sid}/members/${encodeURIComponent(S.me().user.username)}`), 'Tu as quitté l\'espace'); await S.sync(); closeSheet(); }
        if (t.matches('[data-sp-rename]')) { closeSheet(); openForm({ title: 'Renommer', values: { name: sp.name }, fields: () => [{ k: 'name', label: 'Nom', req: true }], onSave: (v) => S.api('PATCH', `/api/spaces/${sid}`, { name: v.name }) }); }
        if (t.matches('[data-sp-del]')) {
          if (!delArmed) { delArmed = true; t.textContent = 'Confirmer : tout son contenu sera supprimé'; return; }
          await run(() => S.api('DELETE', `/api/spaces/${sid}`), 'Espace supprimé'); await S.sync(); closeSheet();
        }
        if (t.matches('[data-sp-invite]')) {
          await run(async () => { const j = await S.api('POST', '/api/invites', { spaceId: sp.id }); $('[data-sp-code]', ov).innerHTML = codeBox(j.code, `Valable 14 jours, une seule fois. La personne crée son compte avec ce code et rejoint directement « ${esc(sp.name)} ».`); });
        }
        if (t.matches('[data-copy]')) copyText(t.dataset.copy);
      });
    },
  });
}

const codeBox = (code, help) => `<div class="code-box"><div class="code num">${esc(code)}</div><button class="btn small" data-copy="${esc(code)}">${ic('copy')}Copier</button></div><div class="tiny" style="margin:6px 0 14px;line-height:1.5">${help}</div>`;
async function copyText(t) { try { await navigator.clipboard.writeText(t); toast('Copié ✓'); } catch { toast('Copie impossible, note le code à la main'); } }

async function invitesSheet() {
  const isAdmin = S.me()?.user?.role === 'admin';
  let list = [];
  try { list = (await S.api('GET', '/api/invites')).invites; } catch (e) { toast(e.message); return; }
  openSheet({
    title: 'Codes d\'invitation',
    body: `<p class="tiny" style="margin:0 0 12px;line-height:1.5">Donne un code à la personne : sur l'écran de connexion, elle choisit « J'ai un code d'invitation » et crée son compte. Chaque code ne sert qu'une fois et expire au bout de 14 jours.</p>
      ${isAdmin ? `<button class="btn primary block" data-inv-new style="margin-bottom:14px">${ic('plus')}Nouveau code</button>` : '<p class="tiny">Seul l\'administrateur crée des codes simples. Tu peux inviter quelqu\'un dans un de tes espaces partagés depuis Espaces → Gérer.</p>'}
      <div data-inv-out></div>
      ${list.length ? `<div class="section-head"><h2>Codes actifs</h2></div><div class="list">${list.map(i => `<div class="row"><div class="ico">${ic('key')}</div><div class="body"><div class="title num">${esc(i.code)}</div><div class="meta">${i.space ? 'Rejoint « ' + esc(i.space) + ' » · ' : ''}expire le ${new Date(i.expires).toLocaleDateString('fr-FR')}</div></div><button class="icon-btn" data-copy="${esc(i.code)}">${ic('copy')}</button><button class="icon-btn" data-inv-del="${esc(i.code)}">${ic('trash')}</button></div>`).join('')}</div>` : ''}`,
    onMount(ov) {
      ov.addEventListener('click', async (e) => {
        const t = e.target.closest('button'); if (!t) return;
        if (t.matches('[data-inv-new]')) { try { const j = await S.api('POST', '/api/invites', {}); $('[data-inv-out]', ov).innerHTML = codeBox(j.code, 'Valable 14 jours, une seule fois.'); } catch (x) { toast(x.message); } }
        if (t.matches('[data-inv-del]')) { try { await S.api('DELETE', '/api/invites/' + encodeURIComponent(t.dataset.invDel)); invitesSheet(); } catch (x) { toast(x.message); } }
        if (t.matches('[data-copy]')) copyText(t.dataset.copy);
      });
    },
  });
}

async function usersSheet() {
  let users = [];
  try { users = (await S.api('GET', '/api/users')).users; } catch (e) { toast(e.message); return; }
  const meName = S.me()?.user?.username;
  openSheet({
    title: 'Utilisateurs',
    body: `<div class="list">${users.map(u => `<div class="row"><div class="ico">${esc(u.username[0].toUpperCase())}</div><div class="body"><div class="title">${esc(u.username)}</div><div class="meta">${u.role === 'admin' ? 'Administrateur' : 'Utilisateur'} · depuis ${new Date(u.createdAt).toLocaleDateString('fr-FR')}</div></div>
      ${u.username !== meName ? `<button class="btn small" data-u-reset="${esc(u.username)}">Réinit.</button><button class="icon-btn" data-u-del="${esc(u.username)}">${ic('trash')}</button>` : ''}</div>`).join('')}</div>
      <div data-u-out style="margin-top:14px"></div>`,
    onMount(ov) {
      const armed = new Set();
      ov.addEventListener('click', async (e) => {
        const t = e.target.closest('button'); if (!t) return;
        try {
          if (t.matches('[data-u-reset]')) { const j = await S.api('POST', `/api/users/${encodeURIComponent(t.dataset.uReset)}/reset`); $('[data-u-out]', ov).innerHTML = `<div class="tiny" style="margin-bottom:6px">Mot de passe temporaire de ${esc(t.dataset.uReset)} (à changer ensuite dans ses réglages) :</div>` + codeBox(j.password, ''); }
          if (t.matches('[data-u-del]')) {
            const u = t.dataset.uDel;
            if (!armed.has(u)) { armed.add(u); t.outerHTML = `<button class="btn small danger" data-u-del="${esc(u)}">Supprimer ?</button>`; return; }
            await S.api('DELETE', '/api/users/' + encodeURIComponent(u)); toast('Compte supprimé'); usersSheet();
          }
          if (t.matches('[data-copy]')) copyText(t.dataset.copy);
        } catch (x) { toast(x.message); }
      });
    },
  });
}

function download(name, content, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ---------- Actions ----------
const actions = {
  seg: (d) => { ui[d.k] = d.v; render(); },
  toggleEmpty: () => { ui.showEmptyBatches = !ui.showEmptyBatches; render(); },
  depYear: (d) => { ui.depYear = d.v === 'all' ? 'all' : Number(d.v); render(); },
  syncNow: async () => { await S.sync(); const s = S.getStatus(); toast(s.error ? (s.online ? s.error : 'Hors-ligne — envoi dès que possible') : 'Synchronisé ✓'); },
  settings,
  newItem: () => itemForm(null, ui.stockKind !== 'all' ? ui.stockKind : 'poudre'),
  newFactory: () => itemForm(null, 'munition'),
  editItem: (d) => itemForm(S.get('items', d.id)),
  itemDetail: (d) => itemDetail(d.id),
  buyItem: (d) => { const it = S.get('items', d.id); purchaseForm(null, { category: it.kind, itemId: it.id }); },
  adjustItem: (d) => { const it = S.get('items', d.id); adjustForm('i:' + it.id, it.name, C.compute().itemQty.get(it.id) || 0, it); },
  adjustBatch: (d) => { const b = S.get('batches', d.id); adjustForm('b:' + b.id, 'Lot ' + (b.code || ''), C.compute().batchLeft.get(b.id) || 0, null); },
  newPurchase: () => purchaseForm(),
  editPurchase: (d) => purchaseForm(S.get('purchases', d.id)),
  newRecipe: () => recipeForm(),
  editRecipe: (d) => recipeForm(S.get('recipes', d.id)),
  newBatch: (d) => batchForm(null, d.id),
  editBatch: (d) => batchForm(S.get('batches', d.id)),
  batchDetail: (d) => batchDetail(d.id),
  newSession: (d) => sessionForm(null, d.weapon ? { weaponId: d.weapon } : {}),
  editSession: (d) => sessionForm(S.get('sessions', d.id)),
  newWeapon: () => weaponForm(),
  editWeapon: (d) => weaponForm(S.get('weapons', d.id)),
  weaponDetail: (d) => weaponDetail(d.id),
  newMaintenance: (d) => { if (!S.all('weapons').length) { toast('Ajoute d\'abord une arme'); weaponForm(); return; } maintenanceForm(null, d.weapon ? { weaponId: d.weapon } : {}); },
  editMaintenance: (d) => maintenanceForm(S.get('maintenance', d.id)),
  exportJson: () => download(`armurerie-${today()}.json`, JSON.stringify(S.exportAll(), null, 2), 'application/json'),
  importJson: () => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = async () => { try { await S.importAll(JSON.parse(await inp.files[0].text())); closeSheet(); toast('Sauvegarde restaurée ✓'); } catch (e) { toast('Import impossible : ' + e.message); } };
    inp.click();
  },
  exportCsv: () => {
    const rows = [['Date', 'Catégorie', 'Libellé', 'Montant', 'Arme', 'Vendeur']];
    for (const e of C.expenses()) rows.push([e.date, C.EXPENSE_CATS[e.cat], e.label, String(e.amount).replace('.', ','), S.get('weapons', e.weaponId)?.name || '', e.shop || '']);
    download(`depenses-${today()}.csv`, '﻿' + rows.map(r => r.map(x => `"${String(x ?? '').replace(/"/g, '""')}"`).join(';')).join('\n'), 'text/csv');
  },
  logout: () => { closeSheet(); S.logout(); },
  spaces: () => spacesSheet(),
  pickSpace: (d) => { S.setSpace(d.id); window.scrollTo(0, 0); toast('Espace : ' + (S.space()?.personal ? 'Perso' : S.space()?.name)); },
  manageSpace: (d) => manageSpace(d.id),
  newSpace: () => openForm({ title: 'Nouvel espace partagé', saveLabel: 'Créer', values: {}, fields: () => [{ k: 'name', label: 'Nom', req: true, ph: 'ex. Rechargement avec Marc', help: 'Tu pourras ensuite y ajouter des membres.' }],
    onSave: async (v) => { const before = new Set(S.spaces().map(s => s.id)); await S.api('POST', '/api/spaces', { name: v.name }); const n = S.spaces().find(s => !before.has(s.id)); await S.sync(); if (n) { S.setSpace(n.id); setTimeout(() => manageSpace(n.id), 50); } } }),
  invites: () => invitesSheet(),
  users: () => usersSheet(),
  changePw: () => openForm({ title: 'Changer mon mot de passe', values: {}, fields: () => [
      { k: 'current', label: 'Mot de passe actuel', type: 'password', req: true },
      { k: 'next', label: 'Nouveau mot de passe', type: 'password', req: true, help: '8 caractères minimum' },
      { k: 'next2', label: 'Confirme', type: 'password', req: true }],
    validate: (v) => v.next !== v.next2 ? 'Les mots de passe ne correspondent pas' : (v.next.length < 8 ? '8 caractères minimum' : null),
    onSave: (v) => S.changePassword(v.current, v.next) }),
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = actions[el.dataset.act];
  if (!fn) return;
  if (el.tagName === 'A' && el.dataset.act === 'seg') { ui[el.dataset.k] = el.dataset.v; return; } // laisse la navigation se faire
  e.preventDefault();
  if (el.closest('#sheet-root') && !['syncNow', 'exportJson', 'exportCsv', 'importJson', 'logout', 'invites', 'users'].includes(el.dataset.act)) closeSheet();
  fn(el.dataset);
});

// ---------- Connexion ----------
let loginMode = 'login';
function renderLogin() {
  const reg = loginMode === 'register';
  $('#app').innerHTML = `<div class="login"><form class="login-card" id="login" autocomplete="on">
    <img src="/icons/icon.svg" alt=""><h1>Armurerie</h1><p>${reg ? 'Crée ton compte avec le code reçu' : 'Stock, rechargement, tir & dépenses'}</p>
    <div class="login-fields">
      ${reg ? '<input name="code" placeholder="Code d\'invitation" autocapitalize="characters" autocomplete="off" required>' : ''}
      <input name="username" placeholder="Identifiant" autocapitalize="off" autocorrect="off" autocomplete="username" required>
      <input type="password" name="pw" placeholder="Mot de passe${reg ? ' (8 caractères min.)' : ''}" autocomplete="${reg ? 'new-password' : 'current-password'}" required>
      ${reg ? '<input type="password" name="pw2" placeholder="Confirme le mot de passe" autocomplete="new-password" required>' : ''}
    </div>
    <button class="btn primary block" type="submit">${reg ? 'Créer mon compte' : 'Se connecter'}</button>
    <div class="err"></div>
    <button type="button" class="link-btn" id="swap">${reg ? 'J\'ai déjà un compte' : 'J\'ai un code d\'invitation'}</button></form></div>`;
  $('#swap').onclick = () => { loginMode = reg ? 'login' : 'register'; renderLogin(); };
  $('#login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target, err = $('.err'); err.textContent = '';
    const btn = $('button[type=submit]', f); btn.disabled = true;
    try {
      if (reg) {
        if (f.pw.value !== f.pw2.value) throw new Error('Les mots de passe ne correspondent pas');
        await S.register(f.code.value, f.username.value, f.pw.value);
      } else await S.login(f.username.value, f.pw.value);
      loginMode = 'login';
    } catch (x) { err.textContent = x.message; btn.disabled = false; }
  });
}

// ---------- Démarrage ----------
let raf;
S.subscribe(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(render); });
window.addEventListener('hashchange', () => { window.scrollTo(0, 0); render(); S.sync(); });
await S.init();
render();
S.sync();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
