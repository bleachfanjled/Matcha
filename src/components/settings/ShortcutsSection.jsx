import React, { useEffect, useState } from 'react';
import SnowCapped from '@/components/SnowCapped';
import ShortcutGlyph from '@/components/ShortcutGlyph';
import ShortcutEditor from '@/components/ShortcutEditor';
import { keyBindings, describeCombo } from '@/lib/keyboardShortcuts';
import { shortcuts } from '@/lib/shortcuts';
import { Keyboard, Plus, Pencil, X, RotateCcw } from 'lucide-react';

// Settings > Shortcuts — rebind keyboard shortcuts and manage quick-launch tiles.
export default function ShortcutsSection() {
  const [bindings, setBindings] = useState(keyBindings.list());
  const [editing, setEditing] = useState(null);
  const [tiles, setTiles] = useState(shortcuts.list());
  const [editor, setEditor] = useState(null);

  useEffect(() => keyBindings.subscribe(setBindings), []);
  useEffect(() => shortcuts.subscribe(() => setTiles(shortcuts.list())), []);

  // Capture the next key press to rebind the active shortcut.
  useEffect(() => {
    if (!editing) return;
    const handler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') { setEditing(null); return; }
      const combo = { key: e.key.toLowerCase(), mod: e.ctrlKey || e.metaKey, shift: e.shiftKey, alt: e.altKey };
      keyBindings.set(editing, combo);
      setEditing(null);
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [editing]);

  return (
    <>
      <SnowCapped capHeight={6} className="rounded-2xl">
        <section className="glass-panel local-section">
          <div className="local-section-head"><Keyboard size={13} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6 }} />Keyboard Shortcuts</div>
          <div className="kb-list">
            {bindings.map((b) => (
              <div key={b.id} className="kb-row">
                <span className="kb-label">{b.label}</span>
                <button
                  className={`kb-combo ${editing === b.id ? 'kb-combo-capturing' : ''}`}
                  onClick={() => setEditing(editing === b.id ? null : b.id)}
                >
                  {editing === b.id ? 'Press keys…' : describeCombo(b.combo)}
                </button>
              </div>
            ))}
          </div>
          <button className="tool-btn px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 mt-3" onClick={() => keyBindings.reset()}>
            <RotateCcw size={13} /> Reset to defaults
          </button>
        </section>
      </SnowCapped>

      <SnowCapped capHeight={6} className="rounded-2xl">
        <section className="glass-panel local-section">
          <div className="local-section-head">Quick-launch Tiles</div>
          <div className="tile-editor">
            {tiles.map((t) => (
              <div key={t.id} className="tile-editor-row">
                <ShortcutGlyph s={t} size={28} />
                <div className="flex-1" style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: 'var(--text)' }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.type === 'url' ? t.url : `Search "${t.name}"`}
                  </div>
                </div>
                <button className="tile-editor-remove" onClick={() => setEditor({ mode: 'edit', id: t.id, initial: t })} aria-label={`Edit ${t.name}`}><Pencil size={13} /></button>
                <button className="tile-editor-remove" onClick={() => shortcuts.remove(t.id)} aria-label={`Remove ${t.name}`}><X size={13} /></button>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="tool-btn px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5" onClick={() => setEditor({ mode: 'add' })}><Plus size={13} /> Add tile</button>
            <button className="tool-btn px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5" onClick={() => shortcuts.reset()}><RotateCcw size={13} /> Reset tiles</button>
          </div>
        </section>
      </SnowCapped>

      {editor && (
        <ShortcutEditor
          mode={editor.mode}
          initial={editor.initial}
          onClose={() => setEditor(null)}
          onSave={(data) => { if (editor.mode === 'add') shortcuts.add(data); else shortcuts.update(editor.id, data); setEditor(null); }}
          onDelete={editor.mode === 'edit' ? () => { shortcuts.remove(editor.id); setEditor(null); } : undefined}
        />
      )}
    </>
  );
}