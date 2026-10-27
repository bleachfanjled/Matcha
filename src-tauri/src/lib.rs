use std::{
    collections::HashSet,
    fs::{self, File},
    io::Write,
    path::{Path, PathBuf},
    process::Command,
    sync::{
        Mutex,
        atomic::{AtomicBool, Ordering},
    },
    time::Duration,
};

use serde_json::{Value, json};
use tauri::{
    Emitter, LogicalPosition, LogicalSize, Manager, State, Url, Webview, WebviewBuilder,
    WebviewUrl, webview::DownloadEvent,
};

const MAIN_WINDOW: &str = "main";
const BROWSER_WEBVIEW_PREFIX: &str = "browser_tab_";

#[derive(Clone, Copy)]
struct Bounds {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    radius: f64,
}

#[derive(Default)]
struct BrowserState {
    active_tab: Mutex<Option<String>>,
    bounds: Mutex<Option<Bounds>>,
    tabs: Mutex<HashSet<String>>,
    download_guard: AtomicBool,
    ad_block: AtomicBool,
    tracker_block: AtomicBool,
    sidebar_expanded: AtomicBool,
    proxy_url: Mutex<Option<Url>>,
    download_paths: Mutex<std::collections::HashMap<(String, String), PathBuf>>,
}

impl BrowserState {
    fn is_active(&self, tab_id: &str) -> bool {
        self.active_tab
            .lock()
            .map(|id| id.as_deref() == Some(tab_id))
            .unwrap_or(false)
    }
}

fn checked_url(value: &str) -> Result<Url, String> {
    let url = Url::parse(value).map_err(|error| format!("Invalid URL: {error}"))?;
    if !matches!(url.scheme(), "http" | "https") {
        return Err("Only HTTP and HTTPS pages can be opened in Matcha Air.".into());
    }
    Ok(url)
}

fn checked_bounds(x: f64, y: f64, width: f64, height: f64, radius: Option<f64>) -> Result<Bounds, String> {
    if ![x, y, width, height].iter().all(|value| value.is_finite()) {
        return Err("The browser view received invalid bounds.".into());
    }
    Ok(Bounds {
        x: x.max(0.0),
        y: y.max(0.0),
        width: width.max(1.0),
        height: height.max(1.0),
        radius: radius.filter(|value| value.is_finite()).unwrap_or(24.0).clamp(0.0, 80.0),
    })
}

fn move_and_size(webview: &Webview, bounds: Bounds) -> Result<(), String> {
    webview
        .set_position(LogicalPosition::new(bounds.x, bounds.y))
        .map_err(|error| error.to_string())?;
    webview
        .set_size(LogicalSize::new(bounds.width, bounds.height))
        .map_err(|error| error.to_string())
}

fn webview_label(tab_id: &str) -> Result<String, String> {
    if tab_id.is_empty()
        || tab_id.len() > 48
        || !tab_id
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '_' | '-'))
    {
        return Err("Invalid browser tab identifier.".into());
    }
    Ok(format!("{BROWSER_WEBVIEW_PREFIX}{tab_id}"))
}

fn active_proxy(state: &BrowserState) -> Result<Option<Url>, String> {
    state
        .proxy_url
        .lock()
        .map(|proxy| proxy.clone())
        .map_err(|_| "Proxy settings unavailable".into())
}

fn safe_download_name(url: &Url, requested: Option<&str>) -> String {
    let raw = requested
        .filter(|name| !name.trim().is_empty())
        .map(str::to_owned)
        .or_else(|| {
            url.path_segments()
                .and_then(|mut segments| segments.next_back())
                .map(str::to_owned)
        })
        .unwrap_or_else(|| "download".into());
    let leaf = Path::new(&raw)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("download");
    let cleaned: String = leaf
        .chars()
        .filter(|character| {
            character.is_ascii_alphanumeric() || matches!(character, '.' | '_' | '-' | ' ')
        })
        .take(180)
        .collect();
    let cleaned = cleaned.trim_matches([' ', '.']);
    if cleaned.is_empty() || cleaned == "." || cleaned == ".." {
        "download".into()
    } else {
        cleaned.into()
    }
}

fn unique_download_path(app: &tauri::AppHandle, filename: &str) -> Result<PathBuf, String> {
    let root = app
        .path()
        .download_dir()
        .map_err(|error| format!("Could not find the Downloads folder: {error}"))?;
    fs::create_dir_all(&root)
        .map_err(|error| format!("Could not create the Downloads folder: {error}"))?;
    let (stem, extension) = match filename.rsplit_once('.') {
        Some((stem, extension)) if !stem.is_empty() && !extension.is_empty() => {
            (stem.to_owned(), format!(".{extension}"))
        }
        _ => (filename.to_owned(), String::new()),
    };
    for index in 0..10_000_u32 {
        let suffix = if index == 0 {
            String::new()
        } else {
            format!(" ({index})")
        };
        let candidate = root.join(format!("{stem}{suffix}{extension}"));
        if !candidate.exists() {
            return Ok(candidate);
        }
    }
    Err("Too many files with this name already exist in Downloads.".into())
}

