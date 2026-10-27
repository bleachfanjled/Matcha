// Local-only key-value store. Everything lives under a `data/` namespace in
// local storage (web + desktop webview). In the Tauri desktop build, each
// `data/` entry is also mirrored to a real JSON file in a `data/` folder on disk
// (best-effort, debounced) so the data is visible and backable as files.
//
// No data ever leaves the device: no database, no cloud, no Base44 entities.

import { invoke } from '@tauri-apps/api/core';

const PREFIX = 'data/';
const isTauri = () => !!(window.__TAURI__ || window.__TAURI_INTERNALS__);

let mirrorTimer = null;
const dirty = new Set();

function scheduleMirror(name) {
  if (!isTauri()) return;
  dirty.add(name);
  if (mirrorTimer) return;
  mirrorTimer = setTimeout(flushMirror, 400);
}

async function flushMirror() {
  mirrorTimer = null;
  if (dirty.size === 0) return;
  const names = Array.from(dirty);
  dirty.clear();
  for (const name of names) {
    const raw = localStorage.getItem(PREFIX + name);
    try {
      if (raw == null) await invoke('data_delete_file', { name });
      else await invoke('data_write_file', { name, content: raw });
    } catch { /* best-effort; desktop only */ }
  }
}

export const localData = {
  get(name) {
    try { return JSON.parse(localStorage.getItem(PREFIX + name) ?? 'null'); } catch { return null; }
  },
  getString(name) { return localStorage.getItem(PREFIX + name); },
  set(name, value) {
    localStorage.setItem(PREFIX + name, JSON.stringify(value));
    scheduleMirror(name);
  },
  setRaw(name, raw) {
    localStorage.setItem(PREFIX + name, raw);
    scheduleMirror(name);
  },
  remove(name) {
    localStorage.removeItem(PREFIX + name);
    scheduleMirror(name);
  },
  has(name) { return localStorage.getItem(PREFIX + name) !== null; },
  // One-time migration from a legacy non-namespaced key into the data folder.
  migrateFrom(oldKey, name) {
    if (localData.has(name)) return;
    const raw = localStorage.getItem(oldKey);
    if (raw == null) return;
    localData.setRaw(name, raw);
    localStorage.removeItem(oldKey);
  },
  flush: flushMirror,
};

if (typeof window !== 'undefined') window.addEventListener('pagehide', flushMirror);