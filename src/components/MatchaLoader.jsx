import React from 'react';
import { Leaf } from 'lucide-react';

// Branded loading screen shown inside the content area only (not the whole
// window) while a page is loading. A theme-color light sweeps right-to-left
// across the panel.
export default function MatchaLoader() {
  return (
    <div className="matcha-loader" aria-live="polite" role="status">
      <div className="matcha-loader-brand">
        <Leaf size={38} />
        <span>Matcha Air</span>
      </div>
      <div className="matcha-loader-sub">Loading</div>
    </div>
  );
}
