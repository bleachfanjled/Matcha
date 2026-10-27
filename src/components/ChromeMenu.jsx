import React, { useEffect, useRef } from 'react';
import SnowCapped from '@/components/SnowCapped';
import { Settings, History, Bookmark, Download, Cast, Info, X } from 'lucide-react';

// Chrome-style 3-dot menu: quick links to browser pages and actions.
export default function ChromeMenu({ onSettings, onHistory, onDownloads, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    window.addEventListener('mousedown', h);
    return () => window.removeEventListener('mousedown', h);
  }, [onClose]);

  const items = [
    { icon: History, label: 'History', action: onHistory },
    { icon: Bookmark, label: 'Bookmarks', action: onClose },
    { icon: Download, label: 'Downloads', action: onDownloads },
    { icon: Cast, label: 'Cast…', action: onClose },
    { icon: Settings, label: 'Settings', action: onSettings },
    { icon: Info, label: 'About Matcha Air', action: onClose },
  ];

  return (
    <>
      <div className="chrome-menu-backdrop" onClick={onClose} />
      <SnowCapped capHeight={5} className="rounded-2xl">
        <div ref={ref} className="chrome-menu glass-panel">
          <div className="chrome-menu-head">
            <span>Matcha Air</span>
            <button className="chrome-menu-close" onClick={onClose} aria-label="Close"><X size={14} /></button>
          </div>
          {items.map((it) => {
            const Icon = it.icon;
            return (
              <button key={it.label} className="chrome-menu-item" onClick={it.action}>
                <Icon size={15} /> <span>{it.label}</span>
              </button>
            );
          })}
        </div>
      </SnowCapped>
    </>
  );
}