fn protection_script(ad_block: bool, tracker_block: bool) -> String {
    format!(
        r#"window.__matchaAirProtection = {{ adBlock: {ad_block}, trackerBlock: {tracker_block} }};
window.__matchaAirSetProtection = function(next) {{ window.__matchaAirProtection = {{ adBlock: !!next.adBlock, trackerBlock: !!next.trackerBlock }}; }};
(() => {{
  if (window.__matchaAirProtectionInstalled) return;
  window.__matchaAirProtectionInstalled = true;
  const adHosts = ['doubleclick.net','googlesyndication.com','googleadservices.com','adservice.google.com','amazon-adsystem.com','adnxs.com','adsrvr.org','criteo.com','taboola.com','outbrain.com'];
  const trackerHosts = ['google-analytics.com','googletagmanager.com','connect.facebook.net','facebook.com/tr','hotjar.com','clarity.ms','segment.io','mixpanel.com','scorecardresearch.com','amplitude.com','matomo.cloud'];
  const blocked = (value) => {{
    try {{
      const url = new URL(value, location.href);
      const host = url.hostname.toLowerCase();
      const cfg = window.__matchaAirProtection || {{}};
      const matches = (list) => list.some((domain) => host === domain || host.endsWith('.' + domain) || url.href.toLowerCase().includes(domain + '/'));
      return (!!cfg.adBlock && matches(adHosts)) || (!!cfg.trackerBlock && matches(trackerHosts));
    }} catch {{ return false; }}
  }};
  const originalFetch = window.fetch;
  if (originalFetch) window.fetch = function(input, init) {{
    const value = typeof input === 'string' ? input : (input && input.url) || '';
    if (blocked(value)) return Promise.reject(new TypeError('Blocked by Matcha Air protection'));
    return originalFetch.call(this, input, init);
  }};
  const xhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {{ this.__matchaAirBlocked = blocked(url); return xhrOpen.call(this, method, url, ...rest); }};
  const xhrSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function(...args) {{
    if (this.__matchaAirBlocked) {{ queueMicrotask(() => {{ this.dispatchEvent(new ProgressEvent('error')); this.dispatchEvent(new ProgressEvent('loadend')); }}); return; }}
    return xhrSend.apply(this, args);
  }};
  if (navigator.sendBeacon) {{ const beacon = navigator.sendBeacon.bind(navigator); navigator.sendBeacon = (url, data) => blocked(url) ? true : beacon(url, data); }}
  const imageSrc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  if (imageSrc?.get && imageSrc?.set) Object.defineProperty(HTMLImageElement.prototype, 'src', {{ configurable: true, get: imageSrc.get, set(value) {{ imageSrc.set.call(this, blocked(value) ? 'data:,' : value); }} }});
  const scrub = (root) => {{
    if (!(root instanceof Element)) return;
    const elements = [root, ...root.querySelectorAll('[src],[href]')];
    for (const element of elements) {{
      if (blocked(element.getAttribute('src') || element.getAttribute('href') || '')) {{
        if (element.tagName === 'IFRAME' || element.tagName === 'SCRIPT') element.remove();
        else if (element.hasAttribute('src')) element.removeAttribute('src');
      }}
    }}
  }};
  const installObserver = () => {{
    if (!document.documentElement) return;
    scrub(document.documentElement);
    new MutationObserver((mutations) => mutations.forEach((mutation) => mutation.addedNodes.forEach(scrub))).observe(document.documentElement, {{ childList: true, subtree: true }});
  }};
  if (document.documentElement) installObserver(); else document.addEventListener('DOMContentLoaded', installObserver, {{ once: true }});
}})();"#
    )
}

