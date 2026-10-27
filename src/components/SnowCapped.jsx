import React, { useMemo, useId } from 'react';
import { useTheme } from '@/lib/themeContext';

// Natural snow-drift cap that sits on a panel's top edge and sides. The drifts
// scale with snow intensity from the theme — more snow coming down means
// thicker top caps and wider side accumulation. Side snow is a thin strip
// that tapers to nothing partway down, so it decorates edges without
// covering content. Each cap is randomized per app open. A clip wrapper
// inherits the panel's border-radius so the snow follows the UI's corners.
function buildSnowPaths() {
  const steps = 16 + Math.floor(Math.random() * 6); // 16-21 drifts
  const topPts = [];
  const botPts = [];

  for (let i = 0; i <= steps; i++) {
    const x = (100 / steps) * i;
    // Taper toward the edges so snow is thinner at corners (natural slide-off).
    const edgeDist = Math.min(i, steps - i) / steps; // 0 at edges, ~0.5 center
    const edgeFactor = 0.3 + edgeDist * 1.4;

    // Top surface: peaks and valleys with natural variation.
    const topY = (1.5 + Math.random() * 5.5) * edgeFactor;
    topPts.push([x, topY]);

    // Bottom edge: irregular thickness — mostly normal, some thin gaps,
    // occasional drips where snow slides off.
    const r = Math.random();
    let thick;
    if (r < 0.07) thick = 4 + Math.random() * 2;       // thin gap
    else if (r < 0.12) thick = 14 + Math.random() * 5; // drip
    else thick = 8 + Math.random() * 4;                 // normal
    const botY = Math.max(topY + 2, thick * edgeFactor);
    botPts.push([x, botY]);
  }

  // Top edge: left → right (smooth quadratic curves)
  let top = `M${topPts[0][0].toFixed(2)},${topPts[0][1].toFixed(2)}`;
  for (let i = 1; i < topPts.length; i++) {
    const [x0, y0] = topPts[i - 1];
    const [x1, y1] = topPts[i];
    const mx = ((x0 + x1) / 2).toFixed(2);
    const my = ((y0 + y1) / 2).toFixed(2);
    top += ` Q${x0.toFixed(2)},${y0.toFixed(2)} ${mx},${my}`;
  }
  top += ` L${topPts[topPts.length - 1][0].toFixed(2)},${topPts[topPts.length - 1][1].toFixed(2)}`;

  // Bottom edge: right → left (closes the shape)
  let bottom = ` L${botPts[botPts.length - 1][0].toFixed(2)},${botPts[botPts.length - 1][1].toFixed(2)}`;
  for (let i = botPts.length - 2; i >= 0; i--) {
    const [x0, y0] = botPts[i + 1];
    const [x1, y1] = botPts[i];
    const mx = ((x0 + x1) / 2).toFixed(2);
    const my = ((y0 + y1) / 2).toFixed(2);
    bottom += ` Q${x0.toFixed(2)},${y0.toFixed(2)} ${mx},${my}`;
  }
  bottom += ` L${botPts[0][0].toFixed(2)},${botPts[0][1].toFixed(2)}`;

  return { fill: top + bottom + ' Z', highlight: top };
}

