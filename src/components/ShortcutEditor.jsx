import React, { useState } from 'react';
import SnowCapped from '@/components/SnowCapped';
import { X } from 'lucide-react';
import { looksLikeUrl, normalizeUrl } from '@/lib/urlBar';

// Modal for adding or editing a quick-launch shortcut. A shortcut can either
// run a web search (colored letter tile) or open a stored URL (favicon tile).
export default function ShortcutEditor({ mode, initial, onSave, onDelete, onClose }) {
  const [name, setName] = useState(initial?.name || '');
  const [type, setType] = useState(initial?.type || 'search');
  const [url, setUrl] = useState(initial?.url || '');
  const [color, setColor] = useState(initial?.color || '#8a93ff');

  let safeUrl = '';
  try {
    if (looksLikeUrl(url)) {
      const parsed = new URL(normalizeUrl(url));
      if (['http:', 'https:'].includes(parsed.protocol)) safeUrl = parsed.href;
    }
  } catch { /* incomplete or malformed address */ }
  const canSave = !!name.trim() && (type === 'search' || !!safeUrl);
  const save = () => {
    if (!canSave) return;
    const data = { name: name.trim(), type, color: type === 'search' ? color : '#8a93ff' };
    if (type === 'url') data.url = safeUrl;
    onSave(data);
  };

  return (
    <div className="shortcut-editor-backdrop" onClick={onClose}>
      <div className="glass-panel shortcut-editor-card" onClick={(e) => e.stopPropagation()}>
        <SnowCapped capHeight={6} className="rounded-2xl">
          <div className="newtab-sidebar-head">
            <span className="newtab-sidebar-title">{mode === 'edit' ? 'Edit Shortcut' : 'New Shortcut'}</span>
            <button className="chrome-menu-close" onClick={onClose} aria-label="Close"><X size={16} /></button>
          </div>
        </SnowCapped>

        <div className="newtab-sidebar-section">
          <div className="newtab-sidebar-label">Name</div>
          <input className="frost-input w-full px-3 py-2 text-sm" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. GitHub" />
        </div>

        <div className="newtab-sidebar-section">
          <div className="newtab-sidebar-label">Action</div>
          <div className="settings-seg">
            <button className={`settings-seg-btn ${type === 'search' ? 'settings-seg-active' : ''}`} onClick={() => setType('search')}>Search</button>
            <button className={`settings-seg-btn ${type === 'url' ? 'settings-seg-active' : ''}`} onClick={() => setType('url')}>Open URL</button>
          </div>
        </div>

        {type === 'url' ? (
          <div className="newtab-sidebar-section">
            <div className="newtab-sidebar-label">URL</div>
            <input className="frost-input w-full px-3 py-2 text-sm" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://github.com" />
            {!!url.trim() && !safeUrl && <div className="shortcut-editor-error" role="status">Enter a valid HTTP or HTTPS website address.</div>}
          </div>
        ) : (
          <div className="newtab-sidebar-section">
            <div className="newtab-sidebar-label">Color</div>
            <input type="color" className="color-swatch" value={color} onChange={(e) => setColor(e.target.value)} />
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <button className="action-btn px-4 py-2 rounded-lg text-sm flex-1" onClick={save} disabled={!canSave}>Save</button>
          {mode === 'edit' && onDelete && (
            <button className="action-btn-ghost px-4 py-2 rounded-lg text-sm" onClick={onDelete} style={{ color: 'hsl(var(--destructive))' }}>Delete</button>
          )}
        </div>
      </div>
    </div>
  );
}
