// =============================================================================
// Matcha Air — Tauri v2 Multi-Webview Split Architecture
// =============================================================================
//
// The main window contains TWO webviews:
//   1. "main" — the Host UI Layer (vanilla HTML/JS: address bar, Go, Back)
//   2. "browser_content" — the Guest Layer (isolated child webview for
//      untrusted external web content)
//
// The child webview is positioned at (0, 80) — directly beneath the 80px
// address bar — and sized to fill the rest of the window. All guest-layer
// traffic is routed through a local proxy at http://127.0.0.1:8080 via
// the .proxy_url() builder method.
//
// Required Cargo features on the `tauri` crate:
//   - `unstable`     — unlocks Window/Webview separation + WebviewBuilder
//   - `macos-proxy`  — enables .proxy_url() on macOS (requires macOS 14+)
// =============================================================================

use tauri::{LogicalPosition, LogicalSize, Manager, Runtime, WebviewBuilder, WebviewUrl};
use url::Url;

/// The label we use for the child webview that renders external content.
const BROWSER_WEBVIEW_LABEL: &str = "browser_content";

/// Height of the fixed-top address bar in logical pixels. The child webview
/// is positioned at (0, ADDRESS_BAR_HEIGHT) so it sits directly beneath it.
/// This MUST match the #control-bar height in styles.css.
const ADDRESS_BAR_HEIGHT: f64 = 80.0;

/// The local proxy server that all guest-layer traffic is routed through.
/// The child webview's .proxy_url() is set to this when it is first spawned.
const PROXY_URL: &str = "http://127.0.0.1:8080";

// ---------------------------------------------------------------------------
// Positioning helpers
// ---------------------------------------------------------------------------

/// Calculate the child webview's logical size: full window width, and
/// window height minus the 80px address bar.
///
/// Tauri's `inner_size()` returns physical pixels. We divide by the
/// scale factor (e.g. 2.0 on a Retina display) to get logical pixels,
/// which is what `LogicalSize` and `LogicalPosition` expect.
fn guest_size<R: Runtime>(window: &tauri::Window<R>) -> Result<(f64, f64), String> {
    let size = window.inner_size().map_err(|e| e.to_string())?;
    let scale = window.scale_factor().unwrap_or(1.0);
    // Convert physical → logical: physical_px / scale = logical_px
    let width = size.width as f64 / scale;
    let height = (size.height as f64 / scale) - ADDRESS_BAR_HEIGHT;
    Ok((width, height))
}

// ---------------------------------------------------------------------------
// Tauri Commands (invoked from the frontend via invoke())
// ---------------------------------------------------------------------------

/// Navigate the child webview to a URL.
///
/// If the child webview (`browser_content`) already exists, navigate it to
/// the new URL and reposition/resize it to (0, 80) filling the rest of the
/// window. If it doesn't exist yet, spawn a new child webview at (0, 80)
/// with proxy routing through http://127.0.0.1:8080.
///
/// The frontend only passes the URL — the positioning math (x, y, width,
/// height) is handled entirely in Rust so the guest layer stays perfectly
/// aligned with the 80px address bar regardless of window size.
#[tauri::command]
async fn navigate_browser(url: String, app: tauri::AppHandle) -> Result<(), String> {
    let parsed = Url::parse(&url).map_err(|e| format!("Invalid URL: {e}"))?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err("Only http(s) URLs are allowed".into());
    }

    // get_window (not get_webview_window) returns a Window — the bare native
    // window. We need Window because add_child() only exists on Window, not
    // on WebviewWindow. This requires the `unstable` feature.
    let window = app
        .get_window("main")
        .ok_or("Main window not found")?;

    // Calculate the child webview's bounds: full width, height minus address bar
    let (width, height) = guest_size(&window)?;

    // get_webview returns the child Webview by label (requires `unstable`).
    if let Some(webview) = window.get_webview(BROWSER_WEBVIEW_LABEL) {
        // Child webview already exists — navigate it to the new URL and
        // reposition/resize to ensure it's correctly placed at (0, 80).
        log::info!("[navigate_browser] navigating existing webview to {url}");
        webview
            .navigate(parsed)
            .map_err(|e| format!("Navigation failed: {e}"))?;
        // Position at (0, 80) — directly beneath the address bar
        webview
            .set_position(LogicalPosition::new(0.0, ADDRESS_BAR_HEIGHT))
            .map_err(|e| e.to_string())?;
        // Size to fill the rest of the window
        webview
            .set_size(LogicalSize::new(width, height))
            .map_err(|e| e.to_string())?;
    } else {
        // Child webview doesn't exist yet — spawn a new one at (0, 80)
        // with all traffic routed through the local proxy.
        log::info!(
            "[navigate_browser] spawning child webview at (0, {}) size ({}, {}) with proxy {}",
            ADDRESS_BAR_HEIGHT, width, height, PROXY_URL
        );
        let proxy = Url::parse(PROXY_URL).map_err(|e| format!("Invalid proxy URL: {e}"))?;

        // Window::add_child is the correct API to attach a child webview to
        // an existing window. It takes the WebviewBuilder (with proxy_url set),
        // plus the position and size as separate parameters.
        // .proxy_url() routes ALL guest-layer HTTP/HTTPS traffic through the
        // specified proxy. Requires `unstable` + `macos-proxy` (macOS 14+).
        let builder = WebviewBuilder::new(BROWSER_WEBVIEW_LABEL, WebviewUrl::External(parsed))
            .proxy_url(proxy);

        let _webview = window
            .add_child(
                builder,
                LogicalPosition::new(0.0, ADDRESS_BAR_HEIGHT),
                LogicalSize::new(width, height),
            )
            .map_err(|e| format!("Failed to create webview: {e}"))?;
    }

    Ok(())
}

