# Matcha Air — working notes

## What this app is

A Base44 **app-code** project: a Vite + React single-page frontend (the browser shell)
whose backend is Base44's **hosted platform** for app id `6ac98e2d78f3aeeb4ce7213b`
(`base44/functions/*` are Base44 serverless functions, `base44/entities/*` are platform
entities). There is **no bundled API server** in this repo to start.

`src-tauri/` is a macOS/Tauri desktop wrapper. It is **not** built or run here; the
native webview, permissions and native menu have no browser equivalent.

## Running it (Base44 sandbox / local dev)

```bash
docker compose -f docker-compose.base44.yml up -d      # web entry on host port 3000
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/   # expect 200
```

- The service runs `vite` from the bind-mounted source on `0.0.0.0:3000`, so edits live-reload
  (verified: touching `src/App.jsx` logs `[vite] hmr update`). No polling config is needed —
  bind-mount inotify events reach the dev server.
- `node_modules` lives in the named volume `matcha_node_modules` and is synced from
  `package-lock.json` by the container's startup command (`npm ci`). A marker file skips the
  reinstall on plain restarts; it re-runs when `package-lock.json` is newer.
- Host allowlist: the platform supplies `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS` and compose
  passes it through bare, so Vite accepts the preview proxy's hostname. `BASE44_PREVIEW_MODE`
  is passed through unused — nothing in this setup is gated on it, because no application
  configuration had to change to run here.

### Backend wiring (the one non-obvious setting)

`@base44/vite-plugin` proxies `/api` to `VITE_BASE44_APP_BASE_URL`; compose sets that (plus
`VITE_BASE44_APP_ID`) to the app's own hosted backend — the same pair of defaults the app
already falls back to in `src/lib/app-params.js`. Both values are public, not credentials.
Without the base URL the plugin logs *"No Base44 backend configured"* and every backend call
(the AI overview, web search, tracker scan, download scan) fails. Verify the wiring with:

```bash
curl -s http://localhost:3000/api/apps/public/prod/public-settings/by-id/6ac98e2d78f3aeeb4ce7213b
# -> {"id":"...","public_settings":"public_without_login"}
```

Backend calls hit the app's **hosted (production) backend** for that app id — the documented
"frontend only, hosted backend" mode. A local Base44 backend is not available in this sandbox:
`base44 dev` needs `base44 login` (interactive) plus Deno, and the app must be published first.

## Gotchas

- **`npm ci` fails on the original lockfile.** `vite@8` needs `chokidar@5`/`readdirp@5`, which
  the committed `package-lock.json` did not list. It was regenerated with
  `npm install --package-lock-only`; keep `package-lock.json` in sync or the container's
  startup `npm ci` will abort.
- **Tauri IPC errors in the browser console are expected.** `src/components/AppShell.jsx`
  guards its `invoke()` calls with an `isTauri()` check, but the `listen()` event
  registrations (around lines 469–483) are unguarded, so a plain browser logs
  `Cannot read properties of undefined (reading 'transformCallback')` on mount. It does not
  affect the web UI; it is not a defect introduced by this setup.
- The app boots to a first-run consent gate (`PermissionGate`, persisted in localStorage),
  then the browser shell. `public_settings` is `public_without_login`, so the UI loads
  without signing in.

## Verifying further changes

- `npm run lint` / `npm run build` inside the container:
  `docker compose -f docker-compose.base44.yml exec -T web npm run build`
- Health: `node -e "fetch('http://127.0.0.1:3000/')..."` (the compose healthcheck) — it probes
  the SPA document, not just the port.
