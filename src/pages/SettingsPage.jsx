import React, { useEffect, useState } from 'react';
import SnowCapped from '@/components/SnowCapped';
import { browserPrefs, ENGINES } from '@/lib/browserPrefs';
import { useTheme } from '@/lib/themeContext';
import ShortcutsSection from '@/components/settings/ShortcutsSection';
import { Search, Check, Snowflake, Droplets, Wind, Circle, Puzzle, Camera, Languages, Globe, Gamepad2, Network, Sun, Moon, Monitor, Sparkles, Eraser, Shield, Trash2, Keyboard } from 'lucide-react';
import { clearSearchHistory } from '@/lib/searchHistory';

// matcha://settings — themes, appearance, effects, winter atmosphere,
// search engine, network, extensions, and shortcuts, all in one place
// (no duplicated controls).
function ColorField({ label, value, onChange }) {
  return (
    <label className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm" style={{ color: 'var(--text)' }}>{label}</span>
      <span className="flex items-center gap-2">
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className="frost-input w-24 text-xs px-2 py-1" spellCheck={false} />
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="color-swatch" aria-label={label} />
      </span>
    </label>
  );
}

function draftFromTheme(theme, mode) {
  const palette = theme?.[mode === 'light' ? 'light' : 'dark'];
  const background = String(palette?.appBg || '').match(/#[\da-f]{6}/i)?.[0] || theme?.swatch || '#1a1d33';
  return { bg: background, accent: palette?.accent || theme?.swatch || '#8a93ff', text: palette?.text || '#e8e8f5' };
}

export default function SettingsPage() {
  const [category, setCategory] = useState('appearance');
  const [engine, setEngine] = useState(browserPrefs.getEngine());
  const [newTabEngine, setNewTabEngine] = useState(browserPrefs.getNewTabEngine());
  const [proxy, setProxyState] = useState(browserPrefs.getProxy());
  const [saveHistory, setSaveHistoryState] = useState(browserPrefs.getSaveHistory());
  const [tabAnimation, setTabAnimation] = useState(browserPrefs.getTabAnimation());
  const [showBookmarksBar, setShowBookmarksBar] = useState(browserPrefs.getShowBookmarksBar());
  const [startup, setStartup] = useState(browserPrefs.getStartup());
  const [startupUrlDraft, setStartupUrlDraft] = useState(() => browserPrefs.getStartup().url);
  useEffect(() => browserPrefs.subscribe(() => {
    setEngine(browserPrefs.getEngine());
    setNewTabEngine(browserPrefs.getNewTabEngine());
    setProxyState(browserPrefs.getProxy());
    setSaveHistoryState(browserPrefs.getSaveHistory());
    setTabAnimation(browserPrefs.getTabAnimation());
    setShowBookmarksBar(browserPrefs.getShowBookmarksBar());
    setStartup(browserPrefs.getStartup());
  }), []);
  useEffect(() => { setStartupUrlDraft(startup.url); }, [startup.url]);
  const {
    rainbow, setRainbow, snowCaps, setSnowCaps,
    snowIntensity, setSnowIntensity, glassBlur, setGlassBlur, glassStrength, setGlassStrength, snowSpeed, setSnowSpeed,
    roundness, setRoundness,
    mode, setMode, appearance, setAppearance, themeId, setThemeId, themes,
    custom, setCustom,
  } = useTheme();

  const [draft, setDraft] = useState(custom || { bg: '#1a1d33', accent: '#8a93ff', text: '#e8e8f5' });

  const pickEngine = (id) => { setEngine(id); browserPrefs.setEngine(id); };
  const pickNewTabEngine = (id) => { setNewTabEngine(id); browserPrefs.setNewTabEngine(id); };
  const pickStartup = (patch) => {
    const next = { ...startup, ...patch };
    setStartup(next);
    browserPrefs.setStartup(next);
  };
  const commitStartupUrl = () => {
    const raw = startupUrlDraft.trim();
    if (!raw) { pickStartup({ url: '' }); return; }
    let candidate = raw;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(candidate)) candidate = `https://${candidate}`;
    try {
      const parsed = new URL(candidate);
      if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) throw new Error('invalid');
      const normalized = parsed.href;
      setStartupUrlDraft(normalized);
      pickStartup({ url: normalized });
    } catch {
      setStartupUrlDraft(startup.url);
    }
  };
  const categories = [
    { id: 'appearance', label: 'Appearance', icon: Sun, detail: 'Themes and effects' },
    { id: 'browser', label: 'Browser', icon: Globe, detail: 'Startup and search' },
    { id: 'privacy', label: 'Privacy', icon: Shield, detail: 'History and data' },
    { id: 'features', label: 'Features', icon: Puzzle, detail: 'Built-in tools' },
    { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard, detail: 'Quick launch and keys' },
  ];

  const modes = [
    { id: 'light', label: 'Light', icon: Sun },
    { id: 'dark', label: 'Dark', icon: Moon },
    { id: 'system', label: 'System', icon: Monitor },
  ];
  const snowLevels = [
    { id: 0, label: 'None', icon: Eraser },
    { id: 0.4, label: 'Light', icon: Snowflake },
    { id: 1, label: 'Normal', icon: Wind },
    { id: 2.2, label: 'Blizzard', icon: Wind },
  ];

  const features = [
    { icon: Camera, name: 'Matcha Air Lens', desc: 'Screen capture & AI solver' },
    { icon: Search, name: 'AI Search', desc: 'In-app AI search with overview' },
    { icon: Languages, name: 'Page Translate', desc: 'Translate any page in the webview' },
    { icon: Globe, name: 'In-App Browsing', desc: 'Open sites inside Matcha Air tabs' },
    { icon: Gamepad2, name: 'Gaming Hub', desc: 'Quick links to gaming platforms' },
  ];

  return (
    <div className="local-page settings-page">
      <div className="local-page-head">
        <div className="local-page-url"><Search size={14} /> matcha://settings</div>
      </div>
      <p className="local-page-sub">Configure your browser. Changes save automatically.</p>

      <div className="settings-layout">
        <nav className="settings-category-nav" aria-label="Settings categories">
          {categories.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} type="button" className={`settings-category-btn ${category === item.id ? 'settings-category-active' : ''}`} aria-current={category === item.id ? 'page' : undefined} onClick={() => setCategory(item.id)}>
                <Icon size={17} />
                <span><strong>{item.label}</strong><small>{item.detail}</small></span>
                {category === item.id && <Check size={15} className="settings-category-check" />}
              </button>
            );
          })}
        </nav>
        <div className="settings-category-content">

      {category === 'appearance' && <div className="settings-panel-stack">
      <SnowCapped capHeight={6} className="rounded-2xl">
        <section className="glass-panel local-section">
          <div className="local-section-head">Preset themes</div>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(themes).map(([id, t]) => {
              const active = !custom && themeId === id;
              return (
                <SnowCapped key={id} capHeight={9} className="rounded-2xl">
                  <button
                    onClick={() => {
                      setCustom(null);
                      setThemeId(id);
                      setDraft(draftFromTheme(t, mode));
                    }}
                    className={`theme-card w-full text-left p-3 rounded-2xl transition ${active ? 'theme-card-active' : ''}`}
                    style={{ background: t.swatch + '22', border: `1px solid ${t.swatch}66` }}
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full" style={{ background: t.swatch, boxShadow: `0 0 10px ${t.swatch}88` }} />
                      <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{t.name}</span>
                      {active && <Check size={16} style={{ color: t.swatch, marginLeft: 'auto' }} />}
                    </span>
                  </button>
                </SnowCapped>
              );
            })}
          </div>
        </section>
      </SnowCapped>

      <SnowCapped capHeight={6} className="rounded-2xl">
        <section className="glass-panel local-section">
          <div className="local-section-head">Custom theme builder</div>
          <div className="space-y-1">
            <ColorField label="Background" value={draft.bg} onChange={(v) => setDraft({ ...draft, bg: v })} />
            <ColorField label="Accent panel" value={draft.accent} onChange={(v) => setDraft({ ...draft, accent: v })} />
            <ColorField label="Typography" value={draft.text} onChange={(v) => setDraft({ ...draft, text: v })} />
          </div>
          <div className="flex gap-2 mt-3">
            <SnowCapped capHeight={8} className="rounded-xl flex-1">
              <button onClick={() => setCustom({ ...draft })} className="action-btn w-full py-2 rounded-xl text-sm font-medium">Apply custom theme</button>
            </SnowCapped>
            <SnowCapped capHeight={8} className="rounded-xl">
              <button onClick={() => setCustom(null)} disabled={!custom} className="action-btn-ghost px-3 py-2 rounded-xl text-sm flex items-center gap-1 disabled:opacity-40"><Eraser size={15} /> Reset</button>
            </SnowCapped>
          </div>
        </section>
      </SnowCapped>

      <SnowCapped capHeight={6} className="rounded-2xl">
        <section className="glass-panel local-section">
          <div className="local-section-head">Appearance</div>
          <div className="settings-row">
            <div><div className="settings-label">Mode</div><div className="settings-sub">Light, dark, or follow system.</div></div>
            <div className="grid grid-cols-3 gap-3" style={{ maxWidth: 380 }}>
              {modes.map((m) => {
                const Icon = m.icon;
                const active = mode === m.id;
                return (
                  <SnowCapped key={m.id} capHeight={8} className="rounded-xl">
                    <button onClick={() => setMode(m.id)} className={`mode-btn w-full flex flex-col items-center gap-1.5 py-3 px-3 rounded-xl transition ${active ? 'mode-btn-active' : ''}`}>
                      <Icon size={20} /><span className="text-xs">{m.label}</span>
                    </button>
                  </SnowCapped>
                );
              })}
            </div>
          </div>
          <div className="settings-row">
            <div><div className="settings-label">Surface style</div><div className="settings-sub">Choose glass depth or a lighter transparent treatment.</div></div>
            <div className="settings-seg" role="group" aria-label="Surface style">
              <button type="button" aria-pressed={appearance === 'glass'} className={`settings-seg-btn ${appearance === 'glass' ? 'settings-seg-active' : ''}`} onClick={() => setAppearance('glass')}>Glass</button>
              <button type="button" aria-pressed={appearance === 'transparency'} className={`settings-seg-btn ${appearance === 'transparency' ? 'settings-seg-active' : ''}`} onClick={() => setAppearance('transparency')}>Transparency</button>
            </div>
          </div>
          <div className="settings-row">
            <div><div className="settings-label"><Circle size={14} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6 }} />UI roundness</div><div className="settings-sub">Corner radius across every panel, button, and input.</div></div>
            <input type="range" min="0" max="28" step="1" value={roundness} onChange={(e) => setRoundness(parseFloat(e.target.value))} className="newtab-range" style={{ maxWidth: 200 }} />
          </div>
        </section>
      </SnowCapped>

      <SnowCapped capHeight={6} className="rounded-2xl">
        <section className="glass-panel local-section">
          <div className="local-section-head">Effects</div>
          <div className="settings-row">
            <div><div className="settings-label"><Sparkles size={14} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6 }} />Rainbow mode</div><div className="settings-sub">Cycle colors across the whole shell.</div></div>
            <div className={`toggle-switch ${rainbow ? 'toggle-on' : ''}`} onClick={() => setRainbow(!rainbow)}><div className="toggle-knob" /></div>
          </div>
          <div className="settings-row">
            <div><div className="settings-label"><Snowflake size={14} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6 }} />Snow caps on panels</div><div className="settings-sub">Drift snow across the top of glass panels.</div></div>
            <div className={`toggle-switch ${snowCaps ? 'toggle-on' : ''}`} onClick={() => setSnowCaps(!snowCaps)}><div className="toggle-knob" /></div>
          </div>
          <div className="settings-row">
            <div><div className="settings-label">Tab animation</div><div className="settings-sub">Slide once in the direction of the selected tab.</div></div>
            <button type="button" role="switch" aria-checked={tabAnimation} aria-label="Tab animation" className={`toggle-switch ${tabAnimation ? 'toggle-on' : ''}`} onClick={() => browserPrefs.setTabAnimation(!tabAnimation)}><div className="toggle-knob" /></button>
          </div>
        </section>
      </SnowCapped>

      <SnowCapped capHeight={6} className="rounded-2xl">
        <section className="glass-panel local-section">
          <div className="local-section-head">Winter atmosphere</div>
          <div className="settings-row">
            <div><div className="settings-label"><Snowflake size={14} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6 }} />Snow density</div><div className="settings-sub">How many snowflakes fall. None stops the blizzard entirely.</div></div>
            <div className="grid grid-cols-4 gap-2" style={{ maxWidth: 320 }}>
              {snowLevels.map((s) => {
                const Icon = s.icon;
                const active = snowIntensity === s.id;
                return (
                  <SnowCapped key={s.label} capHeight={8} className="rounded-xl">
                    <button onClick={() => setSnowIntensity(s.id)} className={`mode-btn w-full flex flex-col items-center gap-1 py-2.5 rounded-xl transition ${active ? 'mode-btn-active' : ''}`}>
                      <Icon size={18} /><span className="text-xs">{s.label}</span>
                    </button>
                  </SnowCapped>
                );
              })}
            </div>
          </div>
          <div className="settings-row">
            <div><div className="settings-label"><Droplets size={14} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6 }} />Glass blur intensity</div><div className="settings-sub">Frosted-glass blur on panels.</div></div>
            <input type="range" min="0" max="30" step="1" value={glassBlur} onChange={(e) => setGlassBlur(parseFloat(e.target.value))} className="newtab-range" style={{ maxWidth: 200 }} />
          </div>
          <div className="settings-row">
            <div><div className="settings-label"><Droplets size={14} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6 }} />Liquid Glass Strength</div><div className="settings-sub">Adjust the intensity of glass refraction, highlights, and background diffusion.</div></div>
            <div className="flex items-center gap-3" style={{ width: 230, maxWidth: '48%' }}>
              <input type="range" min="0" max="100" step="1" value={glassStrength} onChange={(e) => setGlassStrength(Number(e.target.value))} className="newtab-range" style={{ flex: 1, minWidth: 0 }} aria-label="Liquid Glass Strength" />
              <span className="text-xs tabular-nums" style={{ color: 'var(--text-muted)', minWidth: 36, textAlign: 'right' }}>{glassStrength}%</span>
            </div>
          </div>
          <div className="settings-row">
            <div><div className="settings-label"><Wind size={14} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6 }} />Snowfall speed</div><div className="settings-sub">How fast the snow falls.</div></div>
            <input type="range" min="0.2" max="3" step="0.1" value={snowSpeed} onChange={(e) => setSnowSpeed(parseFloat(e.target.value))} className="newtab-range" style={{ maxWidth: 200 }} />
          </div>
        </section>
      </SnowCapped>

      </div>}

      {category === 'browser' && <div className="settings-panel-stack">
      <SnowCapped capHeight={6} className="rounded-2xl">
        <section className="glass-panel local-section">
          <div className="local-section-head">Startup page</div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>Choose what Matcha Air opens to when the app starts.</p>
          <div className="settings-row">
            <div><div className="settings-label">Open on startup</div><div className="settings-sub">Start with a new tab, a Matcha Air page, or a website.</div></div>
            <select className="frost-input settings-select" value={startup.type} onChange={(e) => pickStartup({ type: e.target.value })} aria-label="Startup page">
              <option value="newtab">New tab</option>
              {Object.entries({ history: 'History', ai: 'AI Assistant', games: 'Gaming Hub', settings: 'Settings', downloads: 'Downloads', trackers: 'Trackers', passwords: 'Passwords' }).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              <option value="custom">Website</option>
            </select>
          </div>
          {startup.type === 'custom' && <div className="settings-row">
            <div><div className="settings-label">Startup website</div><div className="settings-sub">Enter a website address beginning with a domain name or https://.</div></div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><input className="frost-input" style={{ padding: '9px 12px', width: 300, maxWidth: '100%', fontSize: 13 }} value={startupUrlDraft} onChange={(e) => setStartupUrlDraft(e.target.value)} onBlur={commitStartupUrl} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitStartupUrl(); e.currentTarget.blur(); } }} placeholder="https://example.com" spellCheck={false} /><button type="button" className="action-btn" style={{ padding: '9px 14px', fontSize: 12 }} onClick={commitStartupUrl}>Save URL</button></div>
          </div>}
        </section>
      </SnowCapped>

      <SnowCapped capHeight={6} className="rounded-2xl">
        <section className="glass-panel local-section">
          <div className="local-section-head">Search engine</div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>Choose the default search provider for the address bar.</p>
          <div className="settings-engine-list">
            {ENGINES.map((e) => (
              <button key={e.id} className={`settings-engine ${engine === e.id ? 'settings-engine-active' : ''}`} onClick={() => pickEngine(e.id)}>
                <div className="settings-engine-info">
                  <span className="settings-engine-name">{e.name}</span>
                  <span className="settings-engine-desc">{e.desc}</span>
                </div>
                {engine === e.id && <Check size={18} style={{ color: 'var(--accent)' }} />}
              </button>
            ))}
          </div>
        </section>
      </SnowCapped>

      <SnowCapped capHeight={6} className="rounded-2xl">
        <section className="glass-panel local-section">
          <div className="local-section-head">New tab search engine</div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>Choose which provider the Matcha new-tab search box uses by default. The address bar keeps its own setting.</p>
          <div className="settings-row">
            <div><div className="settings-label">Default new-tab provider</div><div className="settings-sub">Google is selected by default. You can change it anytime.</div></div>
            <select className="frost-input settings-select" value={newTabEngine} onChange={(e) => pickNewTabEngine(e.target.value)} aria-label="New tab search engine">
              {ENGINES.filter((option) => option.id !== 'matcha').map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
              <option value="matcha">Matcha Air AI</option>
            </select>
          </div>
        </section>
      </SnowCapped>

      <SnowCapped capHeight={6} className="rounded-2xl">
        <section className="glass-panel local-section">
          <div className="local-section-head">Browser toolbar</div>
          <div className="settings-row">
            <div><div className="settings-label">Bookmarks bar</div><div className="settings-sub">Keep saved sites one click away below the address bar.</div></div>
            <button type="button" role="switch" aria-checked={showBookmarksBar} aria-label="Show bookmarks bar" className={`toggle-switch ${showBookmarksBar ? 'toggle-on' : ''}`} onClick={() => browserPrefs.setShowBookmarksBar(!showBookmarksBar)}><div className="toggle-knob" /></button>
          </div>
        </section>
      </SnowCapped>

      <SnowCapped capHeight={6} className="rounded-2xl">
        <section className="glass-panel local-section">
          <div className="local-section-head"><Network size={13} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6 }} />Network</div>
          <div className="settings-row">
            <div><div className="settings-label">Proxy</div><div className="settings-sub">Route page traffic through an HTTP or SOCKS5 proxy server.</div></div>
            <div className={`toggle-switch ${proxy.enabled ? 'toggle-on' : ''}`} onClick={() => browserPrefs.setProxyEnabled(!proxy.enabled)}><div className="toggle-knob" /></div>
          </div>
          <div className="settings-row">
            <div><div className="settings-label">Proxy type</div><div className="settings-sub">How the server address is interpreted.</div></div>
            <div className="settings-seg">
              <button className={`settings-seg-btn ${proxy.type === 'url' ? 'settings-seg-active' : ''}`} onClick={() => browserPrefs.setProxyType('url')}>Proxy URL</button>
              <button className={`settings-seg-btn ${proxy.type === 'ip' ? 'settings-seg-active' : ''}`} onClick={() => browserPrefs.setProxyType('ip')}>IP:port</button>
            </div>
          </div>
          <div className="settings-row">
            <div><div className="settings-label">Proxy server</div><div className="settings-sub">{proxy.type === 'ip' ? 'An HTTP proxy host and port, such as 45.91.248.107:80.' : 'Enter a complete HTTP or SOCKS5 proxy URL, such as http://proxy.example.com:8080.'}</div></div>
            <input className="frost-input" style={{ padding: '9px 12px', width: 280, fontSize: 13 }} value={proxy.server} onChange={(e) => browserPrefs.setProxyServer(e.target.value)} placeholder={proxy.type === 'ip' ? '45.91.248.107:80' : 'http://proxy.example.com:8080'} spellCheck={false} />
          </div>
        </section>
      </SnowCapped>

      </div>}

      {category === 'privacy' && <div className="settings-panel-stack">
      <SnowCapped capHeight={6} className="rounded-2xl">
        <section className="glass-panel local-section">
          <div className="local-section-head"><Shield size={13} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6 }} />Privacy</div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>Search history is stored only on this device — never sent to any server.</p>
          <div className="settings-row">
            <div><div className="settings-label">Save search history</div><div className="settings-sub">Store searches locally on this device for quick recall.</div></div>
            <div className={`toggle-switch ${saveHistory ? 'toggle-on' : ''}`} onClick={() => browserPrefs.setSaveHistory(!saveHistory)}><div className="toggle-knob" /></div>
          </div>
          <div className="settings-row">
            <div><div className="settings-label">Clear history</div><div className="settings-sub">Remove all saved search history from this device.</div></div>
            <button className="action-btn-ghost" style={{ padding: '8px 16px', borderRadius: 'calc(var(--app-roundness) * 0.6)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => { clearSearchHistory(); }}><Trash2 size={14} />Clear</button>
          </div>
        </section>
      </SnowCapped>

      </div>}

      {category === 'features' && <div className="settings-panel-stack">
      <SnowCapped capHeight={6} className="rounded-2xl">
        <section className="glass-panel local-section">
          <div className="local-section-head"><Puzzle size={13} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6 }} />Extensions</div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>Built-in features currently active in Matcha Air.</p>
          <div className="local-page-list">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.name} className="history-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 'calc(var(--app-roundness) * 0.7)' }}>
                  <div style={{ display: 'grid', placeItems: 'center', width: 36, height: 36, borderRadius: 'calc(var(--app-roundness) * 0.7)', background: 'var(--accent-soft)', color: 'var(--accent)', flex: '0 0 36px' }}>
                    <Icon size={17} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{f.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{f.desc}</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent)', padding: '4px 10px', borderRadius: 999, background: 'var(--accent-soft)' }}>Active</span>
                </div>
              );
            })}
          </div>
        </section>
      </SnowCapped>

      </div>}

      {category === 'shortcuts' && <div className="settings-panel-stack">
      <ShortcutsSection />
      </div>}
        </div>
      </div>
    </div>
  );
}