fn menu_bridge_script() -> &'static str {
    r#"(() => {
      if (window.__matchaAirBridgeInstalled) return;
      window.__matchaAirBridgeInstalled = true;
      const invoke = window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.invoke;
      const send = (event, payload) => {
        if (typeof invoke === 'function') invoke('browser_bridge_event', { event, payload }).catch(() => {});
      };
      const webUrl = value => {
        try { const url = new URL(value, location.href); return /^https?:$/.test(url.protocol) ? url.href : ''; }
        catch { return ''; }
      };
      // Chrome-like destination preview, rendered inside the native page so it
      // remains visible above the website even though Tauri uses a child webview.
      const installLinkPreview = () => {
        if (document.getElementById('matcha-air-link-preview')) return;
        const style = document.createElement('style');
        style.id = 'matcha-air-link-preview-style';
        const frameRadius = Math.max(0, Number(window.__matchaAirFrameRadius) || 24);
        style.textContent = `
          html { width: 100% !important; height: 100% !important; margin: 0 !important; border-radius: ${frameRadius}px !important; overflow: hidden !important; clip-path: inset(0 round ${frameRadius}px) !important; -webkit-clip-path: inset(0 round ${frameRadius}px) !important; }
          body { width: 100% !important; min-height: 100% !important; margin: 0 !important; border-radius: ${frameRadius}px !important; overflow: hidden !important; clip-path: inset(0 round ${frameRadius}px) !important; -webkit-clip-path: inset(0 round ${frameRadius}px) !important; }
          #matcha-air-link-preview { position: fixed; left: 0; bottom: 0; z-index: 2147483647;
            max-width: min(70vw, 680px); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
            padding: 5px 9px calc(5px + env(safe-area-inset-bottom, 0px)); margin: 0;
            color: #f5f5f5; background: rgba(20,20,20,.94); border: 1px solid rgba(255,255,255,.15);
            border-left: 0; border-bottom: 0; border-radius: 0 7px 0 0; box-shadow: 0 1px 5px rgba(0,0,0,.25);
            font: 12px/1.35 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; pointer-events: none;
            opacity: 0; transform: translateY(3px); transition: opacity 150ms ease, transform 150ms ease; }
          #matcha-air-link-preview[data-visible='true'] { opacity: 1; transform: translateY(0); }
          @media (prefers-reduced-motion: reduce) { #matcha-air-link-preview { transition: none; } }
        `;
        (document.head || document.documentElement).appendChild(style);
        const status = document.createElement('div');
        status.id = 'matcha-air-link-preview';
        status.setAttribute('aria-hidden', 'true');
        status.setAttribute('data-visible', 'false');
        (document.body || document.documentElement).appendChild(status);
        const getAnchor = node => node instanceof Element ? node.closest('a[href], area[href]') : null;
        document.addEventListener('pointerover', event => {
          const anchor = getAnchor(event.target);
          if (!anchor) return;
          const href = webUrl(anchor.href);
          if (!href) return;
          status.textContent = href;
          status.title = href;
          status.setAttribute('data-visible', 'true');
        }, true);
        document.addEventListener('pointerout', event => {
          const from = getAnchor(event.target);
          const to = getAnchor(event.relatedTarget);
          if (from && from !== to) status.setAttribute('data-visible', 'false');
        }, true);
        document.addEventListener('focusin', event => {
          const anchor = getAnchor(event.target);
          const href = anchor ? webUrl(anchor.href) : '';
          if (href) { status.textContent = href; status.title = href; status.setAttribute('data-visible', 'true'); }
        }, true);
        document.addEventListener('focusout', event => {
          if (getAnchor(event.target)) status.setAttribute('data-visible', 'false');
        }, true);
      };
      // Install immediately at document start; waiting for DOMContentLoaded can
      // delay link previews on pages that hold that event for several seconds.
      installLinkPreview();
      document.addEventListener('contextmenu', event => {
        event.preventDefault();
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;
        const editor = target.closest('input:not([type=password]), textarea, [contenteditable]:not([contenteditable="false"])');
        const privateField = !!target.closest('input[type=password]');
        const image = target.closest('img');
        const media = target.closest('video, audio');
        const anchor = target.closest('a[href]');
        window.__matchaContextTarget = editor || media || target;
        let selection = '';
        if (!privateField && editor && (editor instanceof HTMLInputElement || editor instanceof HTMLTextAreaElement)) {
          const start = editor.selectionStart || 0, end = editor.selectionEnd || 0;
          if (end > start) selection = editor.value.slice(start, end).slice(0, 8192);
        } else if (!privateField) {
          selection = String(window.getSelection() || '').slice(0, 8192);
        }
        send('browser-context-menu', {
          x: event.clientX, y: event.clientY, page: location.href,
          link: anchor ? webUrl(anchor.href) : '', image: image ? webUrl(image.currentSrc || image.src) : '',
          selection, editable: !!editor && !privateField,
          read_only: !!editor && (!!editor.readOnly || !!editor.disabled || editor.getAttribute('aria-disabled') === 'true'),
          media: media ? media.tagName.toLowerCase() : '', media_url: media ? webUrl(media.currentSrc || media.src) : '',
          media_playing: !!media && !media.paused, media_muted: !!media && !!media.muted
        });
      }, true);
      document.addEventListener('click', event => {
        const target = event.target instanceof Element ? event.target : null;
        const anchor = target && target.closest('a[href]');
        if (!anchor || anchor.hasAttribute('download') || event.defaultPrevented) return;
        const url = webUrl(anchor.href);
        if (!url || url.startsWith(location.origin + '#')) return;
        const newTab = anchor.target === '_blank' || event.ctrlKey || event.metaKey || event.shiftKey || event.button === 1;
        if (!newTab) return;
        event.preventDefault();
        send('browser-open-link', { url, new_tab: true });
      }, true);
      const reportUrl = () => send('browser-url-change', { url: location.href });
      addEventListener('popstate', reportUrl);
      addEventListener('hashchange', reportUrl);
      for (const method of ['pushState', 'replaceState']) {
        const original = history[method];
        history[method] = function(...args) {
          const result = original.apply(this, args);
          queueMicrotask(reportUrl);
          return result;
        };
      }
      document.addEventListener('mousedown', (event) => {
        const menu = document.getElementById('matcha-air-native-menu');
        if (menu && !menu.contains(event.target)) { menu.remove(); send('browser-menu-dismissed', {}); }
        const translate = document.getElementById('matcha-air-native-translate');
        if (translate && !translate.contains(event.target)) { translate.remove(); send('browser-translate-dismissed', {}); }
      }, true);
      window.__matchaAirSetActive = (active) => {
        window.__matchaAirActive = !!active;
        try {
          Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__matchaAirActive ? 'visible' : 'hidden' });
          Object.defineProperty(document, 'hidden', { configurable: true, get: () => !window.__matchaAirActive });
        } catch {}
        document.dispatchEvent(new Event('visibilitychange'));
      };
      window.__matchaAirSetSidebarExpanded = (expanded) => {
        window.__matchaAirSidebarExpanded = !!expanded;
        const nav = document.getElementById('matcha-air-native-sidebar');
        if (nav) nav.dataset.expanded = String(!!expanded);
      };
      window.__matchaAirSetMenuOpen = (open) => {
        let menu = document.getElementById('matcha-air-native-menu');
        if (!open) { menu?.remove(); return; }
        if (menu) return;
        let style = document.getElementById('matcha-air-native-menu-style');
        if (!style) { style = document.createElement('style'); style.id = 'matcha-air-native-menu-style'; document.head?.appendChild(style); }
        style.textContent = '#matcha-air-native-menu{position:fixed;z-index:2147483647;right:16px;top:16px;width:220px;padding:8px;border:1px solid rgba(255,255,255,.2);border-radius:16px;background:rgba(25,35,31,.88);backdrop-filter:blur(24px) saturate(160%);-webkit-backdrop-filter:blur(24px) saturate(160%);box-shadow:0 16px 42px rgba(0,0,0,.34);color:#f5fff8;font:14px -apple-system,BlinkMacSystemFont,sans-serif}#matcha-air-native-menu button{display:block;width:100%;padding:11px 12px;border:0;border-radius:10px;background:transparent;color:inherit;text-align:left;font:inherit;cursor:pointer}#matcha-air-native-menu button:hover{background:rgba(255,255,255,.13)}';
        menu = document.createElement('div');
        menu.id = 'matcha-air-native-menu';
        menu.innerHTML = [['settings','Settings'],['history','History'],['downloads','Downloads']].map(([action,label]) => '<button type="button" data-action="'+action+'">'+label+'</button>').join('');
        menu.addEventListener('click', (event) => {
          const button = event.target.closest('button[data-action]');
          if (!button) return;
          event.preventDefault(); event.stopPropagation();
          send('browser-menu-action', { action: button.dataset.action });
          menu.remove();
        });
        document.body?.appendChild(menu);
      };
      window.__matchaAirSetSuggestions = (items, open, loading) => {
        let panel = document.getElementById('matcha-air-native-suggestions');
        if (!open) { panel?.remove(); return; }
        if (!document.body) { document.addEventListener('DOMContentLoaded', () => window.__matchaAirSetSuggestions(items, open, loading), { once: true }); return; }
        panel?.remove();
        let style = document.getElementById('matcha-air-native-suggestions-style');
        if (!style) { style = document.createElement('style'); style.id = 'matcha-air-native-suggestions-style'; document.head?.appendChild(style); }
        style.textContent = '#matcha-air-native-suggestions{position:fixed;z-index:2147483647;top:14px;left:76px;width:min(560px,62vw);max-height:55vh;overflow:auto;padding:8px;border:1px solid rgba(255,255,255,.2);border-radius:16px;background:rgba(25,35,31,.92);backdrop-filter:blur(24px) saturate(160%);-webkit-backdrop-filter:blur(24px) saturate(160%);box-shadow:0 16px 42px rgba(0,0,0,.36);color:#f5fff8;font:13px -apple-system,BlinkMacSystemFont,sans-serif}#matcha-air-native-suggestions button{display:block;width:100%;padding:10px 12px;border:0;border-radius:10px;background:transparent;color:inherit;text-align:left;font:inherit;cursor:pointer}#matcha-air-native-suggestions button:hover{background:rgba(255,255,255,.13)}#matcha-air-native-suggestions small{display:block;margin-top:3px;color:rgba(255,255,255,.62);font-size:11px}';
        panel = document.createElement('div');
        panel.id = 'matcha-air-native-suggestions';
        panel.style.left = window.__matchaAirSidebarExpanded ? '230px' : '76px';
        (Array.isArray(items) ? items : []).forEach((item, index) => {
          const button = document.createElement('button');
          button.type = 'button'; button.textContent = item.label || '';
          if (item.url) { const small = document.createElement('small'); small.textContent = item.url; button.appendChild(small); }
          button.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); send('browser-suggestion-picked', { index }); panel.remove(); });
          panel.appendChild(button);
        });
        if (loading) { const status = document.createElement('small'); status.textContent = 'Finding more suggestions…'; status.style.padding = '8px 12px'; panel.appendChild(status); }
        document.body.appendChild(panel);
      };
      window.__matchaAirSetTranslateMenu = (open) => {
        let menu = document.getElementById('matcha-air-native-translate');
        if (!open) { menu?.remove(); return; }
        if (menu) return;
        let style = document.getElementById('matcha-air-native-translate-style');
        if (!style) { style = document.createElement('style'); style.id = 'matcha-air-native-translate-style'; document.head?.appendChild(style); }
        style.textContent = '#matcha-air-native-translate{position:fixed;z-index:2147483647;right:16px;top:16px;width:220px;max-height:70vh;overflow:auto;padding:8px;border:1px solid rgba(255,255,255,.2);border-radius:16px;background:rgba(25,35,31,.92);backdrop-filter:blur(24px) saturate(160%);-webkit-backdrop-filter:blur(24px) saturate(160%);box-shadow:0 16px 42px rgba(0,0,0,.36);color:#f5fff8;font:13px -apple-system,BlinkMacSystemFont,sans-serif}#matcha-air-native-translate button{display:block;width:100%;padding:9px 11px;border:0;border-radius:10px;background:transparent;color:inherit;text-align:left;font:inherit;cursor:pointer}#matcha-air-native-translate button:hover{background:rgba(255,255,255,.13)}#matcha-air-native-translate .ma-translate-title{padding:6px 10px 8px;color:#a8e6bd;font-weight:700}';
        menu = document.createElement('div'); menu.id = 'matcha-air-native-translate';
        const title = document.createElement('div'); title.className = 'ma-translate-title'; title.textContent = 'Choose a language'; menu.appendChild(title);
        [['en','English'],['zh','Mandarin Chinese'],['hi','Hindi'],['es','Spanish'],['fr','French'],['ar','Arabic'],['bn','Bengali'],['ru','Russian'],['pt','Portuguese'],['ur','Urdu']].forEach(([code,label]) => {
          const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
          button.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); send('browser-translate-selection', { code, label }); menu.remove(); });
          menu.appendChild(button);
        });
        document.body?.appendChild(menu);
      };
      // The native website sidebar was removed: navigation belongs to Matcha's host UI,
      // not a second floating pill injected into every visited website.
    })();"#
}

