import React from 'react';
import SnowCappedCircle from '@/components/SnowCappedCircle';
import { Home, Sparkles, Gamepad2, History, Settings, Download, Radar, KeyRound, Blocks } from 'lucide-react';

const LOGO_URL = 'https://media.base44.com/images/public/6ac98e2d78f3aeeb4ce7213b/2b2bab432_GlossyGreenLeafYin-YangEmblem.png';

// Expanded left sidebar: profile header and labeled nav.
// Matches the Matcha mockup layout while every link maps to a real feature.
export default function SideNav({ activePage, onHome, onNav, compact }) {
  const items = [
    { id: 'home', icon: Home, label: 'Home', action: onHome, active: !activePage },
    { id: 'ai', icon: Sparkles, label: 'AI', action: () => onNav('ai'), active: activePage === 'ai' },
    { id: 'games', icon: Gamepad2, label: 'Gaming', action: () => onNav('games'), active: activePage === 'games' },
    { id: 'history', icon: History, label: 'History', action: () => onNav('history'), active: activePage === 'history' },
    { id: 'downloads', icon: Download, label: 'Downloads', action: () => onNav('downloads'), active: activePage === 'downloads' },
    { id: 'trackers', icon: Radar, label: 'Trackers', action: () => onNav('trackers'), active: activePage === 'trackers' },
    { id: 'passwords', icon: KeyRound, label: 'Passwords', action: () => onNav('passwords'), active: activePage === 'passwords' },
    { id: 'addons', icon: Blocks, label: 'Addons', action: () => onNav('addons'), active: activePage === 'addons' },
    { id: 'settings', icon: Settings, label: 'Settings', action: () => onNav('settings'), active: activePage === 'settings' },
  ];

  return (
    <aside className={`matcha-sidebar glass-panel ${compact ? 'matcha-sidebar-compact' : ''}`}>
      <div className="matcha-sidebar-profile">
        <SnowCappedCircle className="matcha-sidebar-logo-wrap" style={{ width: 30, height: 30, flex: '0 0 30px' }}>
          <img src={LOGO_URL} alt="Matcha Air" className="matcha-sidebar-logo" style={{ position: 'relative', zIndex: 1 }} />
        </SnowCappedCircle>
        <span className="matcha-sidebar-name">Matcha Air</span>
      </div>

      <nav className="matcha-nav-list">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <button key={it.id} className={`matcha-nav-item ${it.active ? 'matcha-nav-item-active' : ''}`} onClick={it.action}>
              <Icon size={17} />
              <span>{it.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
