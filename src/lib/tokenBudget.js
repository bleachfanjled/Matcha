import { localData } from '@/lib/localData';

// Local 24-hour rolling token budget for the AI assistant. Usage is estimated
// client-side (≈4 chars/token) and tracked in localStorage with a sliding
// 24h window. Persisted locally only — no server-side enforcement.
const KEY = 'matcha_ai_tokens_v1';
const DATA_KEY = 'ai_tokens';
localData.migrateFrom(KEY, DATA_KEY);
const WINDOW_MS = 24 * 60 * 60 * 1000;

export const TOKEN_LIMIT = 25000;

function read() {
  try {
    const arr = localData.get(DATA_KEY) || [];
    const cutoff = Date.now() - WINDOW_MS;
    return arr.filter((e) => e.ts > cutoff);
  } catch { return []; }
}
function write(arr) { try { localData.set(DATA_KEY, arr); } catch { /* ignore */ } }

export function getUsage() { return read().reduce((s, e) => s + e.n, 0); }

export function addTokens(n) {
  const arr = read();
  arr.push({ ts: Date.now(), n: Math.max(1, Math.round(n)) });
  write(arr);
  return getUsage();
}

// Milliseconds until enough entries roll off the 24h window for usage to
// drop back under the limit (0 if already under).
export function getMsUntilReset() {
  const arr = read().slice().sort((a, b) => a.ts - b.ts);
  let total = arr.reduce((s, e) => s + e.n, 0);
  if (total < TOKEN_LIMIT) return 0;
  for (const e of arr) {
    total -= e.n;
    if (total < TOKEN_LIMIT) return Math.max(0, e.ts + WINDOW_MS - Date.now());
  }
  return 0;
}

export function estimateTokens(text) { return Math.ceil(String(text || '').length / 4); }