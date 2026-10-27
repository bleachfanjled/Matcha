import { localData } from '@/lib/localData';

// Local-only log of sites visited and the trackers they contacted. Persisted
// in localStorage and surfaced on the matcha://trackers page.
const KEY = 'matcha.trackers';
const DATA_KEY = 'trackers';
localData.migrateFrom(KEY, DATA_KEY);
let entries = load();
const subs = new Set();

function load() {
  try { return localData.get(DATA_KEY) || []; }
  catch { return []; }
}
function save() {
  try { localData.set(DATA_KEY, entries); } catch {}
  subs.forEach((f) => f());
}

export const trackerLog = {
  list: () => entries,
  // Add or refresh a site entry. Dedupes by site hostname, keeping the newest.
  add: (site, trackers, blocked) => {
    const entry = { site, trackers: Array.isArray(trackers) ? trackers : [], blocked: !!blocked, date: Date.now() };
    entries = [entry, ...entries.filter((e) => e.site !== site)].slice(0, 100);
    save();
  },
  clear: () => { entries = []; save(); },
  subscribe: (f) => { subs.add(f); return () => subs.delete(f); },
};