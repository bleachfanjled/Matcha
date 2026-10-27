import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import React, { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useTheme } from '@/lib/themeContext';
import BlizzardCanvas from '@/components/BlizzardCanvas';
import SnowCapped from '@/components/SnowCapped';
import NewTabPage from '@/components/NewTabPage';
import HistoryPage from '@/pages/HistoryPage';
import PasswordsPage from '@/pages/PasswordsPage';
import BrowserContextMenu from '@/components/BrowserContextMenu';
import BookmarksBar from '@/components/BookmarksBar';
import GamesPage from '@/pages/GamesPage';
import AIPage from '@/pages/AIPage';
import WebViewport from '@/components/WebViewport';
import MatchaPageBackground from '@/components/MatchaPageBackground';
import MatchaLoader from '@/components/MatchaLoader';
import { addSearchHistory, addVisitedUrl, getSearchHistory } from '@/lib/searchHistory';
import { bookmarks } from '@/lib/bookmarks';
import { requestError } from '@/lib/requestError';
import { keyBindings, comboMatches } from '@/lib/keyboardShortcuts';
import { looksLikeUrl, normalizeUrl, looksLikeDownload, isDangerousScheme } from '@/lib/urlBar';
import { browserPrefs, buildEngineUrl, ENGINES } from '@/lib/browserPrefs';
import SettingsPage from '@/pages/SettingsPage';
import DownloadsPage from '@/pages/DownloadsPage';
import AddonsPage, { CustomMatchaPage, getMatchaCustomPages } from '@/pages/AddonsPage';
import TrackersPage from '@/pages/TrackersPage';
import ScreenCapture from '@/components/ScreenCapture';
import AISidebar from '@/components/AISidebar';
import ChromeMenu from '@/components/ChromeMenu';
import DownloadsPopup from '@/components/DownloadsPopup';
import TranslateMenu from '@/components/TranslateMenu';
import TranslatePanel from '@/components/TranslatePanel';
import DidYouMeanPopup from '@/components/DidYouMeanPopup';
import PrivacyPopover from '@/components/PrivacyPopover';
import SideNav from '@/components/SideNav';
import SiteSettingsPage from '@/components/SiteSettingsPage';
import AboutPageModal from '@/components/AboutPageModal';
import DangerPrompt from '@/components/DangerPrompt';
import { passwordVault } from '@/lib/passwordVault';
import { suggestTypo, hostOf as hostOfUrl } from '@/lib/domainTypos';
import { siteNameFor } from '@/lib/siteNames';
import { addTokens, estimateTokens } from '@/lib/tokenBudget';
import { enableProxyMode, disableProxyMode } from '@/lib/proxyMode';
import { X, Plus, Globe, Search, ArrowRight, ArrowLeft, RotateCw, Download, Camera, MoreVertical, Shield, Ban, EyeOff, Network, Link2, Languages, Lock, ChevronRight, Check, PanelLeft } from 'lucide-react';

// Local matcha:// pages that open as real browser tabs.
export const LOCAL_PAGES = {
  history: { title: 'History', url: 'matcha://history' },
  ai: { title: 'AI Assistant', url: 'matcha://ai' },
  games: { title: 'Gaming Hub', url: 'matcha://games' },
  settings: { title: 'Settings', url: 'matcha://settings' },
  downloads: { title: 'Downloads', url: 'matcha://downloads' },
  trackers: { title: 'Trackers', url: 'matcha://trackers' },
  passwords: { title: 'Passwords', url: 'matcha://passwords' },
  addons: { title: 'Addons', url: 'matcha://addons' },
};
const localPageUrl = (page) => LOCAL_PAGES[page]?.url || (page?.startsWith('custom-') ? `matcha://${page.slice(7)}` : '');
const localPageTitle = (page) => LOCAL_PAGES[page]?.title || (page?.startsWith('custom-') ? (getMatchaCustomPages().find((p) => p.slug === page.slice(7))?.name || page.slice(7)) : page || 'New Tab');

const MATCHA_LOGO = 'https://media.base44.com/images/public/6ac98e2d78f3aeeb4ce7213b/2b2bab432_GlossyGreenLeafYin-YangEmblem.png';
let tabSeq = 0;
const makeTab = () => ({ id: 'tab_' + (++tabSeq), query: '', data: null, loading: false, error: '', page: null, webUrl: null, history: [], historyIdx: -1 });
const makeStartupTabs = () => {
  const tab = makeTab();
  const startup = browserPrefs.getStartup();
  if (LOCAL_PAGES[startup.type]) tab.page = startup.type;
  else if (startup.type === 'custom') {
    // Do not create a native child webview during the first React render. On
    // macOS, creating the WKWebView while the host window is still mounting
    // can make the app exit on some startup URLs. The URL is opened shortly
    // after the shell mounts instead (see startup navigation effect below).
    try {
      const url = new URL(looksLikeUrl(startup.url) ? normalizeUrl(startup.url) : startup.url);
      if (['http:', 'https:'].includes(url.protocol)) tab.startupUrl = url.href;
    } catch { /* invalid startup addresses safely fall back to the new tab */ }
  }
  return [tab];
};
const isBlank = (t) => !t.page && !t.query && !t.data && !t.loading && !t.error && !t.webUrl;
const isTauri = () => !!(window.__TAURI__ || window.__TAURI_INTERNALS__);
const invokeTauri = async (command, args = {}) => {
  if (!isTauri()) return null;
  try { return await invoke(command, args); } catch (e) { console.warn(`[Matcha Nav] Tauri ${command} failed:`, e); return null; }
};
const tabFavicon = (t) => {
  if (t.webUrl) { try { return new URL('/favicon.ico', t.webUrl).href; } catch { return null; } }
  if (t.page) return MATCHA_LOGO;
  return MATCHA_LOGO;
};
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const field = document.createElement('textarea');
    field.value = text;
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    document.execCommand('copy');
    field.remove();
  }
}

