import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { localData } from '@/lib/localData';

const THEMES = {
  matcha: {
    name: 'Matcha Air Green',
    swatch: '#7fa97c',
    light: {
      appBg: 'radial-gradient(circle at 28% 18%, #d7ead6, #aed0ac 58%, #82b07e)',
      glassBg: 'rgba(255,255,255,0.30)',
      glassBorder: 'rgba(255,255,255,0.62)',
      glassHighlight: 'rgba(255,255,255,0.7)',
      accent: '#4f7a4a',
      accentSoft: 'rgba(79,122,74,0.18)',
      text: '#1f3320',
      textMuted: '#516c54',
      inputBg: 'rgba(255,255,255,0.55)',
    },
    dark: {
      appBg: 'radial-gradient(circle at 28% 18%, #243b30, #1a2620 58%, #101a13)',
      glassBg: 'rgba(50,75,60,0.26)',
      glassBorder: 'rgba(150,190,160,0.28)',
      glassHighlight: 'rgba(200,230,210,0.14)',
      accent: '#7fa97c',
      accentSoft: 'rgba(127,169,124,0.20)',
      text: '#e3ece4',
      textMuted: '#9fb3a4',
      inputBg: 'rgba(18,30,22,0.55)',
    },
  },
  blizzard: {
    name: 'Blizzard Pink',
    swatch: '#ffb6c1',
    light: {
      appBg: 'radial-gradient(circle at 28% 18%, #fff0f5, #ffd9e8 58%, #ffb6c1)',
      glassBg: 'rgba(255,255,255,0.42)',
      glassBorder: 'rgba(255,255,255,0.75)',
      glassHighlight: 'rgba(255,255,255,0.75)',
      accent: '#ff6fae',
      accentSoft: 'rgba(255,111,174,0.18)',
      text: '#5a2d43',
      textMuted: '#9a5d77',
      inputBg: 'rgba(255,255,255,0.6)',
    },
    dark: {
      appBg: 'radial-gradient(circle at 28% 18%, #3a1f2e, #2a1422 58%, #1a0c16)',
      glassBg: 'rgba(255,182,203,0.16)',
      glassBorder: 'rgba(255,182,203,0.38)',
      glassHighlight: 'rgba(255,224,238,0.26)',
      accent: '#ffa3c6',
      accentSoft: 'rgba(255,163,198,0.22)',
      text: '#fce4ee',
      textMuted: '#d6a9c2',
      inputBg: 'rgba(40,20,32,0.45)',
    },
  },
  crimson: {
    name: 'Crimson Noir',
    swatch: '#b71c1c',
    light: {
      appBg: 'radial-gradient(circle at 28% 18%, #f9dede, #f0aeae 58%, #d97070)',
      glassBg: 'rgba(255,255,255,0.34)',
      glassBorder: 'rgba(255,255,255,0.64)',
      glassHighlight: 'rgba(255,255,255,0.7)',
      accent: '#a01818',
      accentSoft: 'rgba(160,24,24,0.18)',
      text: '#3a0d0d',
      textMuted: '#7a3a3a',
      inputBg: 'rgba(255,255,255,0.55)',
    },
    dark: {
      appBg: 'radial-gradient(circle at 28% 18%, #2a0a0e, #140406 58%, #070202)',
      glassBg: 'rgba(120,20,30,0.24)',
      glassBorder: 'rgba(210,64,74,0.42)',
      glassHighlight: 'rgba(255,120,130,0.2)',
      accent: '#e63946',
      accentSoft: 'rgba(230,57,70,0.22)',
      text: '#f5dfe0',
      textMuted: '#cf8a8e',
      inputBg: 'rgba(20,6,8,0.55)',
    },
  },
  midnight: {
    name: 'Midnight',
    swatch: '#8a93ff',
    light: {
      appBg: 'radial-gradient(circle at 28% 18%, #e7e9f5, #c7cbe8 58%, #9aa0c8)',
      glassBg: 'rgba(255,255,255,0.36)',
      glassBorder: 'rgba(255,255,255,0.66)',
      glassHighlight: 'rgba(255,255,255,0.72)',
      accent: '#3a3f8f',
      accentSoft: 'rgba(58,63,143,0.18)',
      text: '#1a1d33',
      textMuted: '#5a5f7a',
      inputBg: 'rgba(255,255,255,0.55)',
    },
    dark: {
      appBg: 'radial-gradient(circle at 28% 18%, #0a0a12, #050507 58%, #020203)',
      glassBg: 'rgba(30,30,46,0.42)',
      glassBorder: 'rgba(120,120,160,0.32)',
      glassHighlight: 'rgba(160,160,210,0.22)',
      accent: '#8a93ff',
      accentSoft: 'rgba(138,147,255,0.22)',
      text: '#e8e8f5',
      textMuted: '#9a9ab5',
      inputBg: 'rgba(14,14,24,0.55)',
    },
  },
  sakura: {
    name: 'Sakura Forest',
    swatch: '#f2a9b6',
    light: {
      appBg: 'radial-gradient(circle at 28% 18%, #eaf3ee, #cfe3d8 58%, #a9c4b6)',
      glassBg: 'rgba(255,255,255,0.34)',
      glassBorder: 'rgba(255,255,255,0.62)',
      glassHighlight: 'rgba(255,255,255,0.7)',
      accent: '#d97a8e',
      accentSoft: 'rgba(217,122,142,0.18)',
      text: '#1f2a24',
      textMuted: '#516b5e',
      inputBg: 'rgba(255,255,255,0.55)',
    },
    dark: {
      appBg: 'radial-gradient(circle at 28% 18%, #24332b, #1a2620 58%, #121b16)',
      glassBg: 'rgba(36,51,43,0.42)',
      glassBorder: 'rgba(140,180,160,0.26)',
      glassHighlight: 'rgba(190,225,205,0.16)',
      accent: '#f2a9b6',
      accentSoft: 'rgba(242,169,182,0.20)',
      text: '#eef3f0',
      textMuted: '#9fb3a8',
      inputBg: 'rgba(18,28,22,0.55)',
    },
  },
  honey: {
    name: 'Honey Orange',
    swatch: '#f5a623',
    light: {
      appBg: 'radial-gradient(circle at 28% 18%, #fff3e0, #ffe0b2 58%, #ffcc80)',
      glassBg: 'rgba(255,255,255,0.36)',
      glassBorder: 'rgba(255,255,255,0.66)',
      glassHighlight: 'rgba(255,255,255,0.72)',
      accent: '#e07a00',
      accentSoft: 'rgba(224,122,0,0.18)',
      text: '#3d2410',
      textMuted: '#7a5530',
      inputBg: 'rgba(255,255,255,0.55)',
    },
    dark: {
      appBg: 'radial-gradient(circle at 28% 18%, #3a2410, #2a1808 58%, #1a1004)',
      glassBg: 'rgba(60,40,16,0.32)',
      glassBorder: 'rgba(200,150,80,0.34)',
      glassHighlight: 'rgba(255,200,120,0.18)',
      accent: '#ffb74d',
      accentSoft: 'rgba(255,183,77,0.22)',
      text: '#f5e6d0',
      textMuted: '#c9a878',
      inputBg: 'rgba(30,20,8,0.55)',
    },
  },
};

