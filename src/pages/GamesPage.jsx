import React, { useMemo, useState } from 'react';
import SnowCapped from '@/components/SnowCapped';
import { GAMES, GAME_CATEGORIES } from '@/lib/gameLibrary';
import { Gamepad2, Sparkles, Zap, Search, ArrowLeft, X, Expand, Flame } from 'lucide-react';

// matcha://games — every game from 1v1-lolgame.github.io, embedded in an
// iframe, grouped into Popular / New categories with real names + cover art.
export default function GamesPage({ onOpen }) {
  const [mode, setMode] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return GAMES;
    return GAMES.filter((g) => g.name.toLowerCase().includes(q));
  }, [query]);

  if (active) {
    return (
      <div className="local-page">
        <div className="game-player-head">
          <button className="game-back" onClick={() => setActive(null)}><ArrowLeft size={16} /> Library</button>
          <div className="game-player-title">{active.name}</div>
          <a className="game-ext" href={active.url} target="_blank" rel="noopener noreferrer"><Expand size={15} /> Open</a>
        </div>
        <SnowCapped capHeight={6} className="rounded-2xl">
          <div className="game-player-frame glass-panel">
            <iframe src={active.url} title={active.name} allowFullScreen />
          </div>
        </SnowCapped>
      </div>
    );
  }

  return (
    <div className="local-page">
      <div className="local-page-head">
        <div className="local-page-url"><Gamepad2 size={14} /> matcha://games</div>
      </div>
      <p className="local-page-sub">{GAMES.length} games ready to play — pick a tile to launch it inside Matcha Air.</p>

      <SnowCapped capHeight={6} className="rounded-2xl">
        <div className="glass-panel gaming-mode">
          <div className="gaming-mode-info">
            <div className="gaming-mode-title"><Zap size={16} /> Gaming Mode</div>
            <div className="gaming-mode-sub">Dims distractions and prioritizes a performance-feel render.</div>
          </div>
          <button className={`toggle-switch ${mode ? 'toggle-on' : ''}`} onClick={() => setMode((m) => !m)} aria-label="Toggle gaming mode">
            <span className="toggle-knob" />
          </button>
        </div>
      </SnowCapped>

      <div className="game-search-wrap">
        <Search size={15} style={{ color: 'var(--text-muted)' }} />
        <input className="game-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${GAMES.length} games…`} />
        {query && <button className="game-search-clear" onClick={() => setQuery('')} aria-label="Clear"><X size={14} /></button>}
      </div>

      {GAME_CATEGORIES.map((cat) => {
        const games = filtered.filter((g) => g.cat === cat);
        if (!games.length) return null;
        const Icon = cat === 'Popular' ? Flame : Sparkles;
        return (
          <div key={cat} className="game-cat">
            <div className="game-cat-head">
              <Icon size={15} style={{ color: 'var(--accent)' }} /> {cat} Games
              <span className="game-cat-count">{games.length}</span>
            </div>
            <div className="game-library-grid">
              {games.map((g) => (
                <button key={g.id} className="game-card" onClick={() => setActive(g)} title={g.name}>
                  <img src={g.thumb} alt={g.name} className="game-card-thumb" loading="lazy" />
                  <span className="game-card-name">{g.name}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {filtered.length === 0 && <div className="game-empty">No games match “{query}”.</div>}

      <SnowCapped capHeight={6} className="rounded-2xl">
        <button className="glass-panel ai-copilot" onClick={() => onOpen('ai')}>
          <div className="ai-copilot-icon"><Sparkles size={20} /></div>
          <div className="ai-copilot-text">
            <div className="ai-copilot-title">Ask the AI co-pilot</div>
            <div className="ai-copilot-sub">Get game recommendations, tips, and walkthroughs.</div>
          </div>
        </button>
      </SnowCapped>
    </div>
  );
}