fn create_browser_webview(
    app: &tauri::AppHandle,
    tab_id: &str,
    url: Url,
    bounds: Bounds,
    proxy: Option<Url>,
) -> Result<Webview, String> {
    let label = webview_label(tab_id)?;
    let window = app.get_window(MAIN_WINDOW).ok_or("Main window not found")?;
    let tab_for_title = tab_id.to_owned();
    let tab_for_popup = tab_id.to_owned();
    let tab_for_load = tab_id.to_owned();
    let tab_for_download = tab_id.to_owned();
    let app_for_title = app.clone();
    let app_for_popup = app.clone();
    let app_for_load = app.clone();
    let app_for_download = app.clone();
    let mut builder = WebviewBuilder::new(label, WebviewUrl::External(url.clone()))
        .initialization_script(format!("window.__matchaAirFrameRadius = {};", bounds.radius))
        .initialization_script(menu_bridge_script())
        .initialization_script(protection_script(
            app.state::<BrowserState>().ad_block.load(Ordering::Relaxed),
            app.state::<BrowserState>().tracker_block.load(Ordering::Relaxed),
        ))
        .on_new_window(move |url, _features| {
            let url = url.to_string();
            if checked_url(&url).is_ok() {
                let _ = app_for_popup.emit_to(
                    MAIN_WINDOW,
                    "browser-open-link",
                    json!({ "tab_id": tab_for_popup, "url": url, "new_tab": true }),
                );
            }
            tauri::webview::NewWindowResponse::Deny
        })
        .on_document_title_changed(move |_webview, title| {
            let _ = app_for_title.emit_to(
                MAIN_WINDOW,
                "browser-page-title",
                json!({ "tab_id": tab_for_title, "title": title }),
            );
        })
        .on_page_load(move |_webview, payload| {
            let _ = app_for_load.emit_to(MAIN_WINDOW, "browser-page-state", json!({
                "tab_id": tab_for_load,
                "url": payload.url().as_str(),
                "loaded": matches!(payload.event(), tauri::webview::PageLoadEvent::Finished)
            }));
        })
        .on_download(move |_webview, event| {
            let state = app_for_download.state::<BrowserState>();
            match event {
                DownloadEvent::Requested { url, destination } => {
                    let url_string = url.to_string();
                    let name = safe_download_name(&url, None);
                    if state.download_guard.load(Ordering::Relaxed) {
                        let _ = app_for_download.emit_to(MAIN_WINDOW, "browser-download", json!({
                            "name": name, "url": url_string, "status": "blocked", "reason": "Blocked by Download Guard", "date": 0
                        }));
                        return false;
                    }
                    match unique_download_path(&app_for_download, &name) {
                        Ok(path) => {
                            *destination = path.clone();
                            if let Ok(mut paths) = state.download_paths.lock() {
                                paths.insert((tab_for_download.clone(), url_string.clone()), path.clone());
                            }
                            let _ = app_for_download.emit_to(MAIN_WINDOW, "browser-download", json!({
                                "name": name, "url": url_string, "path": path.to_string_lossy(), "status": "downloading", "date": 0
                            }));
                            true
                        }
                        Err(error) => {
                            let _ = app_for_download.emit_to(MAIN_WINDOW, "browser-download", json!({
                                "name": name, "url": url_string, "status": "failed", "reason": error, "date": 0
                            }));
                            false
                        }
                    }
                }
                DownloadEvent::Finished { url, success, .. } => {
                    let url_string = url.to_string();
                    let path = state.download_paths.lock().ok().and_then(|mut paths| {
                        paths.remove(&(tab_for_download.clone(), url_string.clone()))
                    });
                    let name = path.as_ref().and_then(|p| p.file_name()).and_then(|n| n.to_str()).unwrap_or("download");
                    let _ = app_for_download.emit_to(MAIN_WINDOW, "browser-download", json!({
                        "name": name, "url": url_string, "path": path.map(|p| p.to_string_lossy().into_owned()),
                        "status": if success { "completed" } else { "failed" }, "reason": if success { "" } else { "The browser could not finish this download." }, "date": 0
                    }));
                    true
                }
                _ => true,
            }
        });
    if let Some(proxy) = proxy {
        builder = builder.proxy_url(proxy);
    }
    window
        .add_child(
            builder,
            LogicalPosition::new(bounds.x, bounds.y),
            LogicalSize::new(bounds.width, bounds.height),
        )
        .map_err(|error| format!("Could not create the browser view: {error}"))
}

