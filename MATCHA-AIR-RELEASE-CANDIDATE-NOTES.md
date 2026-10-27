# Matcha Air release-candidate notes

## Included
- Preserved the existing Matcha Air project and its previously added Addons/custom-pages and Liquid Glass Strength work.
- Added a Chrome-style destination preview inside native browsing pages. Hovering or keyboard-focusing a link displays its resolved HTTP(S) destination at the bottom-left; leaving the link hides it.
- Added a small inset to the native Tauri webview bounds so the frame stroke remains visible rather than being covered by the child webview.
- Added page-level rounded-corner/overflow styling to the native webview's initialization script as a best-effort clipping improvement.

## Verification and limitations
- The ZIP archive was integrity-checked after packaging.
- A frontend build and Rust formatting/build checks could not be run in this environment because Node dependencies and the Rust/Cargo toolchain are not installed.
- Native webview corner clipping varies by platform. The bounds inset preserves the outline, and the injected page styling attempts to clip content to rounded corners, but the final appearance must be visually checked in the macOS Tauri build before release.
- October 31, 2026 remains the planned release date; this ZIP is a release-candidate working copy, not a published release.


## Startup and new-tab search update
- Fixed custom startup URLs to be queued on the initial tab and navigated after the app shell mounts, rather than constructing the native browsing webview during the initial React render. This is a mitigation for the reported close-on-startup behavior; it still needs to be verified in the user's macOS build.
- Added an independent new-tab search provider preference, defaulting to Google. The address-bar provider remains independently configurable.
- Added Ecosia and Brave Search as selectable providers, alongside Google, Bing, Yahoo, DuckDuckGo, and Matcha Air AI.
- The address bar remains empty on a blank new tab.

## Additional verification notes
- Source-level checks confirmed the new-tab preference is read, persisted, subscribed to, and passed to the new-tab search UI; provider URL templates are present for Ecosia and Brave Search.
- `npm ci` could not complete in the environment before timeout, so a frontend build and native macOS reproduction test remain unverified. The startup mitigation is not claimed as a confirmed root-cause fix until tested on macOS.
