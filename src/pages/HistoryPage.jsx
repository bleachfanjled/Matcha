import React, { useEffect, useState } from 'react';
import SnowCapped from '@/components/SnowCapped';
import { getSearchHistory, clearSearchHistory } from '@/lib/searchHistory';
import { Trash2, History as HistoryIcon, Search, Globe } from 'lucide-react';

// matcha://history — local browsing history, rendered as a browser tab.
export default function HistoryPage({ onRun, onOpenUrl }) {
  const [items, setItems] = useState(getSearchHistory());
  useEffect(() => {
    const h = () => setItems(getSearchHistory());
    window.addEventListener('matcha-history-updated', h);
    return () => window.removeEventListener('matcha-history-updated', h);
  }, []);

  const list = [...items].reverse();
  const searches = items.filter((item) => item.type !== 'url').length;
  const visits = items.length - searches;
  return (
    <div className="local-page">
      <div className="local-page-head">
        <div className="local-page-url"><HistoryIcon size={14} /> matcha://history</div>
        <SnowCapped capHeight={5} className="rounded-lg">
          <button onClick={() => clearSearchHistory()} disabled={!items.length} className="tool-btn px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 disabled:opacity-40">
            <Trash2 size={14} /> Clear
          </button>
        </SnowCapped>
      </div>
      <p className="local-page-sub">
        {searches} search{searches === 1 ? '' : 'es'} and {visits} visited page{visits === 1 ? '' : 's'} stored locally on this device.
      </p>
      <div className="frost-scroll local-page-list">
        {list.length === 0 && (
          <div className="glass-panel p-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            No searches yet. Open a new tab to search the web.
          </div>
        )}
        {list.map((h, i) => (
          <SnowCapped key={i} capHeight={5} className="rounded-xl">
            <button className="history-row px-3 py-2 rounded-xl w-full text-left flex items-center gap-3" title={h.type === 'url' ? `Visit ${h.q}` : `Search for ${h.q}`} onClick={() => h.type === 'url' ? onOpenUrl(h.q) : onRun(h.q)}>
              {h.type === 'url' ? <Globe size={14} style={{ color: 'var(--text-muted)' }} /> : <Search size={14} style={{ color: 'var(--text-muted)' }} />}
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate" style={{ color: 'var(--text)' }}>{h.q}</div>
                <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{h.type === 'url' ? 'Visited page' : 'Search'} · {new Date(h.ts).toLocaleString()}</div>
              </div>
            </button>
          </SnowCapped>
        ))}
      </div>
    </div>
  );
}
