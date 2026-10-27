import React, { useState } from 'react';
import { Wifi, Camera, MapPin, Bell, ShieldCheck, ChevronRight } from 'lucide-react';

// First-run consent gate. Shown once before the browser shell opens: lists the
// access Matcha requests (Local Network, Camera, Location, Notifications) and
// asks the user to Allow. Consent is persisted in localStorage so the gate only
// appears once. On the Tauri desktop build, "Allow" also primes the native
// permission prompts (notifications + a local-network probe); the macOS
// Local Network OS dialog is surfaced by actual local-network use, and the
// Info.plist usage strings (see src-tauri/Info.plist) give that dialog its text.

const STORAGE_KEY = 'matcha:permissions_granted';
const isTauri = () => !!(window.__TAURI__ || window.__TAURI_INTERNALS__);

const PERMISSIONS = [
  { icon: Wifi, title: 'Local Network', desc: 'Reach devices and services on your network — proxy, casting, file shares.' },
  { icon: Camera, title: 'Camera', desc: 'Sites you allow can use your camera for calls and scanning.' },
  { icon: MapPin, title: 'Location', desc: 'Sites you allow can see your approximate location.' },
  { icon: Bell, title: 'Notifications', desc: 'Get alerts from sites you allow and from Matcha Air.' },
];

async function requestNativePermissions() {
  // Notifications: real OS prompt, non-invasive.
  try { if ('Notification' in window) await Notification.requestPermission(); } catch { /* ignore */ }
  // Desktop: probe the local proxy to prime the runtime's local-network path.
  // Localhost alone doesn't trigger the macOS LAN dialog, but a real LAN
  // connection (proxy/casting) will, using the Info.plist usage string.
  if (isTauri()) {
    try {
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), 800);
      await fetch('http://127.0.0.1:8080', { mode: 'no-cors', signal: ctrl.signal });
    } catch { /* expected to fail/abort — we only want to prime the path */ }
  }
}

export default function PermissionGate({ children }) {
  const [granted, setGranted] = useState(() => !!localStorage.getItem(STORAGE_KEY));
  const [busy, setBusy] = useState(false);

  const allow = async () => {
    setBusy(true);
    await requestNativePermissions();
    localStorage.setItem(STORAGE_KEY, '1');
    setGranted(true);
    setBusy(false);
  };
  const skip = () => { localStorage.setItem(STORAGE_KEY, 'skipped'); setGranted(true); };

  if (granted) return children;

  return (
    <div className="app-root">
      <div className="app-bg-layer" />
      <div className="perm-gate">
        <div className="glass-panel perm-card">
          <div className="perm-head">
            <div className="perm-logo"><ShieldCheck size={26} /></div>
            <h1>Allow Matcha Air to connect</h1>
            <p>Matcha Air needs a few permissions to browse and protect you. You can change these anytime in Settings.</p>
          </div>
          <ul className="perm-list">
            {PERMISSIONS.map((p) => (
              <li key={p.title} className="perm-row">
                <span className="perm-icon"><p.icon size={18} /></span>
                <span className="perm-text">
                  <strong>{p.title}</strong>
                  <span>{p.desc}</span>
                </span>
                <span className="perm-allow">Allow</span>
              </li>
            ))}
          </ul>
          <div className="perm-actions">
            <button className="action-btn perm-continue" onClick={allow} disabled={busy}>
              {busy ? 'Requesting…' : 'Allow'} <ChevronRight size={16} />
            </button>
            <button className="action-btn-ghost perm-skip" onClick={skip}>Not now</button>
          </div>
        </div>
      </div>
    </div>
  );
}
