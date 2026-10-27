import { localData } from '@/lib/localData';

// Local bookmarks stay on-device. Legacy search bookmarks remain readable so
// a saved search is not lost when URL bookmarks are added to the same store.
const KEY = 'matcha_bookmarks';
const DATA_KEY = 'bookmarks';
localData.migrateFrom(KEY, DATA_KEY);

function itemId(item) {
  return item?.url ? `url:${item.url}` : `query:${item?.q || ''}`;
}

function load() {
  try {
    const items = localData.get(DATA_KEY);
    return Array.isArray(items) ? items.filter((item) => item && (item.url || item.q)).map((item) => ({ ...item, id: item.id || itemId(item) })) : [];
  } catch { return []; }
}

function save(list) {
  localData.set(DATA_KEY, list);
  window.dispatchEvent(new Event('matcha-bookmarks-updated'));
}

function normalizeSite(input) {
  try {
    const parsed = new URL(input.url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return {
      id: `url:${parsed.href}`,
      url: parsed.href,
      title: String(input.title || parsed.hostname).trim().slice(0, 120) || parsed.hostname,
      ts: Number(input.ts) || Date.now(),
    };
  } catch { return null; }
}

export const bookmarks = {
  list: load,
  add: (input) => {
    const list = load();
    if (typeof input === 'string') {
      const q = input.trim();
      if (q && !list.some((item) => item.q === q)) list.unshift({ id: `query:${q}`, q, ts: Date.now() });
      if (q) save(list);
      return list;
    }
    const site = input && normalizeSite(input);
    if (!site) return list;
    const existing = list.findIndex((item) => item.url === site.url);
    if (existing >= 0) list[existing] = { ...list[existing], ...site, ts: list[existing].ts || site.ts };
    else list.unshift(site);
    save(list);
    return list;
  },
  update: (id, patch) => {
    const list = load();
    const index = list.findIndex((item) => item.id === id || itemId(item) === id);
    if (index < 0 || !list[index].url) return list;
    const next = normalizeSite({ ...list[index], ...patch });
    if (!next) return list;
    list[index] = next;
    save(list);
    return list;
  },
  remove: (idOrItem) => {
    const id = typeof idOrItem === 'string' ? idOrItem : itemId(idOrItem);
    const list = load().filter((item) => item.id !== id && itemId(item) !== id && item.url !== id && item.q !== id);
    save(list);
    return list;
  },
  move: (id, offset) => {
    const list = load();
    const from = list.findIndex((item) => item.id === id || itemId(item) === id);
    const to = Math.max(0, Math.min(list.length - 1, from + offset));
    if (from < 0 || to === from) return list;
    const [item] = list.splice(from, 1);
    list.splice(to, 0, item);
    save(list);
    return list;
  },
  subscribe: (fn) => {
    window.addEventListener('matcha-bookmarks-updated', fn);
    return () => window.removeEventListener('matcha-bookmarks-updated', fn);
  },
};
