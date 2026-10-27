// Local search history for the Matcha browser (no iframe navigation anymore).
// All history is stored in localStorage only — never sent to any server.
// Saving can be toggled off in Settings → Privacy for maximum privacy.
import { localData } from '@/lib/localData';
import { browserPrefs } from '@/lib/browserPrefs';

const NAME = 'history';
localData.migrateFrom('matcha_search_history', NAME);

export function getSearchHistory() {
  const stored = localData.get(NAME);
  if (!Array.isArray(stored)) return [];
  return stored.map((entry) => {
    const q = typeof entry === 'string' ? entry : String(entry?.q ?? entry?.query ?? entry?.url ?? entry?.term ?? '');
    if (!q.trim()) return null;
    const rawDate = typeof entry === 'object' && entry ? (entry.ts ?? entry.timestamp ?? entry.date) : null;
    const parsedDate = rawDate ? new Date(rawDate) : new Date();
    const ts = Number.isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString();
    let type = typeof entry === 'object' && entry?.type === 'url' ? 'url' : 'search';
    if (type !== 'url') {
      try { if (['http:', 'https:'].includes(new URL(q).protocol)) type = 'url'; } catch { /* search text */ }
    }
    return { q, ts, type };
  }).filter(Boolean);
}

export function addSearchHistory(q) {
  if (!browserPrefs.getSaveHistory()) return;
  const query = String(q || '').trim();
  if (!query) return;
  const list = getSearchHistory();
  list.push({ q: query, ts: new Date().toISOString(), type: 'search' });
  if (list.length > 200) list.shift();
  localData.set(NAME, list);
  window.dispatchEvent(new Event('matcha-history-updated'));
}

export function addVisitedUrl(url) {
  if (!browserPrefs.getSaveHistory()) return;
  let parsed;
  try { parsed = new URL(url); } catch { return; }
  if (!['http:', 'https:'].includes(parsed.protocol)) return;
  const list = getSearchHistory();
  list.push({ q: parsed.href, ts: new Date().toISOString(), type: 'url' });
  if (list.length > 200) list.shift();
  localData.set(NAME, list);
  window.dispatchEvent(new Event('matcha-history-updated'));
}

export function clearSearchHistory() {
  localData.remove(NAME);
  window.dispatchEvent(new Event('matcha-history-updated'));
}
