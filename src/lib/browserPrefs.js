// Browser-level preferences (search engine, downloads, site permissions, site data). Local-only, persisted.
import { localData } from '@/lib/localData';

const NAME = 'config';

// Tri-state permission definitions: 'allow' | 'ask' | 'block'
export const PERM_DEFS = {
  location: { label: 'Location', default: 'ask' },
  camera: { label: 'Camera', default: 'ask' },
  mic: { label: 'Microphone', default: 'ask' },
  motion: { label: 'Motion sensors', default: 'allow' },
  notifications: { label: 'Notifications', default: 'ask' },
  js: { label: 'JavaScript', default: 'allow' },
  images: { label: 'Images', default: 'allow' },
  popups: { label: 'Pop-ups and redirects', default: 'block' },
  cookies: { label: 'Cookies', default: 'allow' },
  ads: { label: 'Intrusive ads', default: 'block' },
  bgSync: { label: 'Background sync', default: 'allow' },
  sound: { label: 'Sound', default: 'allow' },
  autoDownloads: { label: 'Automatic downloads', default: 'ask' },
  clipboard: { label: 'Clipboard', default: 'ask' },
  insecure: { label: 'Insecure content', default: 'block' },
  thirdPartySignIn: { label: 'Third-party sign-in', default: 'allow' },
  fonts: { label: 'Fonts', default: 'ask' },
  pip: { label: 'Automatic picture-in-picture', default: 'ask' },
  localNet: { label: 'Local network', default: 'ask' },
};

export const PERM_KEYS = Object.keys(PERM_DEFS);

function defaultPerms() {
  const out = {};
  for (const k of PERM_KEYS) out[k] = PERM_DEFS[k].default;
  return out;
}

// Migrate old boolean perms to tri-state.
function migratePerms(stored) {
  const out = defaultPerms();
  if (!stored) return out;
  for (const k of PERM_KEYS) {
    if (k in stored) {
      const v = stored[k];
      if (v === true) out[k] = 'allow';
      else if (v === false) out[k] = 'block';
      else if (v === 'allow' || v === 'ask' || v === 'block') out[k] = v;
    }
  }
  return out;
}

const DEFAULT = { engine: 'matcha', newTabEngine: 'google', downloads: [], startup: { type: 'newtab', url: '' }, safety: { vpn: false, adBlock: true, trackerBlock: true }, proxy: { enabled: false, server: '', type: 'matcha' }, sitePerms: {}, siteData: {}, dangerBypass: {}, saveHistory: true, tabAnimation: true, showBookmarksBar: false };
let state = load();
const subs = new Set();

function load() {
  localData.migrateFrom('matcha.browser', NAME);
  return { ...DEFAULT, ...(localData.get(NAME) || {}) };
}
function save() {
  localData.set(NAME, state);
  subs.forEach((f) => f());
}

export const ENGINES = [
  { id: 'matcha', name: 'Matcha Air AI', desc: 'In-app AI search with overview' },
  { id: 'google', name: 'Google', desc: 'google.com' },
  { id: 'bing', name: 'Bing', desc: 'bing.com' },
  { id: 'duckduckgo', name: 'DuckDuckGo', desc: 'duckduckgo.com' },
  { id: 'yahoo', name: 'Yahoo', desc: 'search.yahoo.com' },
  { id: 'ecosia', name: 'Ecosia', desc: 'ecosia.org' },
  { id: 'brave', name: 'Brave Search', desc: 'search.brave.com' },
];

export function buildEngineUrl(engine, q) {
  const providers = {
    google: ['https://www.google.com/search', 'q'],
    bing: ['https://www.bing.com/search', 'q'],
    duckduckgo: ['https://duckduckgo.com/', 'q'],
    yahoo: ['https://search.yahoo.com/search', 'p'],
    ecosia: ['https://www.ecosia.org/search', 'q'],
    brave: ['https://search.brave.com/search', 'q'],
  };
  const [endpoint, parameter] = providers[engine] || providers.google;
  const url = new URL(endpoint);
  url.searchParams.set(parameter, String(q || '').trim());
  return url.href;
}

function stableDownloadId(download, index) {
  return download.id || `download_${download.date || download.timestamp || 0}_${index}_${Math.random().toString(36).slice(2, 8)}`;
}

