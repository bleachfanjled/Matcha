import { localData } from '@/lib/localData';

// Local keyboard shortcut bindings for the Matcha browser.
// Each binding maps an action id to a key combo { key, mod, shift, alt }.
// "mod" means Ctrl OR Cmd (meta) — matched to the user's platform at keydown time.
const KEY = 'matcha_key_bindings_v1';
const DATA_KEY = 'keyboard_shortcuts';
localData.migrateFrom(KEY, DATA_KEY);

export const DEFAULT_BINDINGS = [
  { id: 'history',   label: 'Open History',        combo: { key: 'h', mod: true, shift: false, alt: false } },
  { id: 'ai',        label: 'Open AI Assistant',   combo: { key: 'i', mod: true, shift: false, alt: false } },
  { id: 'games',     label: 'Open Gaming Hub',     combo: { key: 'g', mod: true, shift: false, alt: false } },
  { id: 'shortcuts', label: 'Edit Shortcuts',      combo: { key: ',', mod: true, shift: false, alt: false } },
  { id: 'newtab',    label: 'New Tab',             combo: { key: 't', mod: true, shift: false, alt: false } },
  { id: 'home',      label: 'Go Home',             combo: { key: 'h', mod: true, shift: true,  alt: false } },
  { id: 'homekey',   label: 'Go Home (Alt+Home)',   combo: { key: 'Home', mod: false, shift: false, alt: true } },
  { id: 'closetab',  label: 'Close Tab',           combo: { key: 'w', mod: true, shift: false, alt: false } },
  { id: 'reopen',    label: 'Reopen Closed Tab',   combo: { key: 't', mod: true, shift: true,  alt: false } },
  { id: 'nexttab',   label: 'Next Tab',            combo: { key: 'Tab', mod: true, shift: false, alt: false } },
  { id: 'prevtab',   label: 'Previous Tab',       combo: { key: 'Tab', mod: true, shift: true,  alt: false } },
  { id: 'nexttabpage', label: 'Next Tab (Page Down)', combo: { key: 'PageDown', mod: true, shift: false, alt: false } },
  { id: 'prevtabpage', label: 'Previous Tab (Page Up)', combo: { key: 'PageUp', mod: true, shift: false, alt: false } },
  { id: 'tab1',      label: 'Go to Tab 1',         combo: { key: '1', mod: true, shift: false, alt: false } },
  { id: 'tab2',      label: 'Go to Tab 2',         combo: { key: '2', mod: true, shift: false, alt: false } },
  { id: 'tab3',      label: 'Go to Tab 3',         combo: { key: '3', mod: true, shift: false, alt: false } },
  { id: 'tab4',      label: 'Go to Tab 4',         combo: { key: '4', mod: true, shift: false, alt: false } },
  { id: 'tab5',      label: 'Go to Tab 5',         combo: { key: '5', mod: true, shift: false, alt: false } },
  { id: 'tab6',      label: 'Go to Tab 6',         combo: { key: '6', mod: true, shift: false, alt: false } },
  { id: 'tab7',      label: 'Go to Tab 7',         combo: { key: '7', mod: true, shift: false, alt: false } },
  { id: 'tab8',      label: 'Go to Tab 8',         combo: { key: '8', mod: true, shift: false, alt: false } },
  { id: 'tab9',      label: 'Go to Last Tab',      combo: { key: '9', mod: true, shift: false, alt: false } },
  { id: 'focusaddr', label: 'Focus Address Bar',   combo: { key: 'l', mod: true, shift: false, alt: false } },
  { id: 'focusaddralt', label: 'Focus Address Bar (Alt+D)', combo: { key: 'd', mod: false, shift: false, alt: true } },
  { id: 'focussearch', label: 'Focus Search / Address Bar', combo: { key: 'k', mod: true, shift: false, alt: false } },
  { id: 'find',      label: 'Find in Page',        combo: { key: 'f', mod: true, shift: false, alt: false } },
  { id: 'findnext',  label: 'Find Next',           combo: { key: 'F3', mod: false, shift: false, alt: false } },
  { id: 'findprev',  label: 'Find Previous',       combo: { key: 'F3', mod: false, shift: true, alt: false } },
  { id: 'reload',    label: 'Reload Page',         combo: { key: 'r', mod: true, shift: false, alt: false } },
  { id: 'hardreload', label: 'Hard Reload',         combo: { key: 'r', mod: true, shift: true, alt: false } },
  { id: 'reloadf5',  label: 'Reload Page (F5)',    combo: { key: 'F5', mod: false, shift: false, alt: false } },
  { id: 'zoomin',    label: 'Zoom In',             combo: { key: '=', mod: true, shift: true, alt: false } },
  { id: 'zoomout',   label: 'Zoom Out',            combo: { key: '-', mod: true, shift: false, alt: false } },
  { id: 'zoomreset', label: 'Reset Zoom',          combo: { key: '0', mod: true, shift: false, alt: false } },
  { id: 'print',     label: 'Print Page',          combo: { key: 'p', mod: true, shift: false, alt: false } },
  { id: 'fullscreen', label: 'Toggle Full Screen', combo: { key: 'F11', mod: false, shift: false, alt: false } },
  { id: 'back',      label: 'Back',               combo: { key: 'ArrowLeft', mod: false, shift: false, alt: true } },
  { id: 'forward',   label: 'Forward',            combo: { key: 'ArrowRight', mod: false, shift: false, alt: true } },
  { id: 'backmod',   label: 'Back (Command/Ctrl+[)', combo: { key: '[', mod: true, shift: false, alt: false } },
  { id: 'forwardmod', label: 'Forward (Command/Ctrl+])', combo: { key: ']', mod: true, shift: false, alt: false } },
  { id: 'downloads', label: 'Open Downloads',     combo: { key: 'j', mod: true, shift: false, alt: false } },
  { id: 'devtools',   label: 'Toggle Developer Tools', combo: { key: 'F12', mod: false, shift: false, alt: false }, native: true },
  { id: 'inspect',    label: 'Inspect Element',    combo: { key: 'i', mod: true, shift: true,  alt: false }, native: true },
  { id: 'console',    label: 'Developer Console',  combo: { key: 'j', mod: true, shift: true,  alt: false }, native: true },
  { id: 'viewsource', label: 'View Page Source',   combo: { key: 'u', mod: true, shift: false, alt: false }, native: true },
];