function hexToRgba(hex, a) {
  const h = String(hex || '#000000').replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(n.slice(0, 2), 16) || 0;
  const g = parseInt(n.slice(2, 4), 16) || 0;
  const b = parseInt(n.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${a})`;
}

function customPalette(custom) {
  return {
    appBg: custom.bg,
    glassBg: hexToRgba(custom.accent, 0.15),
    glassBorder: hexToRgba(custom.accent, 0.45),
    glassHighlight: 'rgba(255,255,255,0.5)',
    accent: custom.accent,
    accentSoft: hexToRgba(custom.accent, 0.2),
    text: custom.text,
    textMuted: custom.text,
    inputBg: hexToRgba(custom.bg, 0.65),
  };
}

const ThemeContext = createContext(null);

const STORAGE_KEY = 'matcha_theme_settings_v3';
const DATA_KEY = 'theme_settings';
localData.migrateFrom(STORAGE_KEY, DATA_KEY);

function loadSettings() {
  try {
    const saved = localData.get(DATA_KEY);
    if (saved) return saved;
  } catch (e) { /* ignore */ }
  return null;
}

export function ThemeProvider({ children }) {
  const saved = loadSettings();
  const [themeId, setThemeId] = useState(saved?.themeId || 'matcha');
  const [mode, setMode] = useState(saved?.mode || 'dark'); // 'light' | 'dark' | 'system'
  const [appearance, setAppearance] = useState(saved?.appearance === 'transparency' ? 'transparency' : 'glass');
  const [rainbow, setRainbow] = useState(!!saved?.rainbow);
  const [snowCaps, setSnowCaps] = useState(saved?.snowCaps !== false);
  const [snowIntensity, setSnowIntensity] = useState(saved?.snowIntensity ?? 1); // 0..3 multiplier
  const [glassBlur, setGlassBlur] = useState(saved?.glassBlur ?? 16); // 0..30 px
  const [glassStrength, setGlassStrength] = useState(saved?.glassStrength ?? 45); // 0..100 liquid-glass refraction strength
  const [snowSpeed, setSnowSpeed] = useState(saved?.snowSpeed ?? 1); // 0.2..3 multiplier
  const [roundness, setRoundness] = useState(saved?.roundness ?? 18); // 0..28 px, global corner radius
  const [custom, setCustom] = useState(saved?.custom || null); // null | {bg,accent,text}
  const [systemDark, setSystemDark] = useState(
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : true
  );

  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => setSystemDark(e.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const resolved = mode === 'system' ? (systemDark ? 'dark' : 'light') : mode;
    let palette;
    let sidebarBg;
    if (custom) {
      palette = customPalette(custom);
      sidebarBg = 'rgba(8,10,14,0.78)';
    } else {
      palette = THEMES[themeId]?.[resolved] || THEMES.midnight.dark;
      sidebarBg = themeId === 'sakura'
        ? (resolved === 'dark' ? '#141d17' : '#cfe3d8')
        : (resolved === 'dark' ? 'rgba(8,10,14,0.82)' : 'rgba(18,22,26,0.6)');
    }
    root.style.setProperty('--app-bg', palette.appBg);
    root.style.setProperty('--glass-bg', palette.glassBg);
    root.style.setProperty('--glass-border', palette.glassBorder);
    root.style.setProperty('--glass-highlight', palette.glassHighlight);
    root.style.setProperty('--accent', palette.accent);
    root.style.setProperty('--accent-soft', palette.accentSoft);
    root.style.setProperty('--text', palette.text);
    root.style.setProperty('--text-muted', palette.textMuted);
    root.style.setProperty('--input-bg', palette.inputBg);
    root.style.setProperty('--sidebar-bg', sidebarBg);
    root.style.setProperty('--chassis-bg', resolved === 'dark' ? 'rgba(12,12,12,0.75)' : 'rgba(250,250,250,0.82)');
    root.style.setProperty('--tab-bg', resolved === 'dark' ? 'rgba(15,15,15,0.55)' : 'rgba(255,255,255,0.6)');
    root.style.setProperty('--frame-bg', resolved === 'dark' ? 'rgba(10,10,12,0.7)' : 'rgba(250,250,250,0.75)');
    root.style.setProperty('--bar-bg', resolved === 'dark' ? 'rgba(10,10,12,0.6)' : 'rgba(255,255,255,0.6)');
    root.style.setProperty('--glass-blur', `${glassBlur}px`);
    root.style.setProperty('--glass-distortion-strength', String(glassStrength / 100));
    root.style.setProperty('--glass-highlight-alpha', (0.06 + (glassStrength / 100) * 0.20).toFixed(3));
    root.style.setProperty('--glass-saturation', `${130 + (glassStrength / 100) * 70}%`);
    root.dataset.uiAppearance = appearance;
    root.style.setProperty('color-scheme', mode === 'light' || (mode === 'system' && !systemDark) ? 'light' : 'dark');
  }, [themeId, mode, custom, systemDark, glassBlur, glassStrength, appearance]);

  useEffect(() => {
    document.documentElement.style.setProperty('--app-roundness', `${roundness}px`);
  }, [roundness]);

  useEffect(() => {
    try {
      localData.set(DATA_KEY, { themeId, mode, appearance, rainbow, custom, snowCaps, snowIntensity, glassBlur, glassStrength, snowSpeed, roundness });
    } catch (e) { /* ignore */ }
  }, [themeId, mode, appearance, rainbow, custom, snowCaps, snowIntensity, glassBlur, glassStrength, snowSpeed, roundness]);

  const value = {
    themes: THEMES,
    themeId,
    setThemeId,
    mode,
    setMode,
    appearance,
    setAppearance,
    rainbow,
    setRainbow,
    snowCaps,
    setSnowCaps,
    snowIntensity,
    setSnowIntensity,
    glassBlur,
    setGlassBlur,
    glassStrength,
    setGlassStrength,
    snowSpeed,
    setSnowSpeed,
    roundness,
    setRoundness,
    custom,
    setCustom,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
