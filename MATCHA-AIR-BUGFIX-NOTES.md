# Matcha Air bug-fix pass

This pass targets only reported defects; it adds no new product features.

## Changes made

- Addons page: imported the missing `Network` icon used in the Discover panel. That undefined JSX identifier could crash rendering of the entire page and explain the blank/black screen. The root text color now uses Matcha's actual `--text` theme token instead of the undefined `--text-primary` token.
- Removed the native sidebar that was injected into every website. It created the tall floating pill covering web content. Matcha's host UI navigation remains untouched.
- Link preview: installs its pointer listeners immediately instead of waiting for `DOMContentLoaded`, which can be delayed by busy pages. The status bubble fades in/out over 150 ms.
- Native webview corners: passes the measured frame radius through Tauri bounds and applies a matching `clip-path`/border radius to the loaded document root. Geometry updates refresh the radius.
- Startup URL setting: typing is now draft-only; the URL is normalized and persisted on blur, Enter, or Save URL, rather than writing browser preferences on every keystroke. Only HTTP(S) URLs are accepted.
- Matcha Lens: capture overlay controls share a single coordinate space; the capture overlay uses Matcha's active accent/glow CSS variables, and the Lens results panel uses the same theme instead of a separate accent palette.

## Verification and limitations

- The supplied ZIP extracted successfully before editing.
- The output ZIP was checked with `unzip -t` after packaging.
- Source landmark checks confirmed the missing icon import, removal of the injected sidebar mount, immediate link-preview installation, startup draft handling, and native radius propagation.
- A frontend build could not be run: dependencies were not present and `npm ci --ignore-scripts --no-audit --no-fund` timed out in this environment. Rust/Cargo are not installed here, so the Tauri backend was not compiled.
- The native webview clipping and Matcha Lens behavior still require visual verification in the actual macOS build. CSS clipping behavior can vary across WebKit content; this pass does not claim a macOS runtime test.
