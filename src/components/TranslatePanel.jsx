import React, { useState, useRef, useEffect } from 'react';
import { X, Languages, ChevronDown, ArrowRight } from 'lucide-react';
import { TOP_LANGS } from '@/components/TranslateMenu';

// Overlays the content area with the AI-translated page content. Shows the
// detected source language at the top and lets the user switch the target
// language without reopening the menu.
export default function TranslatePanel({ translation, onSwitchLang, onClose }) {
  const [targetOpen, setTargetOpen] = useState(false);
  const targetRef = useRef(null);

  useEffect(() => {
    if (!targetOpen) return;
    const close = (e) => { if (targetRef.current && !targetRef.current.contains(e.target)) setTargetOpen(false); };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [targetOpen]);

  if (!translation) return null;
  const detected = translation.detectedLang || 'Detecting…';

  return (
    <div className="translate-panel" role="region" aria-label="Page translation">
      <div className="translate-panel-head">
        <span><Languages size={14} /> AI translation</span>
        <button onClick={onClose} aria-label="Close translation"><X size={16} /></button>
      </div>

      <div className="translate-lang-bar">
        <div className="translate-lang-col">
          <div className="translate-lang-label">Detected</div>
          <div className="translate-lang-value">{detected}</div>
        </div>
        <ArrowRight size={15} className="translate-lang-arrow" />
        <div className="translate-lang-col" ref={targetRef}>
          <div className="translate-lang-label">Translate to</div>
          <button className="translate-lang-select" onClick={() => setTargetOpen((v) => !v)} disabled={translation.loading}>
            <span>{translation.langLabel}</span>
            <ChevronDown size={13} />
          </button>
          {targetOpen && (
            <div className="translate-target-menu">
              {TOP_LANGS.map((l) => (
                <button
                  key={l.code}
                  className={`translate-item ${l.label === translation.langLabel ? 'translate-item-active' : ''}`}
                  onClick={() => { setTargetOpen(false); onSwitchLang?.(l.code, l.label); }}
                >
                  <span>{l.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="translate-panel-body frost-scroll">
        {translation.loading ? (
          <div className="ai-gen"><div className="ai-gen-shimmer" /><span>Translating page…</span></div>
        ) : translation.error ? (
          <p className="translate-error">{translation.error}</p>
        ) : (
          <div className="translate-content">{translation.content}</div>
        )}
      </div>
    </div>
  );
}