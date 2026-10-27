import React, { useEffect, useState } from 'react';
import { newtabPrefs } from '@/lib/newtabPrefs';

// The same customizable new-tab background, reused behind every matcha://
// internal page (history, games, ai, settings, downloads, trackers) so the
// wallpaper stays consistent across all of them. Renders only the bg + scrim
// layers; the parent positions them.
export default function MatchaPageBackground() {
  const [bg, setBg] = useState(newtabPrefs.getBg());
  const [scrim, setScrim] = useState(newtabPrefs.getScrim());
  const [blur, setBlur] = useState(newtabPrefs.getBlur());
  const [fit, setFit] = useState(newtabPrefs.getFit());

  useEffect(() => newtabPrefs.subscribe(() => {
    setBg(newtabPrefs.getBg());
    setScrim(newtabPrefs.getScrim());
    setBlur(newtabPrefs.getBlur());
    setFit(newtabPrefs.getFit());
  }), []);

  const isImage = bg.startsWith('http') || bg.startsWith('data:');
  const bgImage = isImage ? `url(${bg})` : bg;
  const fitStyle = fit === 'contain' ? 'contain' : fit === 'center' ? 'center' : 'cover';

  return (
    <>
      {bg && <div className="newtab-bg" style={{ backgroundImage: bgImage, backgroundSize: fitStyle, filter: blur ? `blur(${blur}px)` : undefined }} />}
      {bg && <div className="newtab-scrim" style={{ background: `linear-gradient(180deg, rgba(5,5,8,${(scrim / 100) * 0.8}), rgba(5,5,8,${(scrim / 100) * 0.92}))` }} />}
    </>
  );
}