// Calculs : stocks, coûts, compteurs — tout est dérivé des mouvements
import { all, get } from './store.js';

export const GR_TO_G = 0.06479891;
export const KINDS = {
  poudre: { label: 'Poudre', plural: 'Poudres', unit: 'g' },
  amorce: { label: 'Amorce', plural: 'Amorces', unit: 'pcs' },
  ogive: { label: 'Ogive', plural: 'Ogives', unit: 'pcs' },
  douille: { label: 'Douille', plural: 'Douilles vides', unit: 'pcs' },
  munition: { label: 'Munition du commerce', plural: 'Munitions du commerce', unit: 'pcs' },
};
export const EXPENSE_CATS = {
  poudre: 'Poudre', amorce: 'Amorces', ogive: 'Ogives', douille: 'Douilles', munition: 'Munitions',
  arme: 'Armes', piece: 'Pièces', entretien: 'Entretien', outillage: 'Outillage rechargement',
  accessoire: 'Accessoires', licence: 'Licence / club', autre: 'Autre',
};
export const CAT_COLORS = {
  poudre: '#d4a84b', amorce: '#e07a5f', ogive: '#b08968', douille: '#e9c46a', munition: '#8ab17d',
  arme: '#6c9bd2', piece: '#9d8df1', entretien: '#5fb3a1', outillage: '#c97fb0', accessoire: '#7aa5a6',
  licence: '#a3a3a3', autre: '#6b7280',
};

export function compute() {
  const items = all('items'), purchases = all('purchases'), batches = all('batches'), sessions = all('sessions');
  const adjustments = all('adjustments'), weapons = all('weapons'), maintenance = all('maintenance');

  const itemQty = new Map(items.map(i => [i.id, 0]));
  const batchLeft = new Map(batches.map(b => [b.id, Number(b.qty) || 0]));
  const spent = new Map(), bought = new Map();
  const add = (m, k, v) => m.set(k, (m.get(k) || 0) + v);

  for (const p of purchases) if (p.itemId && itemQty.has(p.itemId)) {
    add(itemQty, p.itemId, Number(p.qty) || 0);
    add(bought, p.itemId, Number(p.qty) || 0);
    add(spent, p.itemId, Number(p.amount) || 0);
  }
  for (const a of adjustments) {
    const [t, id] = (a.target || '').split(':');
    if (t === 'i' && itemQty.has(id)) add(itemQty, id, Number(a.delta) || 0);
    if (t === 'b' && batchLeft.has(id)) add(batchLeft, id, Number(a.delta) || 0);
  }
  for (const b of batches) {
    const q = Number(b.qty) || 0;
    if (b.powderId) add(itemQty, b.powderId, -q * (Number(b.chargeGr) || 0) * GR_TO_G);
    if (b.primerId) add(itemQty, b.primerId, -q);
    if (b.bulletId) add(itemQty, b.bulletId, -q);
    if (b.caseId) add(itemQty, b.caseId, -q);
  }
  const weaponRounds = new Map(weapons.map(w => [w.id, Number(w.initialRounds) || 0]));
  for (const s of sessions) for (const l of s.lines || []) {
    const q = Number(l.qty) || 0, rec = Number(l.recovered) || 0;
    const [t, id] = (l.src || '').split(':');
    if (t === 'b') {
      add(batchLeft, id, -q);
      const b = get('batches', id);
      if (b?.caseId && rec) add(itemQty, b.caseId, rec);
    } else if (t === 'i') {
      add(itemQty, id, -q);
      const it = get('items', id);
      if (rec && it) {
        const c = items.find(x => x.kind === 'douille' && norm(x.caliber) === norm(it.caliber));
        if (c) add(itemQty, c.id, rec);
      }
    }
    if (s.weaponId) add(weaponRounds, s.weaponId, q);
  }

  // Coût unitaire (€/pcs, ou €/g pour la poudre)
  const unitCost = new Map();
  for (const i of items) {
    const b = bought.get(i.id), s = spent.get(i.id);
    if (b > 0 && s > 0) unitCost.set(i.id, s / b);
    else if (Number(i.refPrice) > 0) unitCost.set(i.id, i.kind === 'poudre' ? Number(i.refPrice) / 1000 : Number(i.refPrice));
  }
  return { itemQty, batchLeft, weaponRounds, unitCost };
}

export const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, '').replace(',', '.');