#[tauri::command]
async fn navigate_browser(
    app: tauri::AppHandle,
    state: State<'_, BrowserState>,
    tab_id: String,
    url: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    radius: Option<f64>,
) -> Result<(), String> {
    let url = checked_url(&url)?;
    let label = webview_label(&tab_id)?;
    let bounds = checked_bounds(x, y, width, height, radius)?;
    let previous_tab = state
        .active_tab
        .lock()
        .map_err(|_| "Browser state unavailable")?
        .clone();
    if let Some(previous) = previous_tab
        .as_deref()
        .filter(|previous| *previous != tab_id)
    {
        if let Ok(previous_label) = webview_label(previous) {
            if let Some(webview) = app.get_webview(&previous_label) {
                let _ = webview.eval("window.__matchaAirSetActive?.(false)");
                webview.hide().map_err(|error| error.to_string())?;
            }
        }
    }
    *state
        .active_tab
        .lock()
        .map_err(|_| "Browser state unavailable")? = Some(tab_id.clone());
    *state
        .bounds
        .lock()
        .map_err(|_| "Browser bounds unavailable")? = Some(bounds);

    let webview = if let Some(webview) = app.get_webview(&label) {
        let current_url = webview.url().ok();
        if current_url
            .as_ref()
            .is_none_or(|current| current.as_str() != url.as_str())
        {
            webview
                .navigate(url)
                .map_err(|error| format!("Page navigation failed: {error}"))?;
        }
        webview
    } else {
        let webview = create_browser_webview(&app, &tab_id, url, bounds, active_proxy(&state)?)?;
        state
            .tabs
            .lock()
            .map_err(|_| "Browser state unavailable")?
            .insert(tab_id.clone());
        webview
    };
    move_and_size(&webview, bounds)?;
    webview.eval("window.__matchaAirSetActive?.(true)").ok();
    webview.show().map_err(|error| error.to_string())?;
    let _ = webview.set_focus();
    Ok(())
}

#[tauri::command]
async fn resize_browser_webview(
    app: tauri::AppHandle,
    state: State<'_, BrowserState>,
    tab_id: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    radius: Option<f64>,
) -> Result<(), String> {
    if !state.is_active(&tab_id) {
        return Ok(());
    }
    let bounds = checked_bounds(x, y, width, height, radius)?;
    *state
        .bounds
        .lock()
        .map_err(|_| "Browser bounds unavailable")? = Some(bounds);
    if let Some(webview) = app.get_webview(&webview_label(&tab_id)?) {
        move_and_size(&webview, bounds)?;
        let radius = bounds.radius;
        let _ = webview.eval(&format!(
            "window.__matchaAirFrameRadius = {radius}; for (const root of [document.documentElement, document.body]) if (root) {{ root.style.overflow = 'hidden'; root.style.clipPath = 'inset(0 round {radius}px)'; root.style.webkitClipPath = 'inset(0 round {radius}px)'; root.style.borderRadius = '{radius}px'; }}"
        ));
    }
    Ok(())
}

