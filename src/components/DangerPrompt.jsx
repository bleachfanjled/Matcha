import React, { useState } from 'react';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

// Full-screen interstitial shown when a site is flagged as dangerous (heavy
// tracker activity / fingerprinting). The user must type CONTINUE to proceed.
export default function DangerPrompt({ host, trackers, onContinue, onBack }) {
  const [text, setText] = useState('');
  const canContinue = text.trim().toUpperCase() === 'CONTINUE';

  return (
    <div className="danger-prompt">
      <div className="danger-prompt-card glass-panel">
        <div className="danger-prompt-icon"><ShieldAlert size={44} /></div>
        <h2>Connection blocked</h2>
        <p className="danger-prompt-sub">
          <strong>{host}</strong> was flagged for tracker activity that could compromise your privacy.
          {trackers.length > 0 && ` ${trackers.length} tracker${trackers.length > 1 ? 's' : ''} detected.`}
        </p>
        {trackers.length > 0 && (
          <div className="danger-prompt-trackers">
            {trackers.slice(0, 6).map((t, i) => (
              <div className="danger-prompt-tracker" key={i}>
                <span>{t.name}</span>
                <span className="danger-prompt-cat">{t.category}</span>
              </div>
            ))}
          </div>
        )}
        <p className="danger-prompt-warn">
          If you understand the risks, type <strong>CONTINUE</strong> to proceed to this site.
        </p>
        <input
          className="frost-input danger-prompt-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type CONTINUE to continue"
          autoFocus
          onKeyDown={(e) => { if (e.key === 'Enter' && canContinue) onContinue(); }}
        />
        <div className="danger-prompt-actions">
          <button className="action-btn-ghost action-btn danger-prompt-back" onClick={onBack}>
            <ArrowLeft size={15} style={{ marginRight: 6, display: 'inline', verticalAlign: '-2px' }} /> Go back
          </button>
          <button className="action-btn danger-prompt-go" disabled={!canContinue} onClick={onContinue}>
            Continue anyway
          </button>
        </div>
      </div>
    </div>
  );
}