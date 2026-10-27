import React, { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import html2canvas from 'html2canvas';
import { Aperture, Crosshair, X } from 'lucide-react';

// Matcha Lens, app-scoped: the user drags a rectangle over the app window
// only (never the OS screen). The region is rendered with html2canvas at full
// device resolution, cropped precisely to the selection, uploaded privately,
// and sent to the vision solver. No screen-capture permission is needed.
export default function ScreenCapture({ onClose, onResult, onAnalyzing, nativePage = false }) {
  const [stage, setStage] = useState('selecting'); // selecting | capturing
  const [drag, setDrag] = useState(null);
  const rootRef = useRef(null);
  const overlayRef = useRef(null);
  const startRef = useRef(null);
  const dragRef = useRef(null);
  const lensStyle = { '--lens-accent': 'var(--accent)', '--lens-accent-alt': 'var(--matcha-glow, var(--accent))' };

  const onDown = (e) => {
    const r = overlayRef.current.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    startRef.current = { x, y };
    const initial = { x, y, w: 0, h: 0 };
    dragRef.current = initial;
    setDrag(initial);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e) => {
    if (!startRef.current) return;
    const r = overlayRef.current.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const s = startRef.current;
    const next = { x: Math.min(s.x, x), y: Math.min(s.y, y), w: Math.abs(x - s.x), h: Math.abs(y - s.y) };
    dragRef.current = next;
    setDrag(next);
  };
  const onUp = async (e) => {
    if (!startRef.current || !overlayRef.current) return;
    const bounds = overlayRef.current.getBoundingClientRect();
    const point = { x: e.clientX - bounds.left, y: e.clientY - bounds.top };
    const start = startRef.current;
    const rect = {
      x: Math.min(start.x, point.x), y: Math.min(start.y, point.y),
      w: Math.abs(point.x - start.x), h: Math.abs(point.y - start.y),
    };
    dragRef.current = rect;
    startRef.current = null;
    if (rect.w < 8 || rect.h < 8) { setDrag(null); return; }
    setStage('capturing');
    // Hide the overlay so it is not included in the capture.
    if (rootRef.current) rootRef.current.style.display = 'none';
    let imageUrl = '';
    try {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const dpr = window.devicePixelRatio || 1;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const pageX = window.scrollX || window.pageXOffset || 0;
      const pageY = window.scrollY || window.pageYOffset || 0;
      const shot = await html2canvas(document.documentElement, {
        scale: dpr, useCORS: true, logging: false, backgroundColor: null,
        x: pageX, y: pageY, width: viewportWidth, height: viewportHeight,
        windowWidth: viewportWidth, windowHeight: viewportHeight,
        scrollX: pageX, scrollY: pageY,
        onclone: (doc) => {
          for (const sheet of Array.from(doc.styleSheets)) {
            try {
              const rules = sheet.cssRules;
              for (let i = rules.length - 1; i >= 0; i--) {
                const t = rules[i].cssText || '';
                if (t.includes('color-mix') || t.includes('color(')) sheet.deleteRule(i);
              }
            } catch { /* cross-origin sheet */ }
          }
        },
      });
      // Derive scale from the rendered canvas itself so browser zoom, Retina
      // scaling, and html2canvas rounding cannot shift the selected crop.
      const scaleX = shot.width / viewportWidth;
      const scaleY = shot.height / viewportHeight;
      const sx = Math.max(0, Math.min(shot.width - 1, Math.round(rect.x * scaleX)));
      const sy = Math.max(0, Math.min(shot.height - 1, Math.round(rect.y * scaleY)));
      const sw = Math.max(1, Math.min(shot.width - sx, Math.round(rect.w * scaleX)));
      const sh = Math.max(1, Math.min(shot.height - sy, Math.round(rect.h * scaleY)));
      const out = document.createElement('canvas');
      out.width = sw; out.height = sh;
      const context = out.getContext('2d');
      if (!context) throw new Error('Could not prepare the selected image.');
      context.drawImage(shot, sx, sy, sw, sh, 0, 0, sw, sh);
      const blob = await new Promise((resolve, reject) => out.toBlob((value) => value ? resolve(value) : reject(new Error('Could not encode the selected image.')), 'image/png'));
      const file = new File([blob], 'capture.png', { type: 'image/png' });
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
      const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri });
      imageUrl = signed_url;
      onAnalyzing?.({ image_url: signed_url, size: `${sw} × ${sh}` });
      const r = await base44.functions.invoke('visionSolve', { image_url: signed_url });
      if (r.data?.error) throw new Error(r.data.error);
      onResult({ image_url: signed_url, reply: r.data.reply, size: `${sw} × ${sh}`, analyzing: false });
    } catch (e) {
      onResult({ image_url: imageUrl, error: e?.message || 'Failed to solve image', analyzing: false });
    }
  };

  return (
    <div ref={rootRef} className="screen-capture" style={lensStyle}>
      {stage === 'capturing' ? (
        <div className="screen-capture-hint"><Aperture size={16} /> Preparing your selection…</div>
      ) : (
        <>
          <div className="screen-capture-hint"><Crosshair size={16} /><span><strong>Matcha Lens</strong> · Drag to select an area</span>{nativePage && <small>Native webpage pixels may not be capturable in this build.</small>}</div>
          <div ref={overlayRef} className="screen-capture-overlay" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => { startRef.current = null; dragRef.current = null; setDrag(null); }} />
          {drag && drag.w > 0 && <div className="screen-capture-rect" style={{ left: drag.x, top: drag.y, width: drag.w, height: drag.h }} />}
          <button className="screen-capture-close" onClick={onClose} aria-label="Cancel capture"><X size={18} /></button>
        </>
      )}
    </div>
  );
}