#[tauri::command]
async fn set_browser_visible(
    app: tauri::AppHandle,
    state: State<'_, BrowserState>,
    tab_id: String,
    visible: bool,
) -> Result<(), String> {
    if !state.is_active(&tab_id) {
        return Ok(());
    }
    if let Some(webview) = app.get_webview(&webview_label(&tab_id)?) {
        if visible {
            if let Some(bounds) = *state
                .bounds
                .lock()
                .map_err(|_| "Browser bounds unavailable")?
            {
                move_and_size(&webview, bounds)?;
            }
            let _ = webview.eval("window.__matchaAirSetActive?.(true)");
            webview.show().map_err(|error| error.to_string())?;
        } else {
            let _ = webview.eval("window.__matchaAirSetActive?.(false)");
            webview.hide().map_err(|error| error.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
async fn hide_browser(app: tauri::AppHandle, tab_id: String) -> Result<(), String> {
    if let Some(webview) = app.get_webview(&webview_label(&tab_id)?) {
        let _ = webview.eval("window.__matchaAirSetActive?.(false)");
        webview.hide().map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn close_browser(
    app: tauri::AppHandle,
    state: State<'_, BrowserState>,
    tab_id: String,
) -> Result<(), String> {
    if let Some(webview) = app.get_webview(&webview_label(&tab_id)?) {
        webview.close().map_err(|error| error.to_string())?;
    }
    state
        .tabs
        .lock()
        .map_err(|_| "Browser state unavailable")?
        .remove(&tab_id);
    if state.is_active(&tab_id) {
        *state
            .active_tab
            .lock()
            .map_err(|_| "Browser state unavailable")? = None;
    }
    Ok(())
}

#[tauri::command]
async fn close_browser_window(
    app: tauri::AppHandle,
    state: State<'_, BrowserState>,
) -> Result<(), String> {
    let active = state
        .active_tab
        .lock()
        .map_err(|_| "Browser state unavailable")?
        .clone();
    if let Some(tab_id) = active {
        if let Some(webview) = app.get_webview(&webview_label(&tab_id)?) {
            let _ = webview.eval("window.__matchaAirSetActive?.(false)");
            webview.hide().map_err(|error| error.to_string())?;
        }
    }
    *state
        .active_tab
        .lock()
        .map_err(|_| "Browser state unavailable")? = None;
    Ok(())
}

#[tauri::command]
async fn navigate_browser_back(
    app: tauri::AppHandle,
    state: State<'_, BrowserState>,
    tab_id: String,
) -> Result<(), String> {
    if state.is_active(&tab_id) {
        if let Some(webview) = app.get_webview(&webview_label(&tab_id)?) {
            webview
                .eval("history.back()")
                .map_err(|error| error.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
async fn navigate_browser_forward(
    app: tauri::AppHandle,
    state: State<'_, BrowserState>,
    tab_id: String,
) -> Result<(), String> {
    if state.is_active(&tab_id) {
        if let Some(webview) = app.get_webview(&webview_label(&tab_id)?) {
            webview
                .eval("history.forward()")
                .map_err(|error| error.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
async fn reload_browser(
    app: tauri::AppHandle,
    state: State<'_, BrowserState>,
    tab_id: String,
    _hard: Option<bool>,
) -> Result<(), String> {
    if state.is_active(&tab_id) {
        if let Some(webview) = app.get_webview(&webview_label(&tab_id)?) {
            webview.reload().map_err(|error| error.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
async fn set_browser_sidebar(
    app: tauri::AppHandle,
    state: State<'_, BrowserState>,
    tab_id: String,
    compact: bool,
) -> Result<(), String> {
    if !state.is_active(&tab_id) {
        return Ok(());
    }
    state.sidebar_expanded.store(!compact, Ordering::Relaxed);
    let tab_ids = state
        .tabs
        .lock()
        .map_err(|_| "Browser state unavailable")?
        .iter()
        .cloned()
        .collect::<Vec<_>>();
    let script = format!("window.__matchaAirSetSidebarExpanded?.({})", !compact);
    for tab in tab_ids {
        if let Some(webview) = app.get_webview(&webview_label(&tab)?) {
            webview.eval(&script).map_err(|error| error.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
async fn set_browser_menu(
    app: tauri::AppHandle,
    state: State<'_, BrowserState>,
    tab_id: String,
    open: bool,
) -> Result<(), String> {
    if state.is_active(&tab_id) {
        if let Some(webview) = app.get_webview(&webview_label(&tab_id)?) {
            webview
                .eval(&format!("window.__matchaAirSetMenuOpen?.({open})"))
                .map_err(|error| error.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
async fn set_browser_suggestions(
    app: tauri::AppHandle,
    state: State<'_, BrowserState>,
    tab_id: String,
    items: Vec<Value>,
    open: bool,
    loading: bool,
) -> Result<(), String> {
    if !state.is_active(&tab_id) {
        return Ok(());
    }
    let items = items
        .into_iter()
        .take(12)
        .map(|item| json!({
            "label": item.get("label").and_then(Value::as_str).unwrap_or_default().chars().take(180).collect::<String>(),
            "url": item.get("url").and_then(Value::as_str).unwrap_or_default().chars().take(2048).collect::<String>()
        }))
        .collect::<Vec<_>>();
    let items = serde_json::to_string(&items).map_err(|error| error.to_string())?;
    let script = format!("window.__matchaAirSetSuggestions?.({items}, {open}, {loading})");
    if let Some(webview) = app.get_webview(&webview_label(&tab_id)?) {
        webview.eval(script).map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn set_browser_translate_menu(
    app: tauri::AppHandle,
    state: State<'_, BrowserState>,
    tab_id: String,
    open: bool,
) -> Result<(), String> {
    if state.is_active(&tab_id) {
        if let Some(webview) = app.get_webview(&webview_label(&tab_id)?) {
            webview
                .eval(&format!("window.__matchaAirSetTranslateMenu?.({open})"))
                .map_err(|error| error.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
async fn set_browser_protection(
    app: tauri::AppHandle,
    state: State<'_, BrowserState>,
    download_guard: bool,
    ad_block: bool,
    tracker_block: bool,
) -> Result<(), String> {
    state
        .download_guard
        .store(download_guard, Ordering::Relaxed);
    state.ad_block.store(ad_block, Ordering::Relaxed);
    state.tracker_block.store(tracker_block, Ordering::Relaxed);
    let tab_ids = state
        .tabs
        .lock()
        .map_err(|_| "Browser state unavailable")?
        .iter()
        .cloned()
        .collect::<Vec<_>>();
    let script = protection_script(ad_block, tracker_block);
    for tab_id in tab_ids {
        if let Ok(label) = webview_label(&tab_id) {
            if let Some(webview) = app.get_webview(&label) {
                webview.eval(&script).map_err(|error| error.to_string())?;
            }
        }
    }
    Ok(())
}

fn parse_proxy_url(enabled: bool, server: &str, proxy_type: &str) -> Result<Option<Url>, String> {
    if !enabled {
        return Ok(None);
    }
    if server.trim().is_empty() || proxy_type == "matcha" {
        return Err("Enter an HTTP or SOCKS5 proxy server in Settings first.".into());
    }
    let candidate = if proxy_type == "ip" && !server.contains("://") {
        format!("http://{server}")
    } else {
        server.to_owned()
    };
    let url = Url::parse(&candidate).map_err(|error| format!("Invalid proxy address: {error}"))?;
    if !matches!(url.scheme(), "http" | "socks5") || url.host_str().is_none() {
        return Err("Use an HTTP or SOCKS5 proxy address.".into());
    }
    Ok(Some(url))
}

#[tauri::command]
async fn set_browser_proxy(
    app: tauri::AppHandle,
    state: State<'_, BrowserState>,
    enabled: bool,
    server: String,
    proxy_type: String,
) -> Result<(), String> {
    let next_proxy = parse_proxy_url(enabled, &server, &proxy_type)?;
    let current_proxy = active_proxy(&state)?;
    if current_proxy == next_proxy {
        return Ok(());
    }
    let active_tab = state
        .active_tab
        .lock()
        .map_err(|_| "Browser state unavailable")?
        .clone();
    let bounds = *state
        .bounds
        .lock()
        .map_err(|_| "Browser bounds unavailable")?;
    let tab_ids = state
        .tabs
        .lock()
        .map_err(|_| "Browser state unavailable")?
        .iter()
        .cloned()
        .collect::<Vec<_>>();
    let mut targets = Vec::new();
    for tab_id in tab_ids {
        if let Some(view) = app.get_webview(&webview_label(&tab_id)?) {
            if let Ok(url) = view.url() {
                targets.push((tab_id, url));
            }
        }
    }
    for (tab_id, _) in &targets {
        if let Some(view) = app.get_webview(&webview_label(tab_id)?) {
            view.close().map_err(|error| error.to_string())?;
        }
    }
    state
        .tabs
        .lock()
        .map_err(|_| "Browser state unavailable")?
        .clear();
    *state
        .proxy_url
        .lock()
        .map_err(|_| "Proxy settings unavailable")? = next_proxy.clone();
    if let Some(bounds) = bounds {
        for (tab_id, url) in targets {
            let view = create_browser_webview(&app, &tab_id, url, bounds, next_proxy.clone())?;
            if active_tab.as_deref() == Some(tab_id.as_str()) {
                view.show().map_err(|error| error.to_string())?;
            } else {
                view.hide().map_err(|error| error.to_string())?;
            }
            state
                .tabs
                .lock()
                .map_err(|_| "Browser state unavailable")?
                .insert(tab_id);
        }
    }
    Ok(())
}

#[tauri::command]
async fn start_browser_download(
    app: tauri::AppHandle,
    state: State<'_, BrowserState>,
    tab_id: String,
    url: String,
    filename: Option<String>,
) -> Result<(), String> {
    if !state.is_active(&tab_id) {
        return Err("The page is no longer active.".into());
    }
    let url = checked_url(&url)?;
    if state.download_guard.load(Ordering::Relaxed) {
        return Err("Blocked by Download Guard.".into());
    }
    let script_url = serde_json::to_string(url.as_str()).map_err(|error| error.to_string())?;
    let name = safe_download_name(&url, filename.as_deref());
    let script_name = serde_json::to_string(&name).map_err(|error| error.to_string())?;
    let label = webview_label(&tab_id)?;
    if let Some(webview) = app.get_webview(&label) {
        let script = format!(
            "(() => {{ const a = document.createElement('a'); a.href = {script_url}; a.download = {script_name}; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove(); }})()"
        );
        webview.eval(script).map_err(|error| error.to_string())?;
        Ok(())
    } else {
        Err("The browser page is not available.".into())
    }
}

#[tauri::command]
async fn download_url(
    app: tauri::AppHandle,
    state: State<'_, BrowserState>,
    url: String,
    filename: String,
) -> Result<(), String> {
    let url = checked_url(&url)?;
    let name = safe_download_name(&url, Some(&filename));
    if state.download_guard.load(Ordering::Relaxed) {
        let reason = "Blocked by Download Guard";
        let _ = app.emit(
            "browser-download",
            json!({ "name": name, "url": url, "status": "blocked", "reason": reason, "date": 0 }),
        );
        return Err(reason.into());
    }
    let path = unique_download_path(&app, &name)?;
    let partial = path.with_file_name(format!(
        ".{}.matcha-part",
        path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("download")
    ));
    let _ = app.emit("browser-download", json!({ "name": name, "url": url, "path": path.to_string_lossy(), "status": "downloading", "date": 0 }));
    let result: Result<(), String> = async {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(300))
            .user_agent("Matcha Air/1.0")
            .build()
            .map_err(|error| format!("Could not prepare the download: {error}"))?;
        let mut response = client
            .get(url.clone())
            .send()
            .await
            .map_err(|error| format!("Download request failed: {error}"))?
            .error_for_status()
            .map_err(|error| format!("The server refused the download: {error}"))?;
        if response.url().scheme() != "http" && response.url().scheme() != "https" {
            return Err("The download redirected to an unsupported address.".into());
        }
        const MAX_DOWNLOAD_BYTES: u64 = 2 * 1024 * 1024 * 1024;
        let total = response.content_length();
        if total.is_some_and(|size| size > MAX_DOWNLOAD_BYTES) {
            return Err("This download is larger than Matcha Air currently allows (2 GB).".into());
        }
        let mut file = File::options()
            .write(true)
            .create_new(true)
            .open(&partial)
            .map_err(|error| format!("Could not create a temporary download file: {error}"))?;
        let mut received = 0_u64;
        while let Some(chunk) = response
            .chunk()
            .await
            .map_err(|error| format!("The download connection was interrupted: {error}"))?
        {
            received = received.saturating_add(chunk.len() as u64);
            if received > MAX_DOWNLOAD_BYTES {
                return Err("This download exceeded Matcha Air's 2 GB limit.".into());
            }
            file.write_all(&chunk)
                .map_err(|error| format!("Could not save the download: {error}"))?;
            if let Some(total) = total {
                let progress = ((received as f64 / total.max(1) as f64) * 100.0).clamp(0.0, 100.0);
                let _ = app.emit("browser-download", json!({ "name": name, "url": url, "path": path.to_string_lossy(), "status": "downloading", "progress": progress, "date": 0 }));
            }
        }
        file.flush().map_err(|error| format!("Could not finish writing the download: {error}"))?;
        drop(file);
        fs::rename(&partial, &path)
            .map_err(|error| format!("Could not move the completed file into Downloads: {error}"))?;
        Ok(())
    }
    .await;
    match result {
        Ok(()) => {
            let _ = app.emit("browser-download", json!({ "name": name, "url": url, "path": path.to_string_lossy(), "status": "completed", "date": 0 }));
            Ok(())
        }
        Err(error) => {
            let _ = fs::remove_file(&partial);
            let _ = app.emit("browser-download", json!({ "name": name, "url": url, "path": path.to_string_lossy(), "status": "failed", "reason": error, "date": 0 }));
            Err(error)
        }
    }
}

fn clean_string(payload: &Value, key: &str, max: usize) -> String {
    payload
        .get(key)
        .and_then(Value::as_str)
        .unwrap_or_default()
        .chars()
        .take(max)
        .collect()
}

fn download_path(app: &tauri::AppHandle, requested: &str) -> Result<PathBuf, String> {
    let root = app
        .path()
        .download_dir()
        .map_err(|error| error.to_string())?;
    std::fs::create_dir_all(&root)
        .map_err(|error| format!("Could not access the Downloads folder: {error}"))?;
    let root = root.canonicalize().map_err(|error| error.to_string())?;
    let requested_path = Path::new(requested);
    let candidate = if requested_path.is_absolute() {
        requested_path.to_path_buf()
    } else {
        if requested_path.components().count() != 1 || requested == "." || requested == ".." {
            return Err("The download path is invalid.".into());
        }
        root.join(requested_path)
    };
    let candidate = candidate
        .canonicalize()
        .map_err(|error| format!("The downloaded file is not available: {error}"))?;
    if !candidate.starts_with(&root) || !candidate.is_file() {
        return Err("The file is outside the Downloads folder or is not a regular file.".into());
    }
    Ok(candidate)
}

#[tauri::command]
async fn ensure_data_folder(app: tauri::AppHandle) -> Result<(), String> {
    let path = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    std::fs::create_dir_all(path)
        .map_err(|error| format!("Could not create the app data folder: {error}"))
}

#[tauri::command]
async fn open_download(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let path = download_path(&app, &path)?;
    #[cfg(target_os = "macos")]
    let mut command = {
        let mut command = Command::new("open");
        command.arg(&path);
        command
    };
    #[cfg(target_os = "windows")]
    let mut command = {
        let mut command = Command::new("cmd");
        command.args(["/C", "start", "", path.to_string_lossy().as_ref()]);
        command
    };
    #[cfg(all(unix, not(target_os = "macos")))]
    let mut command = {
        let mut command = Command::new("xdg-open");
        command.arg(&path);
        command
    };
    command
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("Could not open the downloaded file: {error}"))
}

#[tauri::command]
async fn reveal_download(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let path = download_path(&app, &path)?;
    #[cfg(target_os = "macos")]
    let mut command = {
        let mut command = Command::new("open");
        command.args(["-R", path.to_string_lossy().as_ref()]);
        command
    };
    #[cfg(target_os = "windows")]
    let mut command = {
        let mut command = Command::new("explorer");
        command.arg(format!("/select,{}", path.to_string_lossy()));
        command
    };
    #[cfg(all(unix, not(target_os = "macos")))]
    let mut command = {
        let mut command = Command::new("xdg-open");
        command.arg(path.parent().unwrap_or(Path::new(".")));
        command
    };
    command
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("Could not show the downloaded file: {error}"))
}

#[tauri::command]
async fn browser_bridge_event(
    app: tauri::AppHandle,
    state: State<'_, BrowserState>,
    webview: Webview,
    event: String,
    payload: Value,
) -> Result<(), String> {
    let Some(tab_id) = webview.label().strip_prefix(BROWSER_WEBVIEW_PREFIX) else {
        return Err("The browser page cannot send this event.".into());
    };
    if !state.is_active(tab_id) {
        return Ok(());
    }
    let tab_id = tab_id.to_owned();
    match event.as_str() {
        "browser-open-link" => {
            let url = clean_string(&payload, "url", 8192);
            checked_url(&url)?;
            app.emit_to("main", "browser-open-link", json!({ "tab_id": tab_id, "url": url, "new_tab": payload.get("new_tab").and_then(Value::as_bool).unwrap_or(false) }))
                .map_err(|error| error.to_string())?;
        }
        "browser-url-change" => {
            let url = clean_string(&payload, "url", 8192);
            let url = checked_url(&url)?.to_string();
            app.emit_to(
                MAIN_WINDOW,
                "browser-page-state",
                json!({ "tab_id": tab_id, "url": url, "loaded": true }),
            )
            .map_err(|error| error.to_string())?;
        }
        "browser-context-menu" => {
            let page = clean_string(&payload, "page", 8192);
            let page = checked_url(&page)
                .map(|url| url.to_string())
                .unwrap_or_default();
            let link = clean_string(&payload, "link", 8192);
            let image = clean_string(&payload, "image", 8192);
            let media_url = clean_string(&payload, "media_url", 8192);
            let safe_resource = |value: String| {
                checked_url(&value)
                    .map(|url| url.to_string())
                    .unwrap_or_default()
            };
            app.emit_to("main", "browser-context-menu", json!({
                "tab_id": tab_id, "page": page,
                "link": safe_resource(link), "image": safe_resource(image), "media_url": safe_resource(media_url),
                "selection": clean_string(&payload, "selection", 8192),
                "editable": payload.get("editable").and_then(Value::as_bool).unwrap_or(false),
                "read_only": payload.get("read_only").and_then(Value::as_bool).unwrap_or(false),
                "media": match payload.get("media").and_then(Value::as_str) { Some("audio") => "audio", Some("video") => "video", _ => "" },
                "media_playing": payload.get("media_playing").and_then(Value::as_bool).unwrap_or(false),
                "media_muted": payload.get("media_muted").and_then(Value::as_bool).unwrap_or(false),
                "x": payload.get("x").and_then(Value::as_f64).unwrap_or(0.0).clamp(0.0, 100_000.0),
                "y": payload.get("y").and_then(Value::as_f64).unwrap_or(0.0).clamp(0.0, 100_000.0)
            })).map_err(|error| error.to_string())?;
        }
        "browser-sidebar-toggle" => {
            app.emit_to(
                "main",
                "browser-sidebar-toggle",
                json!({
                    "tab_id": tab_id,
                    "expanded": payload.get("expanded").and_then(Value::as_bool).unwrap_or(false)
                }),
            )
            .map_err(|error| error.to_string())?;
        }
        "browser-sidebar-nav" => {
            let page = clean_string(&payload, "page", 32);
            if !matches!(
                page.as_str(),
                "home"
                    | "ai"
                    | "games"
                    | "history"
                    | "downloads"
                    | "trackers"
                    | "passwords"
                    | "settings"
            ) {
                return Err("Unsupported sidebar page.".into());
            }
            app.emit_to(
                "main",
                "browser-sidebar-nav",
                json!({ "tab_id": tab_id, "page": page }),
            )
            .map_err(|error| error.to_string())?;
        }
        "browser-menu-action" => {
            let action = clean_string(&payload, "action", 24);
            if !matches!(action.as_str(), "settings" | "history" | "downloads") {
                return Err("Unsupported browser menu action.".into());
            }
            app.emit_to(
                "main",
                "browser-menu-action",
                json!({ "tab_id": tab_id, "action": action }),
            )
            .map_err(|error| error.to_string())?;
        }
        "browser-menu-dismissed" => {
            app.emit_to(
                MAIN_WINDOW,
                "browser-menu-dismissed",
                json!({ "tab_id": tab_id }),
            )
            .map_err(|error| error.to_string())?;
        }
        "browser-translate-dismissed" => {
            app.emit_to(
                MAIN_WINDOW,
                "browser-translate-dismissed",
                json!({ "tab_id": tab_id }),
            )
            .map_err(|error| error.to_string())?;
        }
        "browser-suggestion-picked" => {
            let index = payload
                .get("index")
                .and_then(Value::as_u64)
                .unwrap_or(usize::MAX as u64)
                .min(usize::MAX as u64) as usize;
            app.emit_to(
                MAIN_WINDOW,
                "browser-suggestion-picked",
                json!({ "tab_id": tab_id, "index": index }),
            )
            .map_err(|error| error.to_string())?;
        }
        "browser-translate-selection" => {
            let code = clean_string(&payload, "code", 8);
            let label = clean_string(&payload, "label", 48);
            let allowed = ["en", "zh", "hi", "es", "fr", "ar", "bn", "ru", "pt", "ur"];
            if !allowed.contains(&code.as_str()) {
                return Err("Unsupported translation language.".into());
            }
            app.emit_to(
                MAIN_WINDOW,
                "browser-translate-selection",
                json!({ "tab_id": tab_id, "code": code, "label": label }),
            )
            .map_err(|error| error.to_string())?;
        }
        _ => return Err("Unsupported browser event.".into()),
    }
    Ok(())
}

#[tauri::command]
async fn browser_context_action(
    app: tauri::AppHandle,
    state: State<'_, BrowserState>,
    tab_id: String,
    action: String,
    text: Option<String>,
) -> Result<(), String> {
    if !state.is_active(&tab_id) {
        return Ok(());
    }
    let script_action = match action.as_str() {
        "select_all" => "select_all",
        "cut" => "cut",
        "paste" => "paste",
        "play" => "play",
        "pause" => "pause",
        "mute" => "mute",
        "unmute" => "unmute",
        _ => return Err("Unsupported context action.".into()),
    };
    let value =
        serde_json::to_string(&text.unwrap_or_default()).map_err(|error| error.to_string())?;
    let script = format!(
        r#"(() => {{ const t = window.__matchaContextTarget; if (!t) return; const action = {script_action:?}; const text = {value}; if (action === 'play' && t.play) t.play().catch(() => {{}}); else if (action === 'pause' && t.pause) t.pause(); else if (action === 'mute' && 'muted' in t) t.muted = true; else if (action === 'unmute' && 'muted' in t) t.muted = false; else if (action === 'select_all') {{ if (t.select) {{ t.focus(); t.select(); }} else document.execCommand('selectAll'); }} else if (action === 'cut') {{ if (t.setRangeText && typeof t.selectionStart === 'number') {{ const a = t.selectionStart, b = t.selectionEnd; t.setRangeText('', a, b, 'start'); t.dispatchEvent(new Event('input', {{ bubbles: true }})); }} else document.execCommand('delete'); }} else if (action === 'paste') {{ if (t.setRangeText && typeof t.selectionStart === 'number' && !t.readOnly && !t.disabled) {{ const a = t.selectionStart, b = t.selectionEnd; t.setRangeText(text, a, b, 'end'); t.dispatchEvent(new Event('input', {{ bubbles: true }})); }} else if (t.isContentEditable) document.execCommand('insertText', false, text); }} }})()"#
    );
    if let Some(webview) = app.get_webview(&webview_label(&tab_id)?) {
        webview.eval(script).map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(BrowserState::default())
        .invoke_handler(tauri::generate_handler![
            navigate_browser,
            resize_browser_webview,
            set_browser_visible,
            hide_browser,
            close_browser,
            close_browser_window,
            navigate_browser_back,
            navigate_browser_forward,
            reload_browser,
            set_browser_sidebar,
            set_browser_menu,
            set_browser_suggestions,
            set_browser_translate_menu,
            set_browser_protection,
            set_browser_proxy,
            start_browser_download,
            download_url,
            browser_bridge_event,
            browser_context_action,
            ensure_data_folder,
            open_download,
            reveal_download,
        ])
        .run(tauri::generate_context!())
        .expect("error while building Matcha Air");
}
