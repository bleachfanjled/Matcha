import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, ShieldAlert } from 'lucide-react';

// Native desktop webview (Tauri v2). The Rust backend spawns a child webview
// on top of the React app. The frontend measures its own container element
// and sends the bounds (x, y, width, height) to the Rust backend so the
// native webview is positioned exactly where the React UI expects it —
// aligned with the sidebar, top bar, and margins. A ResizeObserver keeps
// the child webview in sync when the sidebar toggles or the window resizes.

const tauriCore = () => window.__TAURI__?.core || window.__TAURI_INTERNALS__;
const canInvoke = () => typeof tauriCore()?.invoke === 'function';

export default function NativeWebViewport({ tabId, url, proxy, onLoadingChange }) {
  const containerRef = useRef(null);
  const tabIdRef = useRef(tabId);
  tabIdRef.current = tabId;
  const commandQueue = useRef(Promise.resolve());
  const lastBounds = useRef(null);
  const [error, setError] = useState('');

  const invokeInOrder = (core, command, args) => {
    const result = commandQueue.current.then(() => core.invoke(command, args));
    commandQueue.current = result.catch(() => {});
    return result;
  };

  const readBounds = (element) => {
    const rect = element.getBoundingClientRect();
    // Keep the native child webview just inside the outlined frame. Native
    // webviews sit above the React DOM and cannot be clipped by CSS overflow,
    // so a small inset preserves the visible frame stroke on every edge.
    const inset = 1.25;
    return {
      x: rect.left + inset,
      y: rect.top + inset,
      width: Math.max(1, rect.width - inset * 2),
      height: Math.max(1, rect.height - inset * 2),
      radius: parseFloat(window.getComputedStyle(element).borderTopLeftRadius) || 0,
    };
  };

  const boundsChanged = (next) => {
    const previous = lastBounds.current;
    if (!previous) return true;
    return ['x', 'y', 'width', 'height', 'radius'].some((key) => Math.abs(next[key] - previous[key]) > 0.5);
  };

  // Navigate the child webview, sending the container's measured bounds.
  useEffect(() => {
    let active = true;
    setError('');
    onLoadingChange?.(true);

    (async () => {
      const el = containerRef.current;
      const core = tauriCore();
      if (!el || !canInvoke()) {
        if (active) setError('The desktop navigation bridge is unavailable.');
        return;
      }
      const bounds = readBounds(el);
      lastBounds.current = bounds;
      try {
        if (proxy) {
          await invokeInOrder(core, 'set_browser_proxy', {
            enabled: !!proxy.enabled,
            server: proxy.server || '',
            proxyType: proxy.type || 'matcha',
          });
        }
        await invokeInOrder(core, 'navigate_browser', { tabId, url, ...bounds });
      } catch (failure) {
        if (!active) return;
        console.error('[Matcha Nav] navigate_browser failed:', url, failure);
        setError(
          `This desktop package cannot open its browsing view: ${failure?.message || String(failure)}. The Tauri package must register the navigate_browser command and its webview permissions.`,
        );
      } finally {
        if (active) onLoadingChange?.(false);
      }
    })();

    return () => { active = false; };
  }, [tabId, url, proxy?.enabled, proxy?.server, proxy?.type, onLoadingChange]);

  // Hide the child webview only when leaving the native web viewport for a
  // local page or new-tab/search UI. Web-to-web tab switches keep this React
  // component mounted so a visibility hide cannot race the next navigation.
  useEffect(() => {
    const core = tauriCore();
    return () => {
      if (canInvoke()) {
        core.invoke('hide_browser', { tabId: tabIdRef.current }).catch(() => {});
      }
    };
  }, []);

  // Keep the child webview positioned correctly when the container changes
  // (sidebar toggle, window resize, tab strip height change).
  useEffect(() => {
    const el = containerRef.current;
    const core = tauriCore();
    if (!el || !canInvoke()) return;

    const updateBounds = () => {
      const bounds = readBounds(el);
      if (!boundsChanged(bounds)) return;
      lastBounds.current = bounds;
      invokeInOrder(core, 'resize_browser_webview', { tabId: tabIdRef.current, ...bounds }).catch(() => {});
    };

    const ro = new ResizeObserver(updateBounds);
    ro.observe(el);
    window.addEventListener('resize', updateBounds);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateBounds);
    };
  }, []);

  if (error) {
    return (
      <div className="webview-root">
        <div className="viewport-frame webview-frame">
          <div className="webview-blocked" role="alert">
            <ShieldAlert size={40} />
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: '12px 0 6px' }}>
              Desktop browsing unavailable
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 420, lineHeight: 1.55 }}>
              {error}
            </p>
            <button
              className="action-btn"
              style={{ marginTop: 16, padding: '10px 20px', borderRadius: 999, fontSize: 14 }}
              onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
            >
              <ExternalLink size={15} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6 }} /> Open in external browser
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <div ref={containerRef} className="webview-native-placeholder webview-frame" aria-label="Desktop browsing view" />;
}