function merge(saved) {
  if (!Array.isArray(saved)) return DEFAULT_BINDINGS.map((b) => ({ ...b }));
  return DEFAULT_BINDINGS.map((d) => {
    const s = saved.find((b) => b.id === d.id);
    return s ? { ...d, combo: { ...d.combo, ...s.combo } } : { ...d };
  });
}
function load() {
  try { const saved = localData.get(DATA_KEY); if (saved) return merge(saved); } catch (e) { /* ignore */ }
  return DEFAULT_BINDINGS.map((b) => ({ ...b }));
}
function persist(b) {
  localData.set(DATA_KEY, b);
  window.dispatchEvent(new Event('matcha-bindings-updated'));
}

export const keyBindings = {
  list: () => load(),
  get: (id) => load().find((b) => b.id === id) || DEFAULT_BINDINGS.find((b) => b.id === id),
  set: (id, combo) => persist(load().map((b) => (b.id === id ? { ...b, combo } : b))),
  reset: () => persist(DEFAULT_BINDINGS.map((b) => ({ ...b }))),
  subscribe: (fn) => {
    const h = () => fn(load());
    window.addEventListener('matcha-bindings-updated', h);
    return () => window.removeEventListener('matcha-bindings-updated', h);
  },
};

export function comboMatches(e, combo) {
  const mod = e.ctrlKey || e.metaKey;
  if (!!combo.mod !== mod) return false;
  if (!!combo.shift !== e.shiftKey) return false;
  if (!!combo.alt !== e.altKey) return false;
  return e.key.toLowerCase() === String(combo.key).toLowerCase();
}

export function describeCombo(combo) {
  const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);
  const modLabel = isMac ? '⌘' : 'Ctrl';
  const parts = [];
  if (combo.mod) parts.push(modLabel);
  if (combo.shift) parts.push('Shift');
  if (combo.alt) parts.push('Alt');
  let k = combo.key;
  if (k === ',') k = 'Comma';
  else if (k && k.length === 1) k = k.toUpperCase();
  parts.push(k);
  return parts.join('+');
}