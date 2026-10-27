import React, { useState } from 'react';
import { ArrowLeft, Trash2, RotateCcw, MapPin, Camera, Mic, Activity, Bell, Code, Image as ImageIcon, ExternalLink, Ban, RefreshCw, Volume2, Download, Clipboard, AlertTriangle, LogIn, Type, Monitor, Network, Cookie } from 'lucide-react';
import { PERM_DEFS, browserPrefs } from '@/lib/browserPrefs';
import PermSelect from '@/components/PermSelect';

// Chrome-style full site settings page: usage + delete data, permissions +
// reset, and a comprehensive permission list with tri-state dropdowns.
const ICONS = {
  location: MapPin, camera: Camera, mic: Mic, motion: Activity, notifications: Bell,
  js: Code, images: ImageIcon, popups: ExternalLink, cookies: Cookie, ads: Ban, bgSync: RefreshCw,
  sound: Volume2, autoDownloads: Download, clipboard: Clipboard, insecure: AlertTriangle,
  thirdPartySignIn: LogIn, fonts: Type, pip: Monitor, localNet: Network,
};

export default function SiteSettingsPage({ host, onBack }) {
  const [perms, setPerms] = useState(() => browserPrefs.getSitePerms(host));
  const [data, setData] = useState(() => browserPrefs.getSiteData(host));

  const changePerm = (key, val) => {
    browserPrefs.setSitePerm(host, key, val);
    setPerms(browserPrefs.getSitePerms(host));
  };
  const resetPerms = () => {
    browserPrefs.resetSitePerms(host);
    setPerms(browserPrefs.getSitePerms(host));
  };
  const deleteData = () => {
    browserPrefs.deleteSiteData(host);
    setData({ usage: 0, cookies: 0 });
  };
  const hasData = data.usage > 0 || data.cookies > 0;

  return (
    <div className="site-settings-page">
      <div className="site-settings-head">
        <button className="chrome-btn" onClick={onBack} aria-label="Back"><ArrowLeft size={17} /></button>
        <strong>{host}</strong>
      </div>

      <div className="local-section glass-panel">
        <div className="local-section-head">Usage</div>
        <div className="settings-row" style={{ borderBottom: 'none', padding: '8px 0 0' }}>
          <div>
            <div className="settings-label">{data.usage > 0 ? `${data.usage.toLocaleString()} KB` : 'No data stored'}</div>
            <div className="settings-sub">{data.cookies > 0 ? `${data.cookies} cookies` : 'No cookies stored'}</div>
          </div>
          <button className="action-btn-ghost action-btn" onClick={deleteData} disabled={!hasData} style={{ opacity: hasData ? 1 : 0.4 }}>
            <Trash2 size={14} style={{ marginRight: 6, display: 'inline', verticalAlign: '-2px' }} /> Delete data
          </button>
        </div>
      </div>

      <div className="local-section glass-panel">
        <div className="settings-row" style={{ borderBottom: 'none', padding: '0 0 12px' }}>
          <div className="local-section-head" style={{ margin: 0 }}>Permissions</div>
          <button className="action-btn-ghost action-btn" onClick={resetPerms}>
            <RotateCcw size={14} style={{ marginRight: 6, display: 'inline', verticalAlign: '-2px' }} /> Reset permissions
          </button>
        </div>
        <div className="site-perm-list">
          {Object.keys(PERM_DEFS).map((key) => {
            const Icon = ICONS[key] || Code;
            const def = PERM_DEFS[key];
            return (
              <div className="site-perm-row" key={key}>
                <Icon size={16} />
                <span>{def.label}</span>
                <PermSelect value={perms[key]} defaultVal={def.default} onChange={(v) => changePerm(key, v)} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}