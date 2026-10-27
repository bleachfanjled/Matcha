import React, { useEffect, useState } from 'react';
import SnowCapped from '@/components/SnowCapped';
import ShortcutGlyph from '@/components/ShortcutGlyph';
import ShortcutEditor from '@/components/ShortcutEditor';
import { shortcuts } from '@/lib/shortcuts';
import { Plus, Pencil } from 'lucide-react';

// Row of quick-launch shortcuts on the new-tab page. Each tile opens its
// action (a web search or a stored URL); the pencil opens an editor to
// change the name, switch between search/URL, or delete it.
export default function Shortcuts({ onSearch, onOpenUrl }) {
  const [list, setList] = useState(shortcuts.list());
  const [editor, setEditor] = useState(null);
  useEffect(() => shortcuts.subscribe(() => setList(shortcuts.list())), []);

  const activate = (s) => {
    if (s.type === 'url' && s.url) onOpenUrl?.(s.url);
    else onSearch(s.name);
  };

  return (
    <div className="shortcuts-row">
      {list.map((s) => (
        <SnowCapped key={s.id} capHeight={5} roundness={1.15} className="rounded-2xl">
          <div className="shortcut-tile">
            <button className="shortcut-main" onClick={() => activate(s)} title={s.type === 'url' ? s.url : `Search ${s.name}`}>
              <ShortcutGlyph s={s} />
              <span className="shortcut-name">{s.name}</span>
            </button>
            <button className="shortcut-remove" onClick={() => setEditor({ mode: 'edit', id: s.id, initial: s })} aria-label={`Edit ${s.name}`}>
              <Pencil size={11} />
            </button>
          </div>
        </SnowCapped>
      ))}
      <SnowCapped capHeight={5} roundness={1.15} className="rounded-2xl">
        <button className="shortcut-add" onClick={() => setEditor({ mode: 'add' })} title="Add a shortcut">
          <Plus size={20} />
          <span className="shortcut-name">Add</span>
        </button>
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
    </div>
  );
}