function ensureDownloadIds() {
  const current = Array.isArray(state.downloads) ? state.downloads : [];
  if (current.every((download) => download.id)) return current;
  const downloads = current.map((download, index) => ({ ...download, id: stableDownloadId(download, index) }));
  state = { ...state, downloads };
  save();
  return downloads;
}

export const browserPrefs = {
  getEngine: () => state.engine || 'matcha',
  setEngine: (e) => { state = { ...state, engine: e }; save(); },
  getNewTabEngine: () => state.newTabEngine || 'google',
  setNewTabEngine: (e) => { state = { ...state, newTabEngine: e }; save(); },
  getDownloads: () => ensureDownloadIds(),
  addDownload: (download) => { state = { ...state, downloads: [{ ...download, id: download.id || stableDownloadId(download, 0) }, ...ensureDownloadIds()].slice(0, 50) }; save(); },
  updateDownload: (id, patch) => {
    const downloads = [...ensureDownloadIds()];
    const index = downloads.findIndex((download) => download.id === id);
    if (index < 0) return;
    downloads[index] = { ...downloads[index], ...patch };
    state = { ...state, downloads };
    save();
  },
  recordDownload: (download) => {
    const downloads = [...ensureDownloadIds()];
    const index = downloads.findIndex((item) => item.url === download.url);
    if (index >= 0) downloads[index] = { ...downloads[index], ...download, id: downloads[index].id };
    else downloads.unshift({ ...download, id: stableDownloadId(download, 0) });
    state = { ...state, downloads: downloads.slice(0, 50) };
    save();
  },
  clearDownloads: () => { state = { ...state, downloads: [] }; save(); },
  getSafety: () => state.safety,
  setSafety: (key, val) => { state = { ...state, safety: { ...state.safety, [key]: val } }; save(); },
  getProxy: () => state.proxy,
  setProxyEnabled: (val) => { state = { ...state, proxy: { ...state.proxy, enabled: val } }; save(); },
  setProxyServer: (server) => { state = { ...state, proxy: { ...state.proxy, server } }; save(); },
  setProxyType: (type) => { state = { ...state, proxy: { ...state.proxy, type } }; save(); },
  getSaveHistory: () => state.saveHistory !== false,
  setSaveHistory: (val) => { state = { ...state, saveHistory: val }; save(); },
  getTabAnimation: () => state.tabAnimation !== false,
  setTabAnimation: (val) => { state = { ...state, tabAnimation: !!val }; save(); },
  getShowBookmarksBar: () => !!state.showBookmarksBar,
  setShowBookmarksBar: (val) => { state = { ...state, showBookmarksBar: !!val }; save(); },
  getStartup: () => ({ type: state.startup?.type || 'newtab', url: state.startup?.url || '' }),
  setStartup: (patch) => { state = { ...state, startup: { ...DEFAULT.startup, ...(state.startup || {}), ...patch } }; save(); },
  getSitePerms: (host) => migratePerms((state.sitePerms || {})[host]),
  setSitePerm: (host, key, val) => {
    const sp = { ...(state.sitePerms || {}) };
    sp[host] = { ...defaultPerms(), ...migratePerms(sp[host]), [key]: val };
    state = { ...state, sitePerms: sp }; save();
  },
  resetSitePerms: (host) => {
    const sp = { ...(state.sitePerms || {}) };
    delete sp[host];
    state = { ...state, sitePerms: sp }; save();
  },
  getSiteData: (host) => (state.siteData || {})[host] || { usage: 0, cookies: 0 },
  addSiteData: (host, usageKB, cookies) => {
    const sd = { ...(state.siteData || {}) };
    const cur = sd[host] || { usage: 0, cookies: 0 };
    sd[host] = { usage: cur.usage + usageKB, cookies: cur.cookies + (cookies || 0) };
    state = { ...state, siteData: sd }; save();
  },
  deleteSiteData: (host) => {
    const sd = { ...(state.siteData || {}) };
    delete sd[host];
    state = { ...state, siteData: sd }; save();
  },
  getDangerBypass: (host) => !!(state.dangerBypass || {})[host],
  setDangerBypass: (host, val) => {
    const db = { ...(state.dangerBypass || {}) };
    if (val) db[host] = true; else delete db[host];
    state = { ...state, dangerBypass: db }; save();
  },
  subscribe: (f) => { subs.add(f); return () => subs.delete(f); },
};
