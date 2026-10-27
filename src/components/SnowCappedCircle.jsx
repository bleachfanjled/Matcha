import React, { useMemo, useId } from 'react';
import { useTheme } from '@/lib/themeContext';

// Snow cap that follows the top arc of a circle instead of a straight edge.
// Used for circular elements like the branding logo.
function buildArcSnow() {
  const steps = 20;
  const cx = 50, cy = 50, r = 47;
  const outer = [], inner = [];
  const thickness = 7 + Math.random() * 4;

  for (let i = 0; i <= steps; i++) {
    const angle = Math.PI * (1 - i / steps); // PI → 0 (left over top to right)
    const bump = (Math.random() - 0.5) * 4;
    outer.push([cx + (r + bump) * Math.cos(angle), cy + (r + bump) * Math.sin(angle)]);
    const innerBump = bump * 0.3;
    inner.push([cx + (r - thickness + innerBump) * Math.cos(angle), cy + (r - thickness + innerBump) * Math.sin(angle)]);
  }

  let path = `M${outer[0][0].toFixed(2)},${outer[0][1].toFixed(2)}`;
  for (let i = 1; i < outer.length; i++) {
    const [x0, y0] = outer[i - 1];
    const [x1, y1] = outer[i];
    path += ` Q${x0.toFixed(2)},${y0.toFixed(2)} ${((x0 + x1) / 2).toFixed(2)},${((y0 + y1) / 2).toFixed(2)}`;
  }
  path += ` L${outer[outer.length - 1][0].toFixed(2)},${outer[outer.length - 1][1].toFixed(2)}`;

  for (let i = inner.length - 1; i >= 0; i--) {
    const next = Math.min(i + 1, inner.length - 1);
    const [x0, y0] = inner[next];
    const [x1, y1] = inner[i];
    path += ` Q${x0.toFixed(2)},${y0.toFixed(2)} ${((x0 + x1) / 2).toFixed(2)},${((y0 + y1) / 2).toFixed(2)}`;
  }
  path += ` L${inner[0][0].toFixed(2)},${inner[0][1].toFixed(2)}`;
  path += ' Z';

  return path;
}

export default function SnowCappedCircle({ children, className = '', style }) {
  const { snowIntensity = 1, snowCaps = true } = useTheme();
  const show = snowCaps && snowIntensity > 0;
  const fill = useMemo(buildArcSnow, []);
  const gid = 'snowc' + useId().replace(/[:]/g, '');

  return (
    <div className={`snow-capped ${className}`} style={{ ...style, borderRadius: '50%' }}>
      {show && (
        <div className="snow-cap-clip" style={{ height: '100%', borderRadius: '50%' }}>
          <svg className="snow-cap" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
                <stop offset="50%" stopColor="#f4f8ff" stopOpacity="0.75" />
                <stop offset="100%" stopColor="#dce4f5" stopOpacity="0.15" />
              </linearGradient>
            </defs>
            <path d={fill} fill={`url(#${gid})`} />
          </svg>
        </div>
      )}
      {children}
    </div>
  );
}