/// Navigate the child webview back in its browsing history.
///
/// Tauri v2's Webview struct has no built-in navigate_back() method — the
/// WebviewDispatch trait only exposes navigate(), reload(), and eval().
/// We use eval("history.back()") to invoke the browser's native history API
/// inside the guest webview's JavaScript context.
#[tauri::command]
async fn go_back(app: tauri::AppHandle) -> Result<bool, String> {
    let window = app.get_window("main").ok_or("Main window not found")?;
    if let Some(webview) = window.get_webview(BROWSER_WEBVIEW_LABEL) {
        webview
            .eval("history.back()")
            .map_err(|e| format!("Back navigation failed: {e}"))?;
        Ok(true)
    } else {
        Ok(false)
    }
}

/// Get the current URL of the child webview (for syncing the address bar).
#[tauri::command]
async fn get_browser_url(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let window = app.get_window("main").ok_or("Main window not found")?;
    if let Some(webview) = window.get_webview(BROWSER_WEBVIEW_LABEL) {
        match webview.url() {
            Ok(url) => Ok(Some(url.to_string())),
            Err(_) => Ok(None),
        }
    } else {
        Ok(None)
    }
}

/// Hide the child webview by moving it off-screen. Called when the user
/// leaves a web page so the native webview doesn't obscure the host UI.
#[tauri::command]
async fn hide_browser(app: tauri::AppHandle) -> Result<(), String> {
    let window = app.get_window("main").ok_or("Main window not found")?;
    if let Some(webview) = window.get_webview(BROWSER_WEBVIEW_LABEL) {
        webview
            .set_position(LogicalPosition::new(-10000.0, -10000.0))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// proxy_fetch — route Base44 SDK calls through Rust (CORS bypass for AI)
// ---------------------------------------------------------------------------

/// Proxy an HTTP request through Rust, bypassing the CORS wall that blocks
/// the Tauri webview's origin from reaching the Base44 API. The frontend
/// overrides window.fetch when running in Tauri and routes all http/https
/// calls through this command.
#[tauri::command]
async fn proxy_fetch(
    url: String,
    method: String,
    headers: serde_json::Value,
    body: Option<String>,
) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| format!("HTTP client build failed: {e}"))?;

    let method = reqwest::Method::from_bytes(method.as_bytes())
        .map_err(|e| format!("Invalid HTTP method: {e}"))?;

    let mut req = client.request(method, &url);

    if let Some(h) = headers.as_object() {
        for (key, val) in h {
            if let Some(v) = val.as_str() {
                req = req.header(key, v);
            }
        }
    }

    if let Some(b) = body {
        req = req.body(b);
    }

    let resp = req.send().await.map_err(|e| format!("Request failed: {e}"))?;
    let status = resp.status().as_u16();

    let mut resp_headers = serde_json::Map::new();
    for (k, v) in resp.headers().iter() {
        if let Ok(val) = v.to_str() {
            resp_headers.insert(k.as_str().to_string(), serde_json::Value::String(val.to_string()));
        }
    }

    let resp_body = resp.text().await.map_err(|e| format!("Read body failed: {e}"))?;

    Ok(serde_json::json!({
        "status": status,
        "headers": serde_json::Value::Object(resp_headers),
        "body": resp_body
    }))
}

// ---------------------------------------------------------------------------
// Application entry point
// ---------------------------------------------------------------------------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            navigate_browser,
            go_back,
            get_browser_url,
            hide_browser,
            proxy_fetch,
        ])
        // Keep the child webview sized correctly when the main window is
        // resized. The handler recalculates (width, height) from the
        // window's current inner size and applies it to the guest webview.
        .setup(|app| {
            let app_handle = app.handle().clone();
            if let Some(window) = app.get_window("main") {
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::Resized(_) = event {
                        if let Some(win) = app_handle.get_window("main") {
                            if let Some(webview) = win.get_webview(BROWSER_WEBVIEW_LABEL) {
                                if let Ok((w, h)) = guest_size(&win) {
                                    let _ = webview.set_size(LogicalSize::new(w, h));
                                }
                            }
                        }
                    }
                });
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