// Vertical snow drift for a panel side. The snow is widest at the top (where
// it meets the cap) and tapers to nothing partway down, so it decorates the
// edge without covering content. viewBox is 0 0 20 100 (x=0 is the outer
// edge, x=20 is toward the content).
function buildSideSnowPaths() {
  const steps = 12 + Math.floor(Math.random() * 4);
  const innerPts = []; // [y, x] — the inner (content-facing) edge

  for (let i = 0; i <= steps; i++) {
    const y = (100 / steps) * i;
    // Taper: full thickness at top, gone by ~65% down.
    const taper = Math.max(0, 1 - (i / steps) * 1.6);
    const x = (5 + Math.random() * 10) * taper;
    innerPts.push([y, Math.max(0, x)]);
  }

  // Path: top-left corner → across top to first inner point → curve down the
  // inner edge → to bottom-left → close.
  let path = `M0,0`;
  path += ` L${innerPts[0][1].toFixed(2)},0`;
  for (let i = 1; i < innerPts.length; i++) {
    const [y0, x0] = innerPts[i - 1];
    const [y1, x1] = innerPts[i];
    const mx = ((x0 + x1) / 2).toFixed(2);
    const my = ((y0 + y1) / 2).toFixed(2);
    path += ` Q${x0.toFixed(2)},${y0.toFixed(2)} ${mx},${my}`;
  }
  const last = innerPts[innerPts.length - 1];
  path += ` L${last[1].toFixed(2)},${last[0].toFixed(2)}`;
  path += ` L0,${last[0].toFixed(2)}`;
  path += ` Z`;

  return path;
}

export default function SnowCapped({ children, className = '', capHeight: capHeightProp = 6, roundness = 1.4, style }) {
  const { snowIntensity = 1, snowCaps = true } = useTheme();
  const intensity = snowCaps ? Math.max(0, snowIntensity) : 0;

  // Scale cap height with intensity: at 0 → base, at 1 → 2× base, at 3 → 4× base.
  const capHeight = Math.round(capHeightProp * (1 + intensity));
  // Side snow width: thin strip that grows with intensity (0 → 3px, 1 → 8px, 3 → 18px).
  const sideWidth = Math.round(3 + intensity * 5);
  const showSides = intensity > 0;

  // Shape is generated once per mount — only the container size changes with
  // intensity, so the snow grows smoothly without reshaping.
  const { fill, highlight } = useMemo(buildSnowPaths, []);
  const sidePath = useMemo(buildSideSnowPaths, []);
  const gid = 'snow' + useId().replace(/[:]/g, '');

  // Border-radius adapts to the theme's --app-roundness variable so snow caps
  // match the UI roundness setting. roundness="full" → pill/circle shape.
  const radius = roundness === 'full' ? '999px' : `calc(var(--app-roundness) * ${roundness})`;
  const mergedStyle = { ...style, borderRadius: radius };

  return (
    <div className={`snow-capped ${className}`} style={mergedStyle}>
      {showSides && (
        <>
          <div className="snow-cap-side snow-cap-left" style={{ width: sideWidth }}>
            <svg className="snow-cap" viewBox="0 0 20 100" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id={gid + 'L'} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.88" />
                  <stop offset="40%" stopColor="#f4f8ff" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#dce4f5" stopOpacity="0.12" />
                </linearGradient>
              </defs>
              <path d={sidePath} fill={`url(#${gid}L)`} />
            </svg>
          </div>
          <div className="snow-cap-side snow-cap-right" style={{ width: sideWidth }}>
            <svg className="snow-cap" viewBox="0 0 20 100" preserveAspectRatio="none" aria-hidden="true" style={{ transform: 'scaleX(-1)' }}>
              <defs>
                <linearGradient id={gid + 'R'} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.88" />
                  <stop offset="40%" stopColor="#f4f8ff" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#dce4f5" stopOpacity="0.12" />
                </linearGradient>
              </defs>
              <path d={sidePath} fill={`url(#${gid}R)`} />
            </svg>
          </div>
        </>
      )}
      <div className="snow-cap-clip" style={{ height: capHeight }}>
        <svg
          className="snow-cap"
          viewBox="0 0 100 20"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="40%" stopColor="#f4f8ff" stopOpacity="0.82" />
              <stop offset="75%" stopColor="#e8eef8" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#dce4f5" stopOpacity="0.12" />
            </linearGradient>
          </defs>
          <path d={fill} fill={`url(#${gid})`} />
          <path d={highlight} fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="0.4" />
        </svg>
      </div>
      {children}
    </div>
  );
}