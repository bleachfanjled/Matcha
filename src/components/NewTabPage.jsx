import React, { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { streamReply } from '@/lib/streamReply';
import SnowCapped from '@/components/SnowCapped';
import NewTabConfigButton from '@/components/NewTabConfigButton';
import Shortcuts from '@/components/Shortcuts';
import AIOverview from '@/components/AIOverview';
import AIMode from '@/components/AIMode';
import { newtabPrefs } from '@/lib/newtabPrefs';
import { Search, Sparkles, ArrowRight, Leaf } from 'lucide-react';

// The Matcha new-tab landing + Google-style search results view.
// On search: results render immediately, the AI overview generates shortly after.
// "Ask anything" or the AI Mode tab opens a conversational AI Mode chat.
export default function NewTabPage({ tab, onQuery, onSearch, onOpenUrl, engine, engines, onEngineChange }) {
  const [bg, setBg] = useState(newtabPrefs.getBg());
  const [scrim, setScrim] = useState(newtabPrefs.getScrim());
  const [blur, setBlur] = useState(newtabPrefs.getBlur());
  const [fit, setFit] = useState(newtabPrefs.getFit());

  const [view, setView] = useState('results'); // 'results' | 'aimode'
  const [showMore, setShowMore] = useState(false);
  const [chat, setChat] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const streamCancel = useRef(null);

  const { query, data, loading, error } = tab;

  useEffect(() => newtabPrefs.subscribe(() => {
    setBg(newtabPrefs.getBg());
    setScrim(newtabPrefs.getScrim());
    setBlur(newtabPrefs.getBlur());
    setFit(newtabPrefs.getFit());
  }), []);

  // Results render immediately; the AI overview arrives separately and flips
  // aiReady when it lands.
  useEffect(() => { if (data) setShowMore(false); }, [data]);
  const aiReady = !data?.overviewLoading;

  // A new search resets to the results view; a cleared tab resets the chat.
  useEffect(() => { if (loading) setView('results'); }, [loading]);
  useEffect(() => { if (!data && !loading) { setChat([]); setStreaming(false); if (streamCancel.current) { streamCancel.current(); streamCancel.current = null; } } }, [data, loading]);

  const sendChat = async (text) => {
    const t = text.trim();
    if (!t || chatLoading || streaming) return;
    setView('aimode');
    const userMsg = { role: 'user', content: t };
    const base = [...chat, userMsg];
    setChat(base);
    setChatLoading(true);
    try {
      const res = await base44.functions.invoke('aiChat', { messages: base, query: tab.query });
      const full = res.data.reply;
      setChat([...base, { role: 'assistant', content: '' }]);
      setChatLoading(false);
      setStreaming(true);
      if (streamCancel.current) streamCancel.current();
      streamCancel.current = streamReply(full, (partial) => {
        setChat((prev) => {
          const copy = prev.slice();
          copy[copy.length - 1] = { ...copy[copy.length - 1], content: partial };
          return copy;
        });
      }, () => setStreaming(false));
    } catch {
      setChat([...base, { role: 'assistant', content: 'Sorry, I could not respond right now.' }]);
      setChatLoading(false);
    }
  };

  const isImage = bg.startsWith('http') || bg.startsWith('data:');
  const bgImage = isImage ? `url(${bg})` : bg;
  const fitStyle = fit === 'contain' ? 'contain' : fit === 'center' ? 'center' : 'cover';

  return (
    <div className="newtab-root">
      {bg && <div className="newtab-bg" style={{ backgroundImage: bgImage, backgroundSize: fitStyle, filter: blur ? `blur(${blur}px)` : undefined }} />}
      {bg && (
        <div className="newtab-scrim" style={{ background: `linear-gradient(180deg, rgba(5,5,8,${(scrim / 100) * 0.8}), rgba(5,5,8,${(scrim / 100) * 0.92}))` }} />
      )}

      <div className="newtab-scroll frost-scroll">
        <div className="newtab-content">
          {(!data && !loading && !error) ? (
            <div className="newtab-hero">
              <div className="newtab-brand">
                <Leaf size={34} />
                <span>Matcha Air</span>
              </div>
              <p className="newtab-tagline">Brewed for you — a calmer, greener way to search.</p>
              <form onSubmit={(e) => { e.preventDefault(); onSearch(query); }} className="newtab-form">
                <SnowCapped capHeight={6} roundness="full" className="rounded-full">
                  <div className="search-bar newtab-search-bar newtab-search-pill">
                    <select className="newtab-engine-select" aria-label="Search engine" value={engine} onChange={(event) => onEngineChange(event.target.value)}>
                      {engines.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                    </select>
                    <Search size={18} style={{ color: 'var(--text-muted)' }} />
                    <input
                      value={query}
                      onChange={(e) => onQuery(e.target.value)}
                      placeholder="Search the web"
                      spellCheck={false}
                    />
                    <button type="submit" className="newtab-search-go" disabled={loading || !query.trim()} aria-label="Search">
                      <ArrowRight size={18} />
                    </button>
                  </div>
                </SnowCapped>
              </form>
              <Shortcuts onSearch={onSearch} onOpenUrl={onOpenUrl} />
            </div>
          ) : (
            <div className="results-view">
              <form className="results-topbar" onSubmit={(e) => { e.preventDefault(); onSearch(query); }}>
                <div className="results-search-bar">
                  <select className="newtab-engine-select" aria-label="Search engine" value={engine} onChange={(event) => onEngineChange(event.target.value)}>
                    {engines.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                  </select>
                  <Search size={16} style={{ color: 'var(--text-muted)' }} />
                  <input
                    value={query}
                    onChange={(e) => onQuery(e.target.value)}
                    placeholder="Search the web"
                    spellCheck={false}
                  />
                  <button type="submit" className="results-search-go" disabled={loading || !query.trim()} aria-label="Search">
                    <ArrowRight size={16} />
                  </button>
                </div>
              </form>

              {loading && (
                <>
                  <div className="search-filters">
                    <span className="sf-tab sf-active">All</span>
                    <span className="sf-tab">AI Mode</span>
                  </div>
                  <div className="glass-panel ai-overview">
                    <div className="ai-overview-head"><Sparkles size={14} /> AI Overview</div>
                    <div className="ai-gen"><div className="ai-gen-shimmer" /><span>Generating AI overview…</span></div>
                  </div>
                  <div className="result-list">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className="skel-row">
                        <div className="skel-line" style={{ width: '35%' }} />
                        <div className="skel-line" style={{ width: '65%' }} />
                        <div className="skel-line" style={{ width: '90%' }} />
                        <div className="skel-line" style={{ width: '50%' }} />
                      </div>
                    ))}
                  </div>
                </>
              )}

              {error && (
                <div className="p-4 text-sm" style={{ color: 'var(--text)' }}>Search failed: {error}</div>
              )}

              {data && !loading && (
                <>
                  <div className="search-filters">
                    <button className={`sf-tab ${view === 'aimode' ? 'sf-active' : ''}`} onClick={() => setView('aimode')}>AI Mode</button>
                    <button className={`sf-tab ${view === 'results' ? 'sf-active' : ''}`} onClick={() => setView('results')}>All</button>
                  </div>

                  {view === 'results' && (
                    <>
                      <AIOverview
                        data={data}
                        aiReady={aiReady}
                        showMore={showMore}
                        onShowMore={setShowMore}
                        onAsk={sendChat}
                        onOpenUrl={onOpenUrl}
                      />
                      <div className="result-list">
                        {data.results.length === 0 && (
                          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No results found.</p>
                        )}
                        {data.results.map((r, i) => (
                          <div
                            key={i}
                            className="result-item"
                            role="button"
                            tabIndex={0}
                            onClick={() => onOpenUrl(r.url)}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenUrl(r.url); } }}
                          >
                            <div className="result-url">{r.url}</div>
                            <div className="result-title">{r.title}</div>
                            <div className="result-snippet">{r.snippet}</div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {view === 'aimode' && (
                    <AIMode
                      query={tab.query}
                      chat={chat}
                      chatLoading={chatLoading}
                      streaming={streaming}
                      onSend={sendChat}
                      onBack={() => setView('results')}
                    />
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {!data && !loading && !error && (
        <NewTabConfigButton
          bg={bg} setBg={newtabPrefs.setBg}
          scrim={scrim} setScrim={newtabPrefs.setScrim}
          blur={blur} setBlur={newtabPrefs.setBlur}
          fit={fit} setFit={newtabPrefs.setFit}
        />
      )}
    </div>
  );
}
