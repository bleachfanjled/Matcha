import React from 'react';
import { X, Lock, Cookie, Settings, ChevronRight, Info, Ban, Code, Mic, Camera } from 'lucide-react';
import PermSelect from '@/components/PermSelect';
import { PERM_DEFS } from '@/lib/browserPrefs';

// Chrome-style site info popover for the address bar. Shows connection
// status, cookies/site data, site settings, compact permission dropdowns,
// and an AI "About this page" action that opens a separate popup.
const COMPACT_PERMS = ['popups', 'js', 'mic', 'camera'];

export default function PrivacyPopover({ style, host, perms, onTogglePerm, onSiteSettings, onCookies, onAbout, onClose }) {
  return (
    <>
      <div className="ctx-backdrop" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <div className="privacy-pop glass-panel" style={style}>
        <div className="privacy-head">
          <strong>{host}</strong>
          <button onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>

        <div className="privacy-section">
          <div className="privacy-row"><Lock size={15} /><span>Connection is secure</span><ChevronRight size={15} className="privacy-chev" /></div>
          <button className="privacy-row" onClick={onCookies}><Cookie size={15} /><span>Cookies and site data</span><ChevronRight size={15} className="privacy-chev" /></button>
          <button className="privacy-row" onClick={onSiteSettings}><Settings size={15} /><span>Site settings</span><ChevronRight size={15} className="privacy-chev" /></button>
        </div>

        <div className="privacy-sep" />

        <div className="privacy-section">
          {COMPACT_PERMS.map((key) => {
            const def = PERM_DEFS[key];
            const Icon = key === 'popups' ? Ban : key === 'js' ? Code : key === 'mic' ? Mic : Camera;
            return (
              <div className="privacy-row" key={key}>
                <Icon size={15} />
                <span>{def.label}</span>
                <PermSelect value={perms[key]} defaultVal={def.default} onChange={(v) => onTogglePerm(key, v)} />
              </div>
            );
          })}
        </div>

        <div className="privacy-sep" />

        <button className="privacy-row" onClick={onAbout}><Info size={15} /><span>About this page</span></button>
      </div>
    </>
  );
}