import React, { useState } from 'react';
import SnowCapped from '@/components/SnowCapped';
import { Sparkles, ChevronDown, ChevronUp, ArrowUp, Link2 } from 'lucide-react';

function renderDetails(details) {
  return details.split('\n').filter((l) => l.trim()).map((line, i) => {
    const t = line.trim();
    if (t.startsWith('• ')) {
      return (
        <div key={i} className="ai-bullet">
          <span className="ai-dot" />
          <span>{t.slice(2)}</span>
        </div>
      );
    }
    if (t === t.toUpperCase() && /[A-Z]/.test(t) && t.length < 60) {
      return <div key={i} className="ai-subhead">{t}</div>;
    }
    return <p key={i} className="ai-para">{t}</p>;
  });
}

// AI Overview card: shows a "generating" state, then the summary + cited links,
// a Show more expansion for the longer details, and an "Ask anything" bar that
// hands off to AI Mode.
export default function AIOverview({ data, aiReady, showMore, onShowMore, onAsk, onOpenUrl }) {
  const [ask, setAsk] = useState('');
  const [showSources, setShowSources] = useState(false);
  const submit = (e) => {
    e.preventDefault();
    if (!ask.trim()) return;
    onAsk(ask);
    setAsk('');
  };

  return (
    <div className="glass-panel ai-overview">
      <SnowCapped capHeight={6}>
        <div className="ai-overview-head"><Sparkles size={14} /> AI Overview</div>
      </SnowCapped>

      {!aiReady ? (
        <div className="ai-gen">
          <div className="ai-gen-shimmer" />
          <span>Generating AI overview…</span>
        </div>
      ) : (
        <>
          <div className="ai-overview-body">{data.summary}</div>

          {data.links?.length > 0 && (
            <div className="ai-sources-wrap">
              <button className="ai-sources-btn" onClick={() => setShowSources((s) => !s)}>
                <Link2 size={13} /> Sources ({data.links.length})
              </button>
              {showSources && (
                <>
                  <div className="ai-sources-backdrop" onClick={() => setShowSources(false)} />
                  <div className="ai-sources-pop">
                    <div className="ai-sources-pop-head">Sources</div>
                    {data.links.map((l, i) => (
                      <button key={i} className="ai-sources-item" onClick={() => { onOpenUrl(l.url); setShowSources(false); }}>
                        <span className="ai-sources-item-title">{l.title}</span>
                        <span className="ai-sources-item-url">{l.url}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {showMore && data.details && (
            <div className="ai-details">{renderDetails(data.details)}</div>
          )}

          {data.details && (
            <button className="ai-show-more" onClick={() => onShowMore(!showMore)}>
              {showMore ? <>Show less <ChevronUp size={15} /></> : <>Show more <ChevronDown size={15} /></>}
            </button>
          )}

          <form className="ai-ask" onSubmit={submit}>
            <input value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="Ask anything" spellCheck={false} />
            <button type="submit" disabled={!ask.trim()} aria-label="Ask"><ArrowUp size={16} /></button>
          </form>
        </>
      )}
    </div>
  );
}