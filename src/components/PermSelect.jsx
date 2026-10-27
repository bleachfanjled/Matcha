import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

// Tri-state permission dropdown: Allow / Ask / Block.
const OPTS = ['allow', 'ask', 'block'];

export default function PermSelect({ value, defaultVal, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);

  const label = (v) => v.charAt(0).toUpperCase() + v.slice(1) + (v === defaultVal ? ' (default)' : '');

  return (
    <div className="perm-select" ref={ref}>
      <button type="button" className="perm-select-btn" onClick={() => setOpen((v) => !v)}>
        <span>{label(value)}</span>
        <ChevronDown size={13} />
      </button>
      {open && (
        <div className="perm-select-menu">
          {OPTS.map((o) => (
            <button key={o} type="button" className={`perm-select-opt ${o === value ? 'perm-select-opt-active' : ''}`} onClick={() => { onChange(o); setOpen(false); }}>
              <span>{label(o)}</span>
              {o === value && <Check size={13} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}