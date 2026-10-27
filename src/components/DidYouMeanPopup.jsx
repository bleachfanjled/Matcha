import React from 'react';
import { X, AlertTriangle, ArrowRight } from 'lucide-react';

// "Did you mean?" popup shown when a typed URL looks like a typo of a popular
// domain. Lets the user jump to the suggested site or continue to the typed one.
export default function DidYouMeanPopup({ typed, suggested, onGoSuggested, onContinue, onClose }) {
  return (
    <div className="dym-backdrop" onClick={onClose} role="dialog" aria-label="Did you mean?">
      <div className="dym-card glass-panel" onClick={(e) => e.stopPropagation()}>
        <div className="dym-head">
          <AlertTriangle size={18} style={{ color: 'var(--accent)' }} />
          <span>Did you mean <strong>{suggested}</strong>?</span>
          <button onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        <p className="dym-sub">“<code>{typed}</code>” looks like a typo of <strong>{suggested}</strong>.</p>
        <div className="dym-actions">
          <button className="action-btn dym-go" onClick={onGoSuggested}>Go to {suggested} <ArrowRight size={15} /></button>
          <button className="action-btn-ghost dym-continue" onClick={onContinue}>Continue to {typed}</button>
        </div>
      </div>
    </div>
  );
}