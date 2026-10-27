// =============================================================================
// Tauri Fetch Proxy — bypass CORS for the Base44 SDK in the desktop build
// =============================================================================
//
// In the packaged Tauri desktop app, the webview's origin is tauri://localhost
// (or http://tauri.localhost on Windows). The Base44 backend rejects cross-
// origin requests from this origin, so every SDK call (AI chat, search, entity
// CRUD, auth) fails with a CORS error.
//
// This module overrides window.fetch when running inside Tauri. All http/https
// requests are routed through the Rust `proxy_fetch` command, which makes the
// HTTP request from the native side — where CORS doesn't apply — and returns
// the status, headers, and body. Local requests (tauri://, asset://, data:)
// pass through to the original fetch untouched.
//
// Import this module BEFORE creating the Base44 SDK client so the override is
// in place before any request is made.
// =============================================================================

const isTauri = () => !!(window.__TAURI__ || window.__TAURI_INTERNALS__);

if (isTauri()) {
  const core = window.__TAURI__?.core || window.__TAURI_INTERNALS__;
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    // Resolve the URL from Request objects or raw strings.
    const url = typeof input === 'string' ? input : input?.url || String(input);

    // Only proxy external http/https requests. Local protocols (tauri://,
    // asset://, data:, blob:) pass through to the original fetch.
    if (!/^https?:\/\//i.test(url)) {
      return originalFetch(input, init);
    }

    const method = (init?.method || 'GET').toUpperCase();

    // Collect request headers into a plain object for the Rust command.
    const headers = {};
    if (init?.headers) {
      if (init.headers instanceof Headers) {
        init.headers.forEach((v, k) => { headers[k] = v; });
      } else if (Array.isArray(init.headers)) {
        init.headers.forEach(([k, v]) => { headers[k] = v; });
      } else if (typeof init.headers === 'object') {
        Object.assign(headers, init.headers);
      }
    }

    // Serialize the request body for the Rust command.
    let body = null;
    if (init?.body != null) {
      if (typeof init.body === 'string') {
        body = init.body;
      } else if (init.body instanceof URLSearchParams) {
        body = init.body.toString();
      } else if (init.body instanceof ArrayBuffer) {
        body = new TextDecoder().decode(init.body);
      } else if (init.body instanceof Uint8Array) {
        body = new TextDecoder().decode(init.body);
      } else if (typeof init.body === 'object') {
        body = JSON.stringify(init.body);
      } else {
        body = String(init.body);
      }
    }

    try {
      const result = await core.invoke('proxy_fetch', { url, method, headers, body });

      // Reconstruct a Response object from the Rust result.
      const responseHeaders = new Headers();
      if (result.headers && typeof result.headers === 'object') {
        Object.entries(result.headers).forEach(([k, v]) => {
          responseHeaders.set(k, String(v));
        });
      }

      return new Response(result.body || '', {
        status: result.status || 200,
        headers: responseHeaders,
      });
    } catch (err) {
      // If the proxy fails, throw a proper Error so the SDK's catch blocks
      // can show user-friendly messages instead of crashing.
      const msg = err?.message || String(err);
      throw new TypeError(`Network request failed (proxy): ${msg}`);
    }
  };

  console.log('[Matcha] Tauri fetch proxy installed — SDK calls routed through Rust');
}