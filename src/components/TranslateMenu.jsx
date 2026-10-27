import React from 'react';
import { Languages } from 'lucide-react';

// Top 10 most-spoken languages (by total speakers). Shown when the user clicks
// the translate button in the control center or the right-click menu.

export const TOP_LANGS = [
  { code: 'en', label: 'English' },
  { code: 'zh', label: 'Mandarin Chinese' },
  { code: 'hi', label: 'Hindi' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'ar', label: 'Arabic' },
  { code: 'bn', label: 'Bengali' },
  { code: 'ru', label: 'Russian' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ur', label: 'Urdu' },
];

export default function TranslateMenu({ onPick, onClose, style }) {
  return (
    <>
      <div className="ctx-backdrop" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <div className="ctx-menu glass-panel" style={style}>
        <div className="ctx-head"><Languages size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} /> Translate page to</div>
        <div className="translate-pop-list">
          {TOP_LANGS.map((l) => (
            <button key={l.code} className="translate-item" onClick={() => onPick(l.code, l.label)}>
              <span>{l.label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}