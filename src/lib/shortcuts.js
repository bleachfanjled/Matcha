import { localData } from '@/lib/localData';

// Local quick-launch shortcuts for the new-tab page. Stored on-device.
// Each shortcut is either a "search" (runs a web search for its name) or a
// "url" (opens a stored URL directly and shows the site's favicon).
const KEY = 'matcha_shortcuts';
const DATA_KEY = 'quick_shortcuts';
localData.migrateFrom(KEY, DATA_KEY);
const DEFAULTS = [
  { id: 'youtube', name: 'YouTube', color: '#ff0000', type: 'url', url: 'https://www.youtube.com/' },
  { id: 'discord', name: 'Discord', color: '#5865f2', type: 'url', url: 'https://discord.com/app' },
  { id: 'chatgpt', name: 'ChatGPT', color: '#10a37f', type: 'url', url: 'https://chatgpt.com/' },
  { id: 'x', name: 'X', color: '#e7e7e7', type: 'url', url: 'https://x.com/' },
  { id: 'reddit', name: 'Reddit', color: '#ff4500', type: 'url', url: 'https://www.reddit.com/' },
];

const isLegacyDefaults = (list) => Array.isArray(list) && list.length === DEFAULTS.length
  && list.every((item, index) => item?.id === DEFAULTS[index].id && item.name === DEFAULTS[index].name && item.type === 'search' && !item.url && !item.custom);

function load() {
  try {
    const value = localData.get(DATA_KEY);
    if (value) {
      if (isLegacyDefaults(value)) { localData.set(DATA_KEY, DEFAULTS); return DEFAULTS; }
      return Array.isArray(value) ? value : DEFAULTS;
    }
  } catch { /* ignore */ }
  return DEFAULTS;
}
function save(list) {
  localData.set(DATA_KEY, list);
  window.dispatchEvent(new Event('matcha-shortcuts-updated'));
}

// Public favicon URL for a given page URL (Google's favicon service).
export function faviconFor(url) {
  try {
    const host = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
  } catch { return ''; }
}

export const shortcuts = {
  list: load,
  add: (data) => {
    const l = load();
    const id = 's_' + Date.now();
    const item = { id, name: data.name, type: data.type || 'search', color: data.color || '#8a93ff', custom: true };
    if (data.url) item.url = data.url;
    l.push(item);
    save(l);
    return l;
  },
  update: (id, patch) => {
    const l = load().map((s) => (s.id === id ? { ...s, ...patch, custom: true } : s));
    save(l);
    return l;
  },
  remove: (id) => save(load().filter((s) => s.id !== id)),
  reset: () => save(DEFAULTS),
  subscribe: (fn) => {
    window.addEventListener('matcha-shortcuts-updated', fn);
    return () => window.removeEventListener('matcha-shortcuts-updated', fn);
  },
};
