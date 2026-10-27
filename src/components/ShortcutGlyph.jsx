import React, { useState } from 'react';
import { faviconFor } from '@/lib/shortcuts';

// Renders a shortcut's icon: the site favicon for URL shortcuts, or a colored
// letter glyph for search shortcuts. Falls back to the letter if the favicon
// fails to load.
export default function ShortcutGlyph({ s, size }) {
  const [failed, setFailed] = useState(false);
  const dim = size || 40;
  const isUrl = s.type === 'url' && s.url;
  const fav = isUrl ? faviconFor(s.url) : '';

  if (isUrl && fav && !failed) {
    return (
      <span className="shortcut-glyph" style={{ background: 'var(--glass-bg)', width: dim, height: dim }}>
        <img
          src={fav}
          alt=""
          referrerPolicy="no-referrer"
          style={{ width: '62%', height: '62%', borderRadius: 6 }}
          onError={() => setFailed(true)}
        />
      </span>
    );
  }
  return (
    <span className="shortcut-glyph" style={{ background: s.color, width: dim, height: dim }}>
      {s.name.charAt(0).toUpperCase()}
    </span>
  );
}