export default function AppShell() {
  const { rainbow, snowCaps, snowIntensity, snowSpeed, appearance } = useTheme();
  const [tabs, setTabs] = useState(makeStartupTabs);
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const [activeId, setActiveId] = useState(tabs[0].id);
  const [tabTransition, setTabTransition] = useState({ direction: 'right', sequence: 0 });
  const tabTransitionSequence = useRef(0);
  const [tabTrailId, setTabTrailId] = useState(null);
  const tabTrailTimer = useRef(null);
  const [openingTabId, setOpeningTabId] = useState(null);
  const openingTabTimer = useRef(null);
  const [closingTabIds, setClosingTabIds] = useState(() => new Set());
  const closingTabTimers = useRef(new Map());

  const activeTab = tabs.find((t) => t.id === activeId);
  const activeIdRef = useRef(activeId);
  const activeTabRef = useRef(activeTab);
  const browserVisibilityQueue = useRef(Promise.resolve());
  const browserVisibilitySequence = useRef(0);
  const navigateNativeRef = useRef(null);
  activeIdRef.current = activeId;
  activeTabRef.current = activeTab;
  const activePage = activeTab?.page || null;
  const webHost = activeTab?.webUrl ? hostOfUrl(activeTab.webUrl) : '';


  // Persistent address bar: reflects the active tab and accepts either a URL
  // (navigates) or a search query. Text turns accent when it parses as a URL.
  const [addr, setAddr] = useState('');
  const addrIsUrl = looksLikeUrl(addr);
  useEffect(() => {
    setAddr(activeTab?.webUrl || (activeTab?.page ? localPageUrl(activeTab.page) : '') || activeTab?.query || '');
  }, [activeId, activeTab?.webUrl, activeTab?.query, activeTab?.page]);

  // Search engine selection (Matcha AI vs Google/Bing/DuckDuckGo/Yahoo).
  const [engine, setEngine] = useState(browserPrefs.getEngine());
  const [newTabEngine, setNewTabEngine] = useState(browserPrefs.getNewTabEngine());
  const [tabAnimation, setTabAnimation] = useState(browserPrefs.getTabAnimation());
  const [showBookmarksBar, setShowBookmarksBar] = useState(browserPrefs.getShowBookmarksBar());
  useEffect(() => browserPrefs.subscribe(() => {
    setEngine(browserPrefs.getEngine());
    setNewTabEngine(browserPrefs.getNewTabEngine());
    setTabAnimation(browserPrefs.getTabAnimation());
    setShowBookmarksBar(browserPrefs.getShowBookmarksBar());
  }), []);

  // Chrome-style toolbar state: downloads, camera (Matcha Lens), 3-dot menu.
  const [capture, setCapture] = useState(false);
  const [lens, setLens] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [downloadsOpen, setDownloadsOpen] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(() => { try { return localStorage.getItem('matcha-sidebar-visible') !== 'false'; } catch { return true; } });
  useEffect(() => { try { localStorage.setItem('matcha-sidebar-visible', String(sidebarVisible)); } catch {} }, [sidebarVisible]);
  const downloadsButtonRef = useRef(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [translateAnchor, setTranslateAnchor] = useState(null);
  const [translation, setTranslation] = useState(null);
  const [dym, setDym] = useState(null);
  const [privacyAnchor, setPrivacyAnchor] = useState(null);
  const [about, setAbout] = useState({ content: '', loading: false, error: '' });
  const [perms, setPermsState] = useState(() => browserPrefs.getSitePerms(''));
  const [siteSettings, setSiteSettings] = useState(null);
  const [aboutModal, setAboutModal] = useState(null);
  const [danger, setDanger] = useState(null);
  const [passwordOffer, setPasswordOffer] = useState(null);
  const [passwordFill, setPasswordFill] = useState(null);
  const [vaultUnlocked, setVaultUnlocked] = useState(() => passwordVault.isUnlocked());
  const [tabMemory, setTabMemory] = useState({});
  const safetyCache = useRef({});

  // AI-powered address bar suggestions.
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);
  const suggestSeq = useRef(0);
  const suggestTimer = useRef(null);
  const closedStack = useRef([]);
  const addrInputRef = useRef(null);
  useEffect(() => () => { clearTimeout(suggestTimer.current); suggestSeq.current += 1; }, []);

  // Privacy protections and the download guard are applied to native pages too.
  const [safety, setSafetyState] = useState(browserPrefs.getSafety());
  const [proxy, setProxyState] = useState(browserPrefs.getProxy());
  const [notice, setNotice] = useState(null);
  useEffect(() => browserPrefs.subscribe(() => { setSafetyState(browserPrefs.getSafety()); setProxyState(browserPrefs.getProxy()); }), []);
  useEffect(() => {
    const p = browserPrefs.getProxy();
    if (!isTauri() && p.enabled && (p.type === 'matcha' || !p.server)) enableProxyMode();
  }, []);
  const notify = (n) => { setNotice(n); if (n) setTimeout(() => setNotice((c) => (c === n ? null : c)), 3800); };
  useEffect(() => {
    if (!isTauri()) return;
    invokeTauri('set_browser_protection', {
      downloadGuard: !!safety.vpn,
      adBlock: !!safety.adBlock,
      trackerBlock: !!safety.trackerBlock,
    });
  }, [safety]);
  useEffect(() => {
    if (!isTauri()) return undefined;
    const timer = setTimeout(() => {
      invoke('set_browser_proxy', {
        enabled: !!proxy.enabled,
        server: proxy.server || '',
        proxyType: proxy.type || 'matcha',
      }).catch((error) => notify({ title: 'Proxy settings could not be applied', description: error?.message || String(error), variant: 'destructive' }));
    }, proxy.enabled ? 750 : 0);
    return () => clearTimeout(timer);
  }, [proxy.enabled, proxy.server, proxy.type]);
  const toggleSafety = (key) => {
    const next = !safety[key];
    browserPrefs.setSafety(key, next);
    const label = key === 'vpn' ? 'Download Guard' : key === 'adBlock' ? 'Ad blocker' : 'Tracker blocker';
    notify({ title: next ? 'Protection on' : 'Protection off', description: label });
  };
  const toggleProxy = () => {
    const next = !proxy.enabled;
    if (isTauri() && next && (!proxy.server.trim() || proxy.type === 'matcha')) {
      notify({ title: 'Add a proxy server first', description: 'Open Settings → Network and enter an HTTP or SOCKS5 proxy address.' });
      return;
    }
    browserPrefs.setProxyEnabled(next);
    if (next) {
      if (!isTauri() && (proxy.type === 'matcha' || !proxy.server)) {
        if (proxy.type !== 'matcha') browserPrefs.setProxyType('matcha');
        enableProxyMode();
        notify({ title: 'Proxy on', description: 'Bypassing site restrictions via Matcha Air proxy' });
      } else {
        notify({ title: 'Proxy on', description: proxy.server });
      }
    } else {
      disableProxyMode();
      notify({ title: 'Proxy off', description: 'Direct connection' });
    }
  };

  // Scan before saving, then let Rust write the file into Downloads and report its real outcome.
  const triggerDownload = async (url) => {
    let downloadUrl;
    try {
      downloadUrl = new URL(url, activeTab?.webUrl || window.location.href);
      if (!['http:', 'https:'].includes(downloadUrl.protocol)) throw new Error('Only web addresses can be downloaded.');
    } catch (error) {
      notify({ title: 'Download blocked', description: error?.message || 'Invalid download address', variant: 'destructive' });
      return;
    }
    url = downloadUrl.href;
    const name = (url.split('/').pop() || 'download').split('?')[0];
    if (safety.vpn) {
      notify({ title: 'Download blocked', description: `Download Guard blocked ${name}`, variant: 'destructive' });
      browserPrefs.recordDownload({ name, url, status: 'blocked', reason: 'Blocked by Download Guard', date: Date.now() });
      return;
    }
    notify({ title: 'Scanning download…', description: name });
    try {
      const res = await base44.functions.invoke('scanDownload', { url, filename: name });
      const v = res.data || {};
      if (v.safe) {
        if (isTauri()) {
          browserPrefs.recordDownload({ name, url, status: 'downloading', reason: v.reason || 'Scanned — safe', date: Date.now() });
          await invoke('download_url', { url, filename: name });
          notify({ title: 'Download started', description: `${name} — ${v.reason || 'safe'}` });
        } else {
          const a = document.createElement('a');
          a.href = url; a.download = name;
          document.body.appendChild(a); a.click(); a.remove();
          browserPrefs.recordDownload({ name, url, status: 'completed', reason: v.reason || 'Scanned — safe', date: Date.now() });
          notify({ title: 'Download started', description: `${name} — ${v.reason || 'safe'}` });
        }
      } else {
        browserPrefs.recordDownload({ name, url, status: 'blocked', reason: v.reason || 'Unsafe', date: Date.now() });
        notify({ title: 'Download blocked', description: `${name} — ${v.reason || 'unsafe'}`, variant: 'destructive' });
      }
    } catch {
      browserPrefs.recordDownload({ name, url, status: 'failed', reason: 'The scan or download could not be completed.', date: Date.now() });
      notify({ title: 'Download failed', description: 'The scan or download could not be completed. Try again.', variant: 'destructive' });
    }
  };

  const markOpeningTab = (id) => {
    setOpeningTabId(id);
    clearTimeout(openingTabTimer.current);
    openingTabTimer.current = setTimeout(() => setOpeningTabId((current) => current === id ? null : current), 260);
  };
  const newTab = () => { const t = makeTab(); setTabs((ts) => [...ts, t]); setActiveId(t.id); markOpeningTab(t.id); };
  const activateTab = (targetId, orderedTabs = tabs) => {
    if (targetId === activeId) {
      return;
    }
    const from = orderedTabs.findIndex((tab) => tab.id === activeId);
    const to = orderedTabs.findIndex((tab) => tab.id === targetId);
    if (tabAnimation && from >= 0 && to >= 0) {
      setTabTransition({
        direction: to > from ? 'right' : 'left',
        sequence: ++tabTransitionSequence.current,
      });
      clearTimeout(tabTrailTimer.current);
      const step = to > from ? 1 : -1;
      let index = from + step;
      const showNext = () => {
        if (index === to) { setTabTrailId(null); return; }
        setTabTrailId(orderedTabs[index]?.id || null);
        index += step;
        tabTrailTimer.current = setTimeout(showNext, 58);
      };
      if (Math.abs(to - from) > 1) showNext(); else setTabTrailId(null);
    }
    setActiveId(targetId);
  };
  const closeTabNow = async (id) => {
    clearTimeout(closingTabTimers.current.get(id));
    closingTabTimers.current.delete(id);
    setClosingTabIds((current) => { const next = new Set(current); next.delete(id); return next; });
    const currentTabs = tabsRef.current;
    const closing = currentTabs.find((t) => t.id === id);
    if (isTauri()) await invokeTauri('close_browser', { tabId: id });
    setTabMemory((current) => { const next = { ...current }; delete next[id]; return next; });
    if (closing && (closing.webUrl || closing.page || closing.query)) {
      closedStack.current.push({ webUrl: closing.webUrl, page: closing.page, query: closing.query, history: closing.history, historyIdx: closing.historyIdx });
      if (closedStack.current.length > 20) closedStack.current.shift();
    }
    const rem = currentTabs.filter((t) => t.id !== id);
    if (rem.length === 0) {
      if (isTauri()) {
        setTabs([]);
        await invokeTauri('close_browser_window');
        return;
      }
      const nt = makeTab(); setTabs([nt]); setActiveId(nt.id); return;
    }
    setTabs(rem);
    if (activeIdRef.current === id) setActiveId(rem[rem.length - 1].id);
  };
  const closeTab = (id) => {
    if (!id || closingTabTimers.current.has(id)) return;
    setClosingTabIds((current) => new Set(current).add(id));
    closingTabTimers.current.set(id, setTimeout(() => { closeTabNow(id); }, 155));
  };
  // Reopen the most recently closed tab (Ctrl/Cmd+Shift+T).
  const reopenClosedTab = () => {
    const snap = closedStack.current.pop();
    if (!snap) return;
    const t = makeTab();
    if (snap.webUrl || snap.page || snap.query) {
      Object.assign(t, { webUrl: snap.webUrl || null, page: snap.page || null, query: snap.query || '', history: snap.history || [], historyIdx: snap.historyIdx ?? -1 });
    }
    setTabs((ts) => [...ts, t]);
    setActiveId(t.id);
  };
  // Cycle to the next/previous tab (Ctrl+Tab / Ctrl+Shift+Tab).
  const cycleTab = (dir) => {
    if (tabs.length < 2) return;
    const idx = tabs.findIndex((t) => t.id === activeId);
    if (idx < 0) return;
    const target = tabs[(idx + dir + tabs.length) % tabs.length];
    activateTab(target.id);
  };
  // Jump to tab N (1-based; 9 = last tab) — Ctrl/Cmd+1..9.
  const gotoTab = (n) => {
    const idx = Math.min(Math.max(n - 1, 0), tabs.length - 1);
    if (idx >= 0 && idx < tabs.length) activateTab(tabs[idx].id);
  };
  // Focus + select the address bar (Ctrl/Cmd+L).
  const focusAddr = () => { const el = addrInputRef.current; if (el) { el.focus(); el.select(); } };
  const patchTab = (id, patch) => setTabs((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const searchSeq = useRef(0);
  const runSearch = async (id, q) => {
    const mySeq = ++searchSeq.current;
    addSearchHistory(q);
    patchTab(id, { loading: true, error: '', data: null, query: q, page: null, webUrl: null });
    try {
      // Results first — fast, from a real search engine.
      const res = await base44.functions.invoke('webSearch', { query: q });
      if (searchSeq.current !== mySeq) return;
      const results = res.data?.results || [];
      patchTab(id, { loading: false, data: { results, summary: '', details: '', links: [], overviewLoading: true } });
      // AI overview loads in parallel and fills in afterward.
      try {
        const ov = await base44.functions.invoke('aiOverview', { query: q });
        if (searchSeq.current !== mySeq) return;
        patchTab(id, { data: { results, summary: ov.data?.summary || '', details: ov.data?.details || '', links: ov.data?.links || [], overviewLoading: false } });
      } catch {
        if (searchSeq.current !== mySeq) return;
        patchTab(id, { data: { results, overviewLoading: false } });
      }
    } catch (err) {
      if (searchSeq.current !== mySeq) return;
      patchTab(id, { loading: false, error: requestError(err) });
    }
  };

  const openLocalPage = (page) => {
    if (activeTab?.page) {
      patchTab(activeTab.id, { page, query: '', data: null, loading: false, error: '', webUrl: null });
      return;
    }
    const existing = tabs.find((tab) => tab.page === page);
    if (existing) { activateTab(existing.id); return; }
    if (activeTab && isBlank(activeTab)) {
      patchTab(activeTab.id, { page, query: '', data: null, loading: false, error: '', webUrl: null });
      return;
    }
    const t = makeTab();
    t.page = page;
    if (!activeTab) { setTabs([t]); setActiveId(t.id); return; }
    setTabs((current) => [...current, t]);
    setActiveId(t.id);
  };
  const openDownloadsPage = () => {
    const existing = tabs.find((tab) => tab.page === 'downloads');
    if (existing) { activateTab(existing.id); return; }
    const tab = makeTab();
    tab.page = 'downloads';
    setTabs((current) => [...current, tab]);
    setActiveId(tab.id);
  };
  // Downloads opens as an anchored popup in every build; it must not steal
  // the active tab or navigate away from the page the user is viewing.
  const toggleDownloads = () => setDownloadsOpen((open) => !open);
  const openUrl = (url) => {
    const raw = String(url || '').trim();
    if (/^matcha:\/\//i.test(raw)) { routeMatcha(raw); return; }
    let parsed;
    try {
      if (looksLikeUrl(raw)) parsed = new URL(normalizeUrl(raw));
      else parsed = new URL(raw, activeTab?.webUrl || window.location.href);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Only HTTP and HTTPS links can be opened.');
    } catch (error) {
      notify({ title: 'Link blocked', description: error?.message || 'Invalid address', variant: 'destructive' });
      return;
    }
    const safeUrl = parsed.href;
    if (activeTab && isBlank(activeTab)) { patchTab(activeTab.id, pushNav(activeTab, safeUrl)); }
    else { const t = makeTab(); Object.assign(t, pushNav(t, safeUrl)); setTabs((ts) => [...ts, t]); setActiveId(t.id); }

  };
  const openUrlRef = useRef(openUrl);
  openUrlRef.current = openUrl;
  const openLocalPageRef = useRef(openLocalPage);
  openLocalPageRef.current = openLocalPage;
  const goHomeRef = useRef(null);
  const pickSuggestionRef = useRef(null);
  const translatePageRef = useRef(null);
  const shortcutHandlerRef = useRef(null);
  useEffect(() => {
    let disposed = false;
    let unlistenBrowserLink;
    let unlistenPassword;
    let unlistenShortcut;
    let unlistenContextMenu;
    let unlistenPasswordFill;
    let unlistenDownload;
    let unlistenMenuAction;
    let unlistenMenuDismissed;
    let unlistenTranslateDismissed;
    let unlistenSuggestion;
    let unlistenTranslateSelection;
    let unlistenTabMemory;
    let unlistenPageState;
    let unlistenPageTitle;
    listen('browser-open-link', (event) => {
      const payload = event.payload || {};
      if (payload.new_tab) openUrlRef.current(payload.url);
      else navigateNativeRef.current?.(payload.url);
    }).then((unlisten) => {
      if (disposed) unlisten(); else unlistenBrowserLink = unlisten;
    });
    listen('browser-save-password', (event) => {
      const offer = event.payload;
      if (!offer?.site || !offer?.password || passwordVault.isNeverSaved(offer.site)) return;
      setPasswordOffer(offer);
    }).then((unlisten) => {
      if (disposed) unlisten(); else unlistenPassword = unlisten;
    });
    listen('browser-shortcut', (event) => shortcutHandlerRef.current?.(event.payload?.id)).then((unlisten) => {
      if (disposed) unlisten(); else unlistenShortcut = unlisten;
    });
    listen('browser-context-menu', (event) => {
      const payload = event.payload || {};
      if (payload.tab_id && payload.tab_id !== activeIdRef.current) return;
      const viewport = document.querySelector('.webview-native-placeholder')?.getBoundingClientRect();
      const safeText = (value) => typeof value === 'string' ? value.slice(0, 8192) : '';
      setContextMenu({
        kind: 'page',
        tabId: payload.tab_id || activeIdRef.current,
        link: safeText(payload.link),
        image: safeText(payload.image),
        selection: safeText(payload.selection),
        editable: !!payload.editable,
        readOnly: !!payload.read_only,
        media: ['video', 'audio'].includes(payload.media) ? payload.media : '',
        mediaUrl: safeText(payload.media_url),
        mediaPlaying: !!payload.media_playing,
        mediaMuted: !!payload.media_muted,
        native: true,
        page: safeText(payload.page || activeTabRef.current?.webUrl),
        x: (viewport?.left || 0) + (Number(payload.x) || 0),
        y: (viewport?.top || 0) + (Number(payload.y) || 0),
      });
    }).then((unlisten) => {
      if (disposed) unlisten(); else unlistenContextMenu = unlisten;
    });
    listen('browser-page-state', (event) => {
      const { tab_id: tabId, url, loaded } = event.payload || {};
      if (!tabId || !url || !/^https?:\/\//i.test(url)) return;
      if (loaded && tabId === activeIdRef.current) setViewLoading(false);
      setTabs((current) => current.map((tab) => {
        if (tab.id !== tabId || tab.webUrl === url) return tab;
        const history = [...(tab.history || [])];
        const existing = history.lastIndexOf(url);
        if (existing >= 0) return { ...tab, webUrl: url, historyIdx: existing };
        history.splice((tab.historyIdx ?? -1) + 1);
        history.push(url);
        return { ...tab, webUrl: url, history, historyIdx: history.length - 1, page: null, title: '' };
      }));
    }).then((unlisten) => {
      if (disposed) unlisten(); else unlistenPageState = unlisten;
    });
    listen('browser-page-title', (event) => {
      const { tab_id: tabId, title } = event.payload || {};
      if (tabId && typeof title === 'string') setTabs((current) => current.map((tab) => tab.id === tabId ? { ...tab, title: title.slice(0, 512) } : tab));
    }).then((unlisten) => {
      if (disposed) unlisten(); else unlistenPageTitle = unlisten;
    });
    listen('browser-password-fill', (event) => {
      const origin = event.payload?.site;
      if (!origin || !/^https:\/\//i.test(origin)) return;
      setPasswordFill({ origin, tabId: event.payload?.tab_id, credentials: passwordVault.matching(origin) });
    }).then((unlisten) => {
      if (disposed) unlisten(); else unlistenPasswordFill = unlisten;
    });
    listen('browser-download', (event) => {
      const download = event.payload;
      if (!download?.url) return;
      const existing = browserPrefs.getDownloads().find((item) => item.url === download.url);
      browserPrefs.recordDownload({ ...download, date: download.date || Date.now() });
      if (download.status === 'downloading' && existing?.status !== 'downloading') notify({ title: 'Download started', description: download.name });
      if (download.status === 'completed') notify({ title: 'Download complete', description: download.name });
      if (download.status === 'failed' || download.status === 'blocked') notify({ title: download.status === 'blocked' ? 'Download blocked' : 'Download failed', description: download.reason || download.name, variant: 'destructive' });
    }).then((unlisten) => {
      if (disposed) unlisten(); else unlistenDownload = unlisten;
    });
    listen('browser-tab-memory', (event) => {
      const { tab_id: tabId, bytes } = event.payload || {};
      if (tabId && Number.isFinite(bytes)) setTabMemory((current) => ({ ...current, [tabId]: bytes }));
    }).then((unlisten) => {
      if (disposed) unlisten(); else unlistenTabMemory = unlisten;
    });
    listen('browser-menu-action', (event) => {
      const payload = event.payload || {};
      if (payload.tab_id !== activeIdRef.current) return;
      setMenuOpen(false);
      if (payload.action === 'downloads') setDownloadsOpen(true);
      else if (['settings', 'history'].includes(payload.action)) openLocalPageRef.current(payload.action);
    }).then((unlisten) => {
      if (disposed) unlisten(); else unlistenMenuAction = unlisten;
    });
    listen('browser-menu-dismissed', (event) => {
      if (event.payload?.tab_id === activeIdRef.current) setMenuOpen(false);
    }).then((unlisten) => {
      if (disposed) unlisten(); else unlistenMenuDismissed = unlisten;
    });
    listen('browser-translate-dismissed', (event) => {
      if (event.payload?.tab_id === activeIdRef.current) setTranslateAnchor(null);
    }).then((unlisten) => {
      if (disposed) unlisten(); else unlistenTranslateDismissed = unlisten;
    });
    listen('browser-suggestion-picked', (event) => {
      if (event.payload?.tab_id !== activeIdRef.current) return;
      const index = event.payload?.index;
      if (Number.isInteger(index)) pickSuggestionRef.current?.(index);
    }).then((unlisten) => {
      if (disposed) unlisten(); else unlistenSuggestion = unlisten;
    });
    listen('browser-translate-selection', (event) => {
      if (event.payload?.tab_id !== activeIdRef.current) return;
      const { code, label } = event.payload || {};
      translatePageRef.current?.(code, label);
    }).then((unlisten) => {
      if (disposed) unlisten(); else unlistenTranslateSelection = unlisten;
    });
    return () => { disposed = true; unlistenBrowserLink?.(); unlistenPassword?.(); unlistenShortcut?.(); unlistenContextMenu?.(); unlistenPasswordFill?.(); unlistenDownload?.(); unlistenTabMemory?.(); unlistenPageState?.(); unlistenPageTitle?.(); unlistenMenuAction?.(); unlistenMenuDismissed?.(); unlistenTranslateDismissed?.(); unlistenSuggestion?.(); unlistenTranslateSelection?.(); };
  }, []);

  useEffect(() => {
    if (isTauri() && activeTab?.webUrl) {
      invokeTauri('set_browser_menu', { tabId: activeTab.id, open: menuOpen });
    }
  }, [activeId, activeTab?.webUrl, menuOpen]);
  // Native Tauri webviews are child views and can remain visible above React
  // after navigating to an internal matcha:// page. Explicitly hide every
  // native page view whenever the active tab is rendered by React instead.
  useEffect(() => {
    if (!isTauri() || activeTab?.webUrl) return;
    const nativeTabs = tabs.filter((tab) => tab.webUrl);
    nativeTabs.forEach((tab) => { void invokeTauri('hide_browser', { tabId: tab.id }); });
  }, [activeId, activeTab?.webUrl, tabs]);
  useEffect(() => {
    if (!isTauri() || !activeTab?.webUrl) return undefined;
    // React dialogs must temporarily sit above the native child view. Ordinary
    // toolbar popovers are hosted inside the page so they never blank it.
    const modalNeedsHostLayer = !!contextMenu || !!passwordOffer || !!passwordFill || !!danger || !!dym || !!privacyAnchor || !!siteSettings || !!aboutModal || !!notice || !!downloadsOpen || !!capture || !!lens || !!translateAnchor || !!menuOpen;
    const sequence = ++browserVisibilitySequence.current;
    const request = browserVisibilityQueue.current.then(() => {
      if (sequence !== browserVisibilitySequence.current) return null;
      return invokeTauri('set_browser_visible', { tabId: activeTab.id, visible: !modalNeedsHostLayer });
    });
    browserVisibilityQueue.current = request.catch(() => null);
    return () => {
      if (browserVisibilitySequence.current === sequence) browserVisibilitySequence.current += 1;
    };
  }, [activeId, activeTab?.webUrl, contextMenu, passwordOffer, passwordFill, danger, dym, privacyAnchor, siteSettings, aboutModal, capture, lens]);
  useEffect(() => {
    if (!isTauri() || !activeTab?.webUrl) return;
    const timer = setTimeout(() => {
      invokeTauri('set_browser_suggestions', {
        tabId: activeTab.id,
        items: suggestions,
        open: showSuggest,
        loading: suggestionsLoading,
      });
    }, 75);
    return () => clearTimeout(timer);
  }, [activeId, activeTab?.webUrl, suggestions, showSuggest, suggestionsLoading]);
  useEffect(() => {
    if (!isTauri() || !activeTab?.webUrl) return;
    const timer = setTimeout(() => {
      invokeTauri('set_browser_translate_menu', { tabId: activeTab.id, open: !!translateAnchor });
    }, 75);
    return () => clearTimeout(timer);
  }, [activeId, activeTab?.webUrl, translateAnchor]);

  const handleVaultChange = (unlocked) => {
    setVaultUnlocked(unlocked);
    if (unlocked && passwordFill) {
      setPasswordFill((request) => request ? { ...request, credentials: passwordVault.matching(request.origin) } : null);
    }
  };
  const goHome = () => {
    if (activeTab && isBlank(activeTab)) patchTab(activeTab.id, { page: null });
    else newTab();
  };
  goHomeRef.current = goHome;
  const runInActive = (q) => { if (!activeTab) return; doSearch(q); };

  // Per-tab web history for back/forward. Only web URL navigations are pushed;
  // matcha:// pages and search results keep their own flows.
  const pushNav = (tab, url) => {
    addVisitedUrl(url);
    const hist = (tab.history || []).slice(0, (tab.historyIdx ?? -1) + 1);
    hist.push(url);
    return { history: hist, historyIdx: hist.length - 1, webUrl: url, query: '', data: null, loading: false, error: '', page: null, title: '' };
  };
  const navigate = (url) => {
    if (!activeTab) { const t = makeTab(); Object.assign(t, pushNav(t, url)); setTabs([t]); setActiveId(t.id); return; }
    patchTab(activeTab.id, pushNav(activeTab, url));
  };
  const goBack = () => {
    // In the Tauri desktop build, the child webview manages its own history.
    // Invoke the native go_back command instead of updating React state.
    if (isTauri() && activeTab?.webUrl) { invokeTauri('navigate_browser_back', { tabId: activeTab.id }); return; }
    if (!activeTab || !activeTab.history) return;
    let target;
    if (activeTab.historyIdx <= 0) {
      target = { historyIdx: -1, webUrl: null, query: '', data: null, loading: false, error: '', page: null };
    } else {
      const idx = activeTab.historyIdx - 1;
      target = { historyIdx: idx, webUrl: activeTab.history[idx], query: '', data: null, loading: false, error: '', page: null };
    }
    patchTab(activeTab.id, target);

  };
  const goForward = () => {
    // In the Tauri desktop build, the child webview manages its own history.
    if (isTauri() && activeTab?.webUrl) { invokeTauri('navigate_browser_forward', { tabId: activeTab.id }); return; }
    if (!activeTab || !activeTab.history || activeTab.historyIdx >= activeTab.history.length - 1) return;
    const idx = activeTab.historyIdx + 1;
    const target = { historyIdx: idx, webUrl: activeTab.history[idx], query: '', data: null, loading: false, error: '', page: null };
    patchTab(activeTab.id, target);

  };
  const canBack = !!(activeTab && activeTab.history && activeTab.history.length > 0 && activeTab.historyIdx >= 0);
  const canFwd = !!(activeTab && activeTab.history && activeTab.historyIdx < activeTab.history.length - 1);
  const [reloadNonce, setReloadNonce] = useState(0);
  const reload = () => {
    setReloadNonce((n) => n + 1);
    if (isTauri() && activeTab?.webUrl) { invokeTauri('reload_browser', { tabId: activeTab.id, hard: false }); return; }
    if (activeTab?.query && !activeTab?.webUrl && !activeTab?.page) {
      runSearch(activeTab.id, activeTab.query);
    }
  };

  // Do not send page text to the AI translation endpoint. The project currently
  // has no offline or user-configured non-AI translation engine.
  const handleTranslate = (code, label) => {
    setTranslateAnchor(null);
    if (!activeTab?.webUrl) return;
    notify({ title: 'Non-AI translation is not configured', description: `Page text was left unchanged. No ${label} translation engine or API key is set up.` });
  };
  translatePageRef.current = handleTranslate;

  // "Did you mean?" — typo correction for mistyped popular domains.
  const dymGo = () => { if (!dym) return; const u = normalizeUrl(dym.suggested); setDym(null); navigateNative(u); };
  const dymContinue = () => { if (!dym) return; const u = dym.url; setDym(null); navigateNative(u); };

  // Per-site privacy permissions (pop-ups, JavaScript, mic, camera, cookies).
  const togglePerm = (key, val) => {
    browserPrefs.setSitePerm(webHost, key, val);
    setPermsState(browserPrefs.getSitePerms(webHost));
    if (key === 'js' || key === 'popups') reload();
  };

  // AI "About this page" summary — consumes the daily token budget.
  const fetchAbout = async () => {
    if (!activeTab?.webUrl || about.loading) return;
    setAbout({ content: '', loading: true, error: '' });
    try {
      const res = await base44.functions.invoke('aboutPage', { url: activeTab.webUrl });
      const data = res.data || {};
      if (data.error) { setAbout({ content: '', loading: false, error: data.error }); return; }
      setAbout({ content: data.about, loading: false, error: '' });
      addTokens(data.tokensUsed || estimateTokens(data.about || ''));
    } catch (err) {
      setAbout({ content: '', loading: false, error: err?.message || 'Failed to load' });
    }
  };

  // Reset translation when the active tab or its URL changes.
  useEffect(() => { setTranslation(null); setTranslateAnchor(null); }, [activeId, activeTab?.webUrl]);
  useEffect(() => { setContextMenu(null); }, [activeId]);
  useEffect(() => { setPermsState(browserPrefs.getSitePerms(webHost)); setAbout({ content: '', loading: false, error: '' }); setPrivacyAnchor(null); }, [webHost]);
  // Navigate the native viewport after tab state updates; web preview uses its iframe.
  const navigateNative = async (url) => {
    if (/^matcha:\/\//i.test(url)) { routeMatcha(url); return; }
    if (isTauri()) {
      console.log('[Matcha Nav] navigateNative (Tauri):', url);
      navigate(url);
      return;
    }
    let host;
    try { host = new URL(url).hostname; } catch { host = ''; }
    if (host && !browserPrefs.getDangerBypass(host)) {
      const cached = safetyCache.current[host];
      if (cached === undefined) {
        try {
          console.log('[Matcha Nav] Safety check → detectTrackers for:', host);
          const res = await base44.functions.invoke('detectTrackers', { url });
          const trackers = res.data?.trackers || [];
          const dangerous = trackers.some((t) => t.category === 'Fingerprinting');
          safetyCache.current[host] = { dangerous, trackers };
          console.log('[Matcha Nav] Safety check result:', host, 'trackers:', trackers.length, 'dangerous:', dangerous);
          if (dangerous) { setDanger({ url, host, trackers }); return; }
        } catch (err) {
          console.warn('[Matcha Nav] Safety check failed, proceeding:', err?.message || err);
        }
      } else if (cached.dangerous) {
        setDanger({ url, host, trackers: cached.trackers || [] });
        return;
      }
    }
    navigate(url);
  };
  navigateNativeRef.current = navigateNative;

  // Defer custom startup websites until the host UI has mounted. This avoids
  // constructing the native Tauri child webview during the initial React
  // render, which can crash/exit some macOS builds when a custom startup URL
  // is configured (e.g. chatgpt.com).
  const startupNavigationScheduled = useRef(false);
  useEffect(() => {
    if (startupNavigationScheduled.current) return;
    startupNavigationScheduled.current = true;
    const initialTab = tabsRef.current[0];
    const startupUrl = initialTab?.startupUrl;
    if (!startupUrl) return;
    const initialTabId = initialTab.id;
    const timer = window.setTimeout(() => {
      setTabs((current) => current.map((tab) => tab.id === initialTabId
        ? { ...tab, startupUrl: undefined }
        : tab));
      if (activeIdRef.current === initialTabId) navigateNativeRef.current?.(startupUrl);
    }, 900);
    return () => window.clearTimeout(timer);
  }, []);

  const submitAddr = (e) => {
    e.preventDefault();
    const v = addr.trim();
    if (!v || !activeTab) return;
    if (isDangerousScheme(v)) {
      console.warn('[Matcha Nav] Rejected dangerous scheme:', v);
      notify({ title: 'Address blocked', description: 'This type of address cannot be opened for safety.', variant: 'destructive' });
      return;
    }
    if (/^matcha:\/\//i.test(v)) { routeMatcha(v); return; }
    if (looksLikeUrl(v)) {
      const url = normalizeUrl(v);
      if (!url) return;
      console.log('[Matcha Nav] submitAddr → URL recognized:', v, '→', url);
      if (looksLikeDownload(url)) { triggerDownload(url); return; }
      const suggestion = suggestTypo(v);
      if (suggestion) { setDym({ typed: v, suggested: suggestion, url }); return; }
      navigateNative(url);
    } else {
      console.log('[Matcha Nav] submitAddr → search query:', v);
      doSearch(v);
    }
  };

  // Routes a search query through the selected engine.
  const doSearch = (q) => {
    if (!activeTab) return;
    if (engine === 'matcha') runSearch(activeTab.id, q);
    else { addSearchHistory(q); navigateNative(buildEngineUrl(engine, q)); }
  };
  const searchNewTab = (q) => {
    if (!activeTab || !String(q || '').trim()) return;
    if (newTabEngine === 'matcha') runSearch(activeTab.id, q);
    else { addSearchHistory(q); navigateNative(buildEngineUrl(newTabEngine, q)); }
  };

  // Route a matcha:// URL to its internal page (settings, history, ai, games,
  // downloads). Unknown paths fall back to the settings/extension page.
  const routeMatcha = (url) => {
    const path = url.replace(/^matcha:\/\//i, '').split(/[/?#]/)[0].toLowerCase();
    const customPage = getMatchaCustomPages().find((page) => page.slug === path);
    openLocalPage(LOCAL_PAGES[path] ? path : customPage ? `custom-${path}` : 'settings');
    setAddr('');
    setShowSuggest(false);
  };

  // Show useful local suggestions immediately, then merge in remote completions.
  const fetchSuggestions = (input) => {
    const q = input.trim();
    const lower = q.toLowerCase();
    const sequence = ++suggestSeq.current;
    clearTimeout(suggestTimer.current);
    let local = [];
    if (!q) {
      local = Object.entries(LOCAL_PAGES).map(([key, p]) => ({ type: 'matcha', label: p.title, page: key }));
      getSearchHistory().slice(-3).reverse().forEach((entry) => local.push({ type: 'history', label: entry.q, url: entry.type === 'url' ? entry.q : '', historyType: entry.type }));
      bookmarks.list().filter((item) => item.url).slice(0, 4).forEach((item) => local.push({ type: 'bookmark', label: item.title || item.url, url: item.url }));
    } else if (lower.startsWith('matcha://')) {
      const path = lower.slice('matcha://'.length).split(/[/?#]/)[0];
      if (LOCAL_PAGES[path]) local.push({ type: 'matcha', label: LOCAL_PAGES[path].title, page: path });
      else { const custom = getMatchaCustomPages().find((page) => page.slug === path); if (custom) local.push({ type: 'matcha', label: custom.name, page: `custom-${path}` }); }
    } else if (looksLikeUrl(q)) {
      local.push({ type: 'url', label: normalizeUrl(q), url: normalizeUrl(q) });
    } else {
      Object.entries(LOCAL_PAGES).forEach(([key, p]) => {
        if (p.title.toLowerCase().includes(lower) || key.includes(lower)) local.push({ type: 'matcha', label: p.title, page: key });
      });
      getMatchaCustomPages().filter((p) => p.name.toLowerCase().includes(lower) || p.slug.includes(lower)).forEach((p) => local.push({ type: 'matcha', label: p.name, page: `custom-${p.slug}` }));
      getSearchHistory().slice().reverse().filter((entry) => entry.q.toLowerCase().includes(lower)).slice(0, 4)
        .forEach((entry) => local.push({ type: 'history', label: entry.q, url: entry.type === 'url' ? entry.q : '', historyType: entry.type }));
      bookmarks.list().filter((item) => item.url && `${item.title} ${item.url}`.toLowerCase().includes(lower)).slice(0, 4)
        .forEach((item) => local.push({ type: 'bookmark', label: item.title || item.url, url: item.url }));
      local.push({ type: 'search', label: `Search for “${q}”`, query: q });
    }
    const unique = local.filter((item, index, all) => all.findIndex((candidate) => candidate.type === item.type && candidate.label === item.label) === index).slice(0, 8);
    setSuggestions(unique);
    const canFetch = !!q && !lower.startsWith('matcha://') && !looksLikeUrl(q);
    setSuggestionsLoading(canFetch);
    if (!canFetch) return;
    suggestTimer.current = setTimeout(async () => {
      try {
        const res = await base44.functions.invoke('urlSuggestions', { input });
        if (suggestSeq.current !== sequence) return;
        const ai = (Array.isArray(res.data?.suggestions) ? res.data.suggestions : []).map((item) => ({
          type: item.type === 'url' ? 'url' : 'search',
          label: typeof item.label === 'string' ? item.label.slice(0, 180) : '',
          url: typeof item.url === 'string' ? item.url.slice(0, 2048) : '',
        })).filter((item) => item.label && (item.type !== 'url' || item.url));
        setSuggestions([...unique, ...ai].filter((item, index, all) => all.findIndex((candidate) => candidate.type === item.type && candidate.label === item.label) === index).slice(0, 10));
      } catch { /* instant local suggestions remain available */ }
      finally { if (suggestSeq.current === sequence) setSuggestionsLoading(false); }
    }, 140);
  };

  const pickSuggestion = (s) => {
    setShowSuggest(false);
    if (s.type === 'matcha') { openLocalPage(s.page); setAddr(''); return; }
    if (s.type === 'bookmark' || (s.type === 'history' && s.historyType === 'url')) { navigateNative(s.url); setAddr(s.url); return; }
    if (s.type === 'url' && s.url) { navigateNative(s.url); setAddr(s.url); return; }
    const query = s.type === 'history' ? s.label : (s.query || s.label.replace(/^Search for “|”$/g, ''));
    doSearch(query); setAddr(query);
  };
  pickSuggestionRef.current = (index) => {
    const suggestion = suggestions[index];
    if (suggestion) pickSuggestion(suggestion);
  };

  const zoomLevel = useRef(1);
  const lastFind = useRef('');
  const runShortcut = (id) => {
    switch (id) {
      case 'history': openLocalPage('history'); break;
      case 'ai': openLocalPage('ai'); break;
      case 'games': openLocalPage('games'); break;
      case 'shortcuts': openLocalPage('settings'); break;
      case 'newtab': newTab(); break;
      case 'home': case 'homekey': goHome(); break;
      case 'closetab': closeTab(activeId); break;
      case 'reopen': reopenClosedTab(); break;
      case 'nexttab': case 'nexttabpage': cycleTab(1); break;
      case 'prevtab': case 'prevtabpage': cycleTab(-1); break;
      case 'focusaddr': case 'focusaddralt': case 'focussearch': focusAddr(); break;
      case 'reload': case 'reloadf5': reload(); break;
      case 'hardreload':
        if (isTauri() && activeTab?.webUrl) invokeTauri('reload_browser', { tabId: activeTab.id, hard: true }); else reload();
        break;
      case 'back': case 'backmod': goBack(); break;
      case 'forward': case 'forwardmod': goForward(); break;
            case 'downloads': toggleDownloads(); break;
      case 'find': {
        const query = window.prompt('Find in page', lastFind.current);
        if (query !== null) {
          lastFind.current = query;
          if (isTauri() && activeTab?.webUrl) invokeTauri('find_browser', { tabId: activeTab.id, query, backwards: false });
          else window.find?.(query);
        }
        break;
      }
      case 'findnext':
        if (lastFind.current && isTauri()) invokeTauri('find_browser', { tabId: activeTab?.id, query: lastFind.current, backwards: false });
        else if (lastFind.current) window.find?.(lastFind.current);
        break;
      case 'findprev':
        if (lastFind.current && isTauri()) invokeTauri('find_browser', { tabId: activeTab?.id, query: lastFind.current, backwards: true });
        else if (lastFind.current) window.find?.(lastFind.current, false, true);
        break;
      case 'zoomin': case 'zoomout': case 'zoomreset':
        zoomLevel.current = id === 'zoomreset' ? 1 : Math.min(3, Math.max(0.5, zoomLevel.current * (id === 'zoomin' ? 1.1 : 1 / 1.1)));
        if (isTauri() && activeTab?.webUrl) invokeTauri('zoom_browser', { tabId: activeTab.id, factor: zoomLevel.current });
        else document.documentElement.style.zoom = String(zoomLevel.current);
        break;
      case 'print':
        if (isTauri() && activeTab?.webUrl) invokeTauri('print_browser', { tabId: activeTab.id }); else window.print();
        break;
      case 'fullscreen':
        if (isTauri()) invokeTauri('toggle_fullscreen');
        else if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.();
        break;
      case 'devtools': invokeTauri('open_devtools'); break;
      case 'inspect': invokeTauri('inspect_element'); break;
      case 'console': invokeTauri('open_console'); break;
      case 'viewsource': invokeTauri('view_source', { url: activeTab?.webUrl || '' }); break;
      default:
        if (id?.startsWith('tab')) { const index = Number.parseInt(id.slice(3), 10); if (!Number.isNaN(index)) gotoTab(index); }
        break;
    }
  };
  shortcutHandlerRef.current = runShortcut;

  // Global keyboard shortcuts (standard browser shortcuts + Matcha extras).
  useEffect(() => {
    const handler = (e) => {
      if (e.defaultPrevented) return;
      // Esc closes any open overlay/popover first.
      if (e.key === 'Escape') {
        if (dym || privacyAnchor || translateAnchor || menuOpen || downloadsOpen || capture || lens || siteSettings || aboutModal || danger || contextMenu || passwordOffer || passwordFill) {
          e.preventDefault();
          setDym(null); setPrivacyAnchor(null); setTranslateAnchor(null);
          setMenuOpen(false); setDownloadsOpen(false); setCapture(false); setLens(null);
          setSiteSettings(null); setAboutModal(null); setDanger(null);
          setContextMenu(null); setPasswordOffer(null); setPasswordFill(null);
        }
        return;
      }
      const bindings = keyBindings.list();
      for (const b of bindings) {
        if (comboMatches(e, b.combo)) {
          // Dev tools shortcuts pass through to the native browser in web mode;
          // only the Tauri desktop build intercepts and invokes them natively.
          if (b.native && !isTauri()) return;
          e.preventDefault();
          runShortcut(b.id);
          return;
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const tabTitle = (t) => {
    if (t.webUrl) {
      if (t.title) return t.title;
      return siteNameFor(t.webUrl);
    }
    return t.page ? localPageTitle(t.page) : (t.query || 'New Tab');
  };
  const savedPasswordForOffer = passwordOffer && vaultUnlocked
    ? passwordVault.matching(passwordOffer.site).find((record) => String(record.username || '').trim().toLowerCase() === String(passwordOffer.username || '').trim().toLowerCase())
    : null;
  const tabTransitionClass = tabAnimation && tabTransition.sequence > 0
    ? `tab-content-slide tab-content-slide-${tabTransition.direction}`
    : '';
  const handleHostContextMenu = (event) => {
    const rawTarget = event.target;
    const target = rawTarget instanceof Element ? rawTarget : rawTarget?.parentElement;
    if (!target || target.closest('.webview-root, .webview-native-placeholder')) return;
    event.preventDefault();
    const anchor = target.closest('a[href]');
    const image = target.closest('img[src]');
    const mediaTarget = target.closest('video, audio');
    const privateField = !!target.closest('input[type="password"]');
    const editTarget = target.closest('input:not([type="password"]), textarea, [contenteditable]:not([contenteditable="false"])');
    let selection = '';
    if (editTarget && !privateField && (editTarget instanceof HTMLInputElement || editTarget instanceof HTMLTextAreaElement)) {
      const start = editTarget.selectionStart || 0;
      const end = editTarget.selectionEnd || 0;
      if (end > start) selection = editTarget.value.slice(start, end).slice(0, 8192);
    } else if (!privateField) {
      selection = String(window.getSelection() || '').slice(0, 8192);
    }
    const allowedContextUrl = (value) => {
      try {
        const parsed = new URL(value, window.location.href);
        return ['http:', 'https:'].includes(parsed.protocol) || parsed.protocol === 'matcha:' ? parsed.href : '';
      } catch { return ''; }
    };
    const page = activeTab?.webUrl || (activeTab?.page ? localPageUrl(activeTab.page) : '');
    setContextMenu({
      kind: 'page',
      tabId: activeTab?.id,
      page,
      link: anchor ? allowedContextUrl(anchor.href) : '',
      image: image ? allowedContextUrl(image.currentSrc || image.src) : '',
      selection,
      editable: !!editTarget && !privateField,
      readOnly: !!editTarget && (!!editTarget.readOnly || !!editTarget.disabled || editTarget.getAttribute('aria-disabled') === 'true'),
      media: mediaTarget ? mediaTarget.tagName.toLowerCase() : '',
      mediaUrl: mediaTarget ? allowedContextUrl(mediaTarget.currentSrc || mediaTarget.src) : '',
      mediaPlaying: !!mediaTarget && !mediaTarget.paused,
      mediaMuted: !!mediaTarget?.muted,
      targetElement: editTarget || mediaTarget || target,
      native: false,
      x: event.clientX,
      y: event.clientY,
    });
  };
  const runContextEdit = async (action, menu) => {
    try {
      if (menu.native && isTauri()) {
        const text = action === 'paste' ? await navigator.clipboard.readText() : menu.selection || '';
        if (action === 'cut' && menu.selection) await copyText(menu.selection);
        await invoke('browser_context_action', { tabId: menu.tabId, action, text });
        return;
      }
      const target = menu.targetElement;
      if (!target) return;
      if (action === 'select_all') {
        if (typeof target.select === 'function') { target.focus(); target.select(); }
        else { target.focus?.(); document.execCommand('selectAll'); }
      } else if (action === 'cut') {
        if (menu.selection) await copyText(menu.selection);
        if (typeof target.setRangeText === 'function') {
          const start = target.selectionStart || 0, end = target.selectionEnd || 0;
          target.setRangeText('', start, end, 'start');
          target.dispatchEvent(new Event('input', { bubbles: true }));
        } else document.execCommand('delete');
      } else if (action === 'paste') {
        const text = await navigator.clipboard.readText();
        if (typeof target.setRangeText === 'function') {
          const start = target.selectionStart || 0, end = target.selectionEnd || 0;
          target.setRangeText(text, start, end, 'end');
          target.dispatchEvent(new Event('input', { bubbles: true }));
        } else if (target.isContentEditable) document.execCommand('insertText', false, text);
      }
    } catch (error) {
      notify({ title: 'Could not complete that action', description: error?.message || String(error), variant: 'destructive' });
    }
  };
  const runContextMediaAction = async (menu, action) => {
    if (menu.native && isTauri()) {
      try { await invoke('browser_context_action', { tabId: menu.tabId, action }); }
      catch (error) { notify({ title: 'Media action failed', description: error?.message || String(error), variant: 'destructive' }); }
      return;
    }
    const media = menu.targetElement;
    if (!media) return;
    if (action === 'play') await media.play?.();
    if (action === 'pause') media.pause?.();
    if (action === 'mute') media.muted = true;
    if (action === 'unmute') media.muted = false;
  };
  const runContextSelectAll = (menu) => runContextEdit('select_all', menu);

  return (
    <div className={`app-root ${rainbow ? 'rainbow-active' : ''} ${snowCaps ? '' : 'snow-hidden'}`} data-ui-appearance={appearance}>
      <div className="app-bg-layer" />
      <BlizzardCanvas intensity={snowIntensity} speed={snowSpeed} />

      <div className="app-shell app-shell-v2">
        <div className="browser-topbar">
          <header className="tab-strip">
            {tabs.map((t) => {
              const fav = tabFavicon(t);
              return (
              <SnowCapped key={t.id} capHeight={6} roundness={0.8} className="rounded-xl">
                <div
                  role="button"
                  tabIndex={0}
                  aria-pressed={t.id === activeId}
                  className={`browser-tab ${t.id === activeId ? 'browser-tab-active' : ''} ${t.id === tabTrailId ? 'browser-tab-trail' : ''} ${t.id === openingTabId ? 'browser-tab-enter' : ''} ${closingTabIds.has(t.id) ? 'browser-tab-exit' : ''}`}
                  title={`${tabTitle(t)}\n${tabMemory[t.id] == null ? 'Memory usage unavailable in this webview' : `Approx. JavaScript heap: ${(tabMemory[t.id] / (1024 * 1024)).toFixed(1)} MB`}`}
                  onClick={() => activateTab(t.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activateTab(t.id); }
                    if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
                      e.preventDefault();
                      const rect = e.currentTarget.getBoundingClientRect();
                      setContextMenu({ kind: 'tab', tabId: t.id, activeTabId: activeId, page: t.webUrl || (t.page ? localPageUrl(t.page) : ''), x: rect.left, y: rect.bottom });
                    }
                  }}
                  onContextMenu={(e) => { e.preventDefault(); setContextMenu({ kind: 'tab', tabId: t.id, activeTabId: activeId, page: t.webUrl || (t.page ? localPageUrl(t.page) : ''), x: e.clientX, y: e.clientY }); }}
                >
                  {fav ? <img src={fav} className="browser-tab-favicon" alt="" onError={(e) => { e.target.style.visibility = 'hidden'; }} /> : <Globe size={13} className="browser-tab-favicon-icon" />}
                  <span className="browser-tab-title">{tabTitle(t)}</span>
                  <button className="browser-tab-close" onClick={(e) => { e.stopPropagation(); closeTab(t.id); }} aria-label="Close tab">
                    <X size={12} />
                  </button>
                </div>
              </SnowCapped>
              );
            })}
            <button className="new-tab-btn" onClick={newTab} title="New tab" aria-label="New tab">
              <Plus size={16} />
            </button>
          </header>

          <div className="chrome-toolbar">
            <button className="chrome-btn" onClick={goBack} disabled={!canBack} title="Back" aria-label="Back" style={{ opacity: canBack ? 1 : 0.4 }}><ArrowLeft size={17} /></button>
            <button className="chrome-btn" onClick={goForward} disabled={!canFwd} title="Forward" aria-label="Forward" style={{ opacity: canFwd ? 1 : 0.4 }}><ArrowRight size={17} /></button>
            <button className="chrome-btn" onClick={reload} disabled={!activeTab?.webUrl && !activeTab?.page && !activeTab?.query} title="Reload" aria-label="Reload" style={{ opacity: (activeTab?.webUrl || activeTab?.page || activeTab?.query) ? 1 : 0.4 }}><RotateCw size={17} /></button>
            <div className="address-bar-host">
              <form className="address-bar" onSubmit={submitAddr}>
                {activeTab?.webUrl ? (
                  <button type="button" className="addr-favicon-btn" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setPrivacyAnchor({ top: r.bottom + 6, left: r.left }); }} title="Site information" aria-label="Site information">
                    <img src={`https://www.google.com/s2/favicons?domain=${webHost}&sz=32`} className="addr-favicon" alt="" onError={(e) => { e.target.style.visibility = 'hidden'; }} />
                  </button>
                ) : addrIsUrl ? <Globe size={15} style={{ color: 'var(--accent)' }} /> : <Search size={15} style={{ color: 'var(--text-muted)' }} />}
                <input
                  ref={addrInputRef}
                  className={addrIsUrl ? 'addr-is-url' : ''}
                  value={addr}
                  onChange={(e) => { setAddr(e.target.value); fetchSuggestions(e.target.value); }}
                  onFocus={() => { setShowSuggest(true); fetchSuggestions(addr); }}
                  onBlur={() => setTimeout(() => setShowSuggest(false), 160)}
                  placeholder={`Search ${engine === 'matcha' ? 'Matcha Air' : engine} or enter a URL`}
                  spellCheck={false}
                  aria-label="Address bar"
                  autoComplete="off"
                />
                <button type="submit" className="address-go" disabled={!addr.trim()} aria-label="Go">
                  <ArrowRight size={15} />
                </button>
              </form>
              {showSuggest && (suggestions.length > 0 || suggestionsLoading) && (!isTauri() || !activeTab?.webUrl) && (
                <div className="addr-suggest">
                  {suggestions.map((s, i) => {
                    const Icon = s.type === 'matcha' ? Globe : s.type === 'url' ? Link2 : s.type === 'history' ? RotateCw : s.type === 'bookmark' ? Check : Search;
                    const hint = s.type === 'matcha' ? 'Matcha Air' : s.type === 'history' ? (s.historyType === 'url' ? 'Visited' : 'Search history') : s.type === 'bookmark' ? 'Bookmark' : s.type === 'url' ? 'Open address' : 'Search';
                    return (
                      <button key={i} className="addr-suggest-item" onMouseDown={(e) => { e.preventDefault(); pickSuggestion(s); }}>
                        <span className={`addr-suggest-icon ${s.type === 'matcha' ? 'addr-suggest-icon-matcha' : ''}`}><Icon size={15} /></span>
                        <span className="addr-suggest-label">{s.label}</span>
                        <span className="addr-suggest-hint">{hint}</span>
                        {s.url && <span className="addr-suggest-url">{s.url}</span>}
                      </button>
                    );
                  })}
                  {suggestionsLoading && <div className="addr-suggest-status" aria-live="polite">Finding more suggestions…</div>}
                </div>
              )}
            </div>
            <div className="chrome-actions">
              <button className={`chrome-btn ${sidebarVisible ? 'chrome-btn-on' : ''}`} onClick={() => setSidebarVisible(v => !v)} title={sidebarVisible ? 'Hide sidebar' : 'Show sidebar'} aria-label={sidebarVisible ? 'Hide sidebar' : 'Show sidebar'} aria-pressed={sidebarVisible}><PanelLeft size={17} /></button>
              <button className="chrome-btn" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setTranslateAnchor({ top: r.bottom + 6, left: r.left }); }} disabled={!activeTab?.webUrl} title="Translate page" aria-label="Translate page" style={{ opacity: activeTab?.webUrl ? 1 : 0.4 }}><Languages size={17} /></button>
              <button className={`chrome-btn chrome-btn-white ${proxy.enabled ? 'chrome-btn-on' : ''}`} onClick={toggleProxy} title="Proxy — route page traffic through your configured proxy" aria-label="Proxy"><Network size={17} /></button>
              <button className={`chrome-btn chrome-btn-white ${safety.vpn ? 'chrome-btn-on' : ''}`} onClick={() => toggleSafety('vpn')} title="Download Guard — blocks file downloads" aria-label="Download Guard"><Shield size={17} /></button>
              <button className={`chrome-btn chrome-btn-white ${safety.adBlock ? 'chrome-btn-on' : ''}`} onClick={() => toggleSafety('adBlock')} title="Ad blocker" aria-label="Ad blocker"><Ban size={17} /></button>
              <button className={`chrome-btn chrome-btn-white ${safety.trackerBlock ? 'chrome-btn-on' : ''}`} onClick={() => toggleSafety('trackerBlock')} title="Tracker blocker" aria-label="Tracker blocker"><EyeOff size={17} /></button>
              <button ref={downloadsButtonRef} className={`chrome-btn chrome-btn-white ${downloadsOpen ? 'chrome-btn-on' : ''}`} onClick={toggleDownloads} title="Downloads" aria-label="Downloads" aria-expanded={downloadsOpen}><Download size={17} /></button>
              <button className="chrome-btn chrome-btn-white" onClick={() => {
                if (isTauri() && activeTab?.webUrl) {
                  notify({ title: 'Lens cannot capture this page yet', description: 'This site is drawn in a separate native browser view, which the current capture tool cannot read.' });
                  return;
                }
                setCapture(true);
              }} title="Matcha Air Lens — solve from screen" aria-label="Matcha Air Lens"><Camera size={17} /></button>
              <button className="chrome-btn" onClick={() => setMenuOpen(true)} title="Menu" aria-label="Menu"><MoreVertical size={17} /></button>
            </div>
            {downloadsOpen && <DownloadsPopup anchorRef={downloadsButtonRef} onClose={() => setDownloadsOpen(false)} />}
          </div>

          {showBookmarksBar && <BookmarksBar currentUrl={activeTab?.webUrl} onOpen={navigateNative} />}

          {menuOpen && (!isTauri() || !activeTab?.webUrl) && (
            <ChromeMenu
              onSettings={() => { setMenuOpen(false); openLocalPage('settings'); }}
              onHistory={() => { setMenuOpen(false); openLocalPage('history'); }}
              onDownloads={() => { setMenuOpen(false); setDownloadsOpen(true); }}
              onClose={() => setMenuOpen(false)}
            />
          )}
        </div>

        <div className={`browser-below browser-below-web ${sidebarVisible ? 'sidebar-visible' : 'sidebar-hidden'}`}>
          {sidebarVisible && <SideNav activePage={activePage} compact={false} onHome={() => { if (activeTab) patchTab(activeTab.id, { page: null, webUrl: null, query: '', data: null, error: '' }); }} onNav={(page) => openLocalPage(page)} />}
          <main className="main-chassis main-chassis-web">
          <div className="main-body frost-scroll main-body-web" style={{ position: 'relative' }} onContextMenu={handleHostContextMenu}>
            {activeTab && activeTab.webUrl && <WebViewport key={isTauri() ? 'native-webview' : activeTab.id + ':' + reloadNonce} tabId={activeTab.id} url={activeTab.webUrl} transitionDirection={tabAnimation ? tabTransition.direction : null} transitionSequence={tabTransition.sequence} onLoadingChange={setViewLoading} onTitleChange={(title) => patchTab(activeTab.id, { title })} />}
            {activeTab && activeTab.webUrl && viewLoading && <MatchaLoader />}
            {translation && activeTab?.webUrl && (!isTauri() || !activeTab?.webUrl) && <TranslatePanel translation={translation} onSwitchLang={handleTranslate} onClose={() => setTranslation(null)} />}
            {translateAnchor && activeTab?.webUrl && (!isTauri() || !activeTab?.webUrl) && (
              <TranslateMenu style={{ top: Math.min(translateAnchor.top, window.innerHeight - 380), left: Math.min(translateAnchor.left, window.innerWidth - 240) }} onPick={handleTranslate} onClose={() => setTranslateAnchor(null)} />
            )}
            {activeTab && !activeTab.webUrl && activeTab.page && (
              <div className="matcha-local-shell">
                <MatchaPageBackground />
                <div className={`matcha-local-scroll frost-scroll ${tabTransitionClass}`} key={`${activeId}:${tabTransition.sequence}:${reloadNonce}`}>
                  {activeTab.page === 'history' && <HistoryPage onRun={runInActive} onOpenUrl={navigateNative} />}
                  {activeTab.page === 'games' && <GamesPage onSearch={runInActive} onOpen={openLocalPage} />}
                  {activeTab.page === 'ai' && <AIPage />}
                  {activeTab.page === 'settings' && <SettingsPage />}
                  {activeTab.page === 'downloads' && <DownloadsPage onOpenUrl={openUrl} />}
                  {activeTab.page === 'trackers' && <TrackersPage />}
                  {activeTab.page === 'passwords' && <PasswordsPage onVaultChange={handleVaultChange} />}
                  {activeTab.page === 'addons' && <AddonsPage onOpenPage={(slug) => openUrl(`matcha://${slug}`)} />}
                  {activeTab.page?.startsWith('custom-') && <CustomMatchaPage slug={activeTab.page.slice(7)} />}
                </div>
              </div>
            )}
            {activeTab && !activeTab.webUrl && !activeTab.page && (
              <div className={`tab-content-frame ${tabTransitionClass}`} key={`${activeId}:${tabTransition.sequence}:${reloadNonce}`}>
              <NewTabPage
                key={'newtab:' + reloadNonce}
                tab={activeTab}
                engine={newTabEngine}
                engines={ENGINES}
                onEngineChange={browserPrefs.setNewTabEngine}
                onQuery={(q) => patchTab(activeTab.id, { query: q })}
                onSearch={searchNewTab}
                onOpenUrl={openUrl}
              />
              </div>
            )}
          </div>
          </main>
        </div>
      </div>
      {capture && <ScreenCapture nativePage={!!activeTab?.webUrl} onClose={() => setCapture(false)} onAnalyzing={(captureInfo) => { setLens({ ...captureInfo, analyzing: true }); setCapture(false); }} onResult={(r) => { setLens(r); setCapture(false); }} />}
      {lens && <AISidebar result={lens} onClose={() => setLens(null)} />}
      {dym && <DidYouMeanPopup typed={dym.typed} suggested={dym.suggested} onGoSuggested={dymGo} onContinue={dymContinue} onClose={() => setDym(null)} />}
      {privacyAnchor && activeTab?.webUrl && (
        <PrivacyPopover
          style={{ top: Math.min(privacyAnchor.top, window.innerHeight - 480), left: Math.min(privacyAnchor.left, window.innerWidth - 320) }}
          host={webHost}
          perms={perms}
          onTogglePerm={togglePerm}
          onSiteSettings={() => { setPrivacyAnchor(null); setSiteSettings({ host: webHost }); }}
          onCookies={() => { setPrivacyAnchor(null); setSiteSettings({ host: webHost }); }}
          onAbout={() => { setPrivacyAnchor(null); setAboutModal({ host: webHost }); fetchAbout(); }}
          onClose={() => setPrivacyAnchor(null)}
        />
      )}
      {notice && (
        <div className={`matcha-toast ${notice.variant === 'destructive' ? 'matcha-toast-err' : ''}`}>
          <strong>{notice.title}</strong>
          <span>{notice.description}</span>
        </div>
      )}
      {siteSettings && (
        <div className="site-settings-overlay frost-scroll">
          <SiteSettingsPage host={siteSettings.host} onBack={() => setSiteSettings(null)} />
        </div>
      )}
      {aboutModal && (
        <AboutPageModal
          host={aboutModal.host}
          about={about.content}
          aboutError={about.error}
          aboutLoading={about.loading}
          onClose={() => setAboutModal(null)}
        />
      )}
      {danger && (
        <DangerPrompt
          host={danger.host}
          trackers={danger.trackers}
          onContinue={() => { browserPrefs.setDangerBypass(danger.host, true); const u = danger.url; setDanger(null); navigate(u); }}
          onBack={() => setDanger(null)}
        />
      )}
      {passwordOffer && (
        <div className="danger-prompt" role="dialog" aria-modal="true" aria-labelledby="save-password-title">
          <div className="danger-prompt-card glass-panel">
            <div className="danger-prompt-icon"><Lock size={38} /></div>
            <h2 id="save-password-title">{savedPasswordForOffer ? 'Update saved password?' : 'Save password?'}</h2>
            <p className="danger-prompt-sub"><strong>{hostOfUrl(passwordOffer.site) || passwordOffer.site}</strong>{passwordOffer.username ? ` · ${passwordOffer.username}` : ''}</p>
            {!vaultUnlocked && <p className="danger-prompt-warn">Unlock your encrypted vault in Passwords before saving.</p>}
            <div className="danger-prompt-actions">
              <button className="action-btn-ghost action-btn danger-prompt-back" onClick={() => { passwordVault.neverSave(passwordOffer.site); setPasswordOffer(null); }}>Never</button>
              <button className="action-btn-ghost action-btn danger-prompt-back" onClick={() => setPasswordOffer(null)}>Not now</button>
              <button className="action-btn danger-prompt-go" onClick={async () => {
                if (!vaultUnlocked) { openLocalPage('passwords'); notify({ title: 'Unlock your vault', description: 'Return here and choose Save when your vault is unlocked.' }); return; }
                try {
                  await passwordVault.save({ id: savedPasswordForOffer?.id, site: passwordOffer.site, username: passwordOffer.username, password: passwordOffer.password });
                  setPasswordOffer(null);
                  notify({ title: savedPasswordForOffer ? 'Password updated' : 'Password saved', description: 'Encrypted in your Matcha Air vault.' });
                } catch (error) { notify({ title: 'Could not save password', description: error.message, variant: 'destructive' }); }
              }}>{savedPasswordForOffer ? 'Update' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
      {passwordFill && (
        <div className="password-fill-backdrop" role="dialog" aria-modal="true" aria-labelledby="password-fill-title">
          <section className="password-fill-panel glass-panel">
            <div className="password-fill-heading">
              <div><Lock size={17} /><strong id="password-fill-title">Sign in to {hostOfUrl(passwordFill.origin)}</strong></div>
              <button className="chrome-menu-close" onClick={() => setPasswordFill(null)} aria-label="Dismiss password suggestions"><X size={14} /></button>
            </div>
            {!vaultUnlocked ? (
              <>
                <p className="password-fill-note">Unlock your encrypted Matcha Air vault to fill a saved password.</p>
                <button className="action-btn px-3 py-2 rounded-lg text-sm" onClick={() => {
                  const tab = makeTab();
                  tab.page = 'passwords';
                  setTabs((current) => [...current, tab]);
                  setActiveId(tab.id);
                  setPasswordFill(null);
                }}>Open Passwords</button>
              </>
            ) : passwordFill.credentials.length ? (
              <div className="password-fill-list">
                {passwordFill.credentials.map((credential) => (
                  <button key={credential.id} className="password-fill-choice" onClick={async () => {
                    try {
                      await invoke('fill_browser_password', {
                        tabId: passwordFill.tabId,
                        expectedOrigin: passwordFill.origin,
                        username: credential.username,
                        password: credential.password,
                      });
                      setPasswordFill(null);
                      notify({ title: 'Password filled', description: `Credentials inserted for ${hostOfUrl(passwordFill.origin)}.` });
                    } catch (error) {
                      notify({ title: 'Could not fill password', description: error?.message || String(error), variant: 'destructive' });
                    }
                  }}>
                    <span className="password-fill-avatar">{(credential.username || hostOfUrl(credential.site)).slice(0, 1).toUpperCase()}</span>
                    <span><strong>{credential.username || 'Saved login'}</strong><small>{credential.site}</small></span>
                    <ChevronRight size={16} />
                  </button>
                ))}
              </div>
            ) : (
              <>
                <p className="password-fill-note">No saved login matches this site yet.</p>
                <button className="action-btn px-3 py-2 rounded-lg text-sm" onClick={() => {
                  const tab = makeTab();
                  tab.page = 'passwords';
                  setTabs((current) => [...current, tab]);
                  setActiveId(tab.id);
                  setPasswordFill(null);
                }}>Add a password</button>
              </>
            )}
          </section>
        </div>
      )}
      {contextMenu && (
        <BrowserContextMenu
          menu={contextMenu}
          onClose={() => setContextMenu(null)}
          onBack={goBack}
          onForward={goForward}
          canBack={canBack}
          canForward={canFwd}
          canCloseOtherTabs={tabs.length > 1}
          onReload={reload}
          onReloadTab={(id) => { if (id === activeId) reload(); else activateTab(id); }}
          onOpen={openUrl}
          onOpenCurrent={navigateNative}
          onCopy={(text) => copyText(text || '')}
          onSearch={(text) => openUrl(buildEngineUrl(engine, text))}
          onDownload={triggerDownload}
          onEdit={runContextEdit}
          onMediaAction={runContextMediaAction}
          onSelectAll={runContextSelectAll}
          onTranslate={() => {
            const currentMenu = contextMenu;
            setContextMenu(null);
            setTranslateAnchor({ top: currentMenu?.y || 0, left: currentMenu?.x || 0 });
          }}
          onDuplicate={(id) => {
            const source = tabs.find((tab) => tab.id === id);
            if (!source) return;
            const duplicate = { ...source, id: 'tab_' + (++tabSeq), history: [...(source.history || [])] };
            const ordered = [...tabs, duplicate];
            setTabs(ordered);
            activateTab(duplicate.id, ordered);
          }}
          onCloseTab={closeTab}
          onCloseOtherTabs={(id) => {
            const keep = tabs.find((tab) => tab.id === id);
            if (!keep) return;
            tabs.filter((tab) => tab.id !== id).forEach((tab) => { if (isTauri()) invokeTauri('close_browser', { tabId: tab.id }); });
            setTabs([keep]);
            setActiveId(id);
          }}
        />
      )}
    </div>
  );
}