export function roundCost(c, r) {
  // r : recette ou lot (powderId, chargeGr, primerId, bulletId)
  let total = 0, known = 0;
  if (r.powderId && c.unitCost.has(r.powderId)) { total += (Number(r.chargeGr) || 0) * GR_TO_G * c.unitCost.get(r.powderId); known++; }
  if (r.primerId && c.unitCost.has(r.primerId)) { total += c.unitCost.get(r.primerId); known++; }
  if (r.bulletId && c.unitCost.has(r.bulletId)) { total += c.unitCost.get(r.bulletId); known++; }
  return known ? total : null;
}

export function capacity(c, r) {
  // Combien de cartouches peut-on encore charger avec cette recette ?
  const lim = [];
  if (r.powderId && Number(r.chargeGr) > 0) lim.push({ k: 'poudre', n: Math.floor(Math.max(0, c.itemQty.get(r.powderId) || 0) / (r.chargeGr * GR_TO_G)) });
  if (r.primerId) lim.push({ k: 'amorces', n: Math.max(0, Math.floor(c.itemQty.get(r.primerId) || 0)) });
  if (r.bulletId) lim.push({ k: 'ogives', n: Math.max(0, Math.floor(c.itemQty.get(r.bulletId) || 0)) });
  if (r.caseId) lim.push({ k: 'douilles', n: Math.max(0, Math.floor(c.itemQty.get(r.caseId) || 0)) });
  if (!lim.length) return null;
  const min = lim.reduce((a, b) => (b.n < a.n ? b : a));
  return min;
}

export function expenses() {
  // Toutes les dépenses : achats + entretiens avec un montant
  const out = all('purchases').filter(p => Number(p.amount) > 0).map(p => ({
    id: p.id, col: 'purchases', date: p.date, cat: p.category || 'autre', label: p.label || get('items', p.itemId)?.name || EXPENSE_CATS[p.category] || 'Achat',
    amount: Number(p.amount), weaponId: p.weaponId, shop: p.shop,
  }));
  for (const m of all('maintenance')) if (Number(m.amount) > 0) out.push({
    id: m.id, col: 'maintenance', date: m.date, cat: 'entretien', label: m.label || m.type || 'Entretien', amount: Number(m.amount), weaponId: m.weaponId,
  });
  return out.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

export function weaponMaintenanceStatus(c, w) {
  const last = all('maintenance').filter(m => m.weaponId === w.id).sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
  let since = 0;
  for (const s of all('sessions')) if (s.weaponId === w.id && (!last || (s.date || '') >= (last.date || '')))
    for (const l of s.lines || []) since += Number(l.qty) || 0;
  const interval = Number(w.maintenanceEvery) || 0;
  return { last, since, due: interval > 0 && since >= interval, interval };
}

export function itemHistory(c, id) {
  const ev = [];
  const it = get('items', id);
  for (const p of all('purchases')) if (p.itemId === id) ev.push({ date: p.date, label: 'Achat' + (p.shop ? ' · ' + p.shop : ''), delta: Number(p.qty) || 0, amount: p.amount });
  for (const a of all('adjustments')) if (a.target === 'i:' + id) ev.push({ date: a.date, label: 'Correction' + (a.reason ? ' · ' + a.reason : ''), delta: Number(a.delta) });
  for (const b of all('batches')) {
    const q = Number(b.qty) || 0;
    if (b.powderId === id) ev.push({ date: b.date, label: 'Lot ' + (b.code || ''), delta: -q * b.chargeGr * GR_TO_G });
    if ([b.primerId, b.bulletId, b.caseId].includes(id)) ev.push({ date: b.date, label: 'Lot ' + (b.code || ''), delta: -q });
  }
  for (const s of all('sessions')) for (const l of s.lines || []) {
    const [t, sid] = (l.src || '').split(':');
    if (t === 'i' && sid === id) ev.push({ date: s.date, label: 'Séance de tir', delta: -(Number(l.qty) || 0) });
    if (Number(l.recovered) && it?.kind === 'douille') {
      const b = t === 'b' ? get('batches', sid) : null;
      const src = t === 'i' ? get('items', sid) : null;
      if ((b && b.caseId === id) || (src && all('items').find(x => x.kind === 'douille' && norm(x.caliber) === norm(src.caliber))?.id === id))
        ev.push({ date: s.date, label: 'Douilles récupérées', delta: Number(l.recovered) });
    }
  }
  return ev.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}
