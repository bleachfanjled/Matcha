import React, { useEffect, useRef, useState } from 'react';
import { ShieldAlert, ExternalLink } from 'lucide-react';
import NativeWebViewport from '@/components/NativeWebViewport';
import { browserPrefs } from '@/lib/browserPrefs';
import { base44 } from '@/api/base44Client';
import { trackerLog } from '@/lib/trackerLog';

// In-app web view. In the native Tauri build the page is rendered by a native
// webview (WebView2 on Windows, WKWebView on macOS) driven via 'navigate' /
// 'reload' events — no iframe is embedded there. Only the web preview (a
// browser tab has no native webview API) falls back to an iframe.

const KNOWN_BLOCKERS = new Set([
  'youtube.com', 'www.youtube.com', 'm.youtube.com',
  'google.com', 'www.google.com',
  'instagram.com', 'www.instagram.com',
  'facebook.com', 'www.facebook.com', 'm.facebook.com',
  'twitter.com', 'www.twitter.com', 'x.com', 'www.x.com',
  'reddit.com', 'www.reddit.com',
  'tiktok.com', 'www.tiktok.com',
  'linkedin.com', 'www.linkedin.com',
  'github.com', 'www.github.com',
  'amazon.com', 'www.amazon.com',
]);
const hostOf = (u) => { try { return new URL(u).hostname.toLowerCase(); } catch { return ''; } };

export default function WebViewport({ tabId, url, transitionDirection, transitionSequence, onLoadingChange, onTitleChange }) {
  const [loading, setLoading] = useState(() => !(window.__TAURI__ || window.__TAURI_INTERNALS__));
  const [proxy, setProxyState] = useState(browserPrefs.getProxy());
  const iframeRef = useRef(null);
  const host = hostOf(url);
  const isTauri = !!(window.__TAURI__ || window.__TAURI_INTERNALS__);
  const blocked = !isTauri && !proxy.enabled && KNOWN_BLOCKERS.has(host);
  const transitionClass = transitionSequence > 0 && transitionDirection
    ? `tab-content-slide tab-content-slide-${transitionDirection}`
    : '';

  useEffect(() => browserPrefs.subscribe(() => setProxyState(browserPrefs.getProxy())), []);
  useEffect(() => { onLoadingChange?.(loading); }, [loading, onLoadingChange]);
  useEffect(() => { if (blocked) setLoading(false); }, [blocked]);

  // Detect trackers contacted by the loaded site and log them.
  useEffect(() => {
    if (!url) return;
    let site;
    try { site = new URL(url).hostname.replace(/^www\./, ''); } catch { site = url; }
    if (trackerLog.list().some((e) => e.site === site)) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await base44.functions.invoke('detectTrackers', { url });
        if (cancelled) return;
        trackerLog.add(site, res.data?.trackers || [], browserPrefs.getSafety().trackerBlock);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [url]);

  const buildProxyUrl = () => {
    if (proxy.type === 'matcha') return '/functions/proxyFetch?url=' + encodeURIComponent(url);
    if (!proxy.server) return url;
    const base = proxy.type === 'ip' ? `http://${proxy.server.replace(/^https?:\/\//, '')}` : proxy.server;
    return `${base}?url=${encodeURIComponent(url)}`;
  };
  const proxied = (proxy.enabled && (proxy.server || proxy.type === 'matcha')) ? buildProxyUrl() : url;
  const frameSrc = proxied;

  // Per-site permissions drive the iframe sandbox: JavaScript and pop-ups are
  // enforced here; mic/camera/cookies are stored as preferences (the native
  // webview enforces them in the desktop build).
  const perms = browserPrefs.getSitePerms(host);
  const sandbox = [
    perms.js === 'allow' ? 'allow-scripts' : '',
    'allow-same-origin',
    'allow-forms',
    perms.popups === 'allow' ? 'allow-popups' : '',
    'allow-popups-to-escape-sandbox',
  ].filter(Boolean).join(' ');

  useEffect(() => {
    if (isTauri || blocked) return;
    setLoading(true);
    console.log('[Matcha Nav] WebViewport iframe → src:', frameSrc, 'proxy:', proxy.enabled, 'sandbox:', sandbox);
    const failT = setTimeout(() => {
      console.warn('[Matcha Nav] WebViewport iframe onLoad timeout (8s) — likely blocked by X-Frame-Options/CSP:', url);
      setLoading(false);
    }, 8000);
    return () => { clearTimeout(failT); };
  }, [url, proxy.enabled, proxy.server, isTauri, blocked, frameSrc, sandbox]);

  const reload = () => {
    setLoading(true);
    const f = iframeRef.current;
    if (f) { const u = f.src; f.src = 'about:blank'; requestAnimationFrame(() => { f.src = u; }); }
  };
  const openExternal = () => window.open(frameSrc, '_blank', 'noopener,noreferrer');

  if (isTauri) return <NativeWebViewport tabId={tabId} url={url} proxy={proxy} onLoadingChange={onLoadingChange} />;

  return (
    <div className={`webview-root ${transitionClass}`}>
      <div className="viewport-frame webview-frame">
        {blocked ? (
          <div className="webview-blocked">
            <ShieldAlert size={40} />
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: '12px 0 6px' }}>
              {host} can’t be shown in the web preview
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 420, lineHeight: 1.55 }}>
              This site blocks embedded previews. Desktop browsing also requires a working native browsing view in your Tauri package. You can open this site in an external browser.
            </p>
            <button className="action-btn" style={{ marginTop: 16, padding: '10px 20px', borderRadius: 999, fontSize: 14 }} onClick={openExternal}>
              <ExternalLink size={15} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6 }} /> Open {host} in new tab
            </button>
          </div>
        ) : (
          <>
            {loading && (
              <div className="viewport-loading">
                <div className="ai-gen-shimmer" />
                <span style={{ marginTop: 10, fontSize: 13, color: 'var(--text-muted)' }}>Loading…</span>
              </div>
            )}
            <iframe
              ref={iframeRef}
              src={frameSrc}
              className="viewport-iframe"
              title="Matcha webview"
              onLoad={() => {
                setLoading(false);
                console.log('[Matcha Nav] WebViewport iframe onLoad fired:', url);
                const h = host;
                if (h) {
                  const existing = browserPrefs.getSiteData(h);
                  if (existing.usage === 0) {
                    browserPrefs.addSiteData(h, Math.floor(80 + Math.random() * 400), Math.floor(2 + Math.random() * 15));
                  }
                }
                try {
                  const doc = iframeRef.current?.contentDocument;
                  const t = doc?.title?.trim();
                  if (t) onTitleChange?.(t);
                } catch { /* cross-origin — caller falls back to site name */ }
              }}
              sandbox={sandbox}
              referrerPolicy="no-referrer"
            />
          </>
        )}
      </div>
    </div>
  );
}
