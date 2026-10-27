import React from 'react';
import { X, Info, Sparkles } from 'lucide-react';

// AI-generated "About this page" popup. Fetches a summary of the current page
// via the aboutPage backend function (consumes the daily token budget).
export default function AboutPageModal({ host, about, loading, error, onClose }) {
  return (
    <>
      <div className="ctx-backdrop" onClick={onClose} />
      <div className="about-modal glass-panel">
        <div className="about-modal-head">
          <span><Info size={16} /> About {host}</span>
          <button onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        <div className="about-modal-body">
          {loading && (
            <div className="ai-gen"><div className="ai-gen-shimmer" /><span>Summarizing this page…</span></div>
          )}
          {error && !loading && <p className="privacy-about privacy-about-err">{error}</p>}
          {about && !loading && (
            <div className="about-modal-content">
              <div className="about-modal-badge"><Sparkles size={12} /> AI-generated</div>
              <p>{about}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}