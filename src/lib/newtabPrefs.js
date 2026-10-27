// Local-only preferences for the Matcha new-tab page. Stored on-device so
// backgrounds and personalization stay private and persist across sessions.
import { localData } from '@/lib/localData';

const KEYS = {
  bg: 'matcha_newtab_bg',
  scrim: 'matcha_newtab_scrim', // 0..100 overlay darkness
  blur: 'matcha_newtab_blur',   // 0..20 px background blur
  fit: 'matcha_newtab_fit',     // 'cover' | 'contain' | 'center'
};

const UPDATE_EVENT = 'matcha-newtab-prefs-updated';
const DATA_KEYS = Object.fromEntries(Object.entries(KEYS).map(([key, oldKey]) => {
  const name = `newtab_${key}`;
  localData.migrateFrom(oldKey, name);
  return [key, name];
}));

function read(key, fallback) {
  try {
    const v = localData.getString(DATA_KEYS[Object.keys(KEYS).find((name) => KEYS[name] === key)]);
    return v === null ? fallback : v;
  } catch { return fallback; }
}
function write(key, v) {
  try {
    const name = DATA_KEYS[Object.keys(KEYS).find((item) => KEYS[item] === key)];
    if (v === null || v === '' || v === undefined) localData.remove(name);
    else localData.setRaw(name, String(v));
  } catch { /* ignore */ }
}

export const newtabPrefs = {
  getBg: () => read(KEYS.bg, 'https://media.base44.com/images/public/6ac98e2d78f3aeeb4ce7213b/141126a11_generated_image.png'),
  setBg: (v) => { write(KEYS.bg, v); window.dispatchEvent(new Event(UPDATE_EVENT)); },
  getScrim: () => Number(read(KEYS.scrim, 60)) || 0,
  setScrim: (v) => { write(KEYS.scrim, v); window.dispatchEvent(new Event(UPDATE_EVENT)); },
  getBlur: () => Number(read(KEYS.blur, 0)) || 0,
  setBlur: (v) => { write(KEYS.blur, v); window.dispatchEvent(new Event(UPDATE_EVENT)); },
  getFit: () => read(KEYS.fit, 'cover'),
  setFit: (v) => { write(KEYS.fit, v); window.dispatchEvent(new Event(UPDATE_EVENT)); },
  subscribe: (fn) => {
    window.addEventListener(UPDATE_EVENT, fn);
    return () => window.removeEventListener(UPDATE_EVENT, fn);
  },
};