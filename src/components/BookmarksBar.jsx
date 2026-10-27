import React, { useEffect, useRef, useState } from 'react';
import { Bookmark, ChevronLeft, ChevronRight, Globe, Pencil, Plus, Trash2 } from 'lucide-react';
import { bookmarks } from '@/lib/bookmarks';

export default function BookmarksBar({ currentUrl, onOpen }) {
  const [items, setItems] = useState(() => bookmarks.list().filter((item) => item.url));
  const [menu, setMenu] = useState(null);
  const [draggedId, setDraggedId] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => bookmarks.subscribe(() => setItems(bookmarks.list().filter((item) => item.url))), []);
  useEffect(() => { if (menu) menuRef.current?.querySelector('button')?.focus(); }, [menu]);
  useEffect(() => {
    if (!menu) return undefined;
    const close = (event) => { if (!event.target.closest('.bookmark-context-menu')) setMenu(null); };
    const keydown = (event) => { if (event.key === 'Escape') setMenu(null); };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', keydown);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', keydown);
    };
  }, [menu]);

  const add = () => {
    const url = window.prompt('Bookmark address', currentUrl || 'https://');
    if (!url?.trim()) return;
    let parsed;
    try { parsed = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`); }
    catch { return; }
    if (!['http:', 'https:'].includes(parsed.protocol)) return;
    const title = window.prompt('Bookmark name', parsed.hostname);
    if (title === null) return;
    bookmarks.add({ url: parsed.href, title });
  };

  const edit = (item) => {
    const title = window.prompt('Bookmark name', item.title || item.url);
    if (title === null) return;
    const url = window.prompt('Bookmark address', item.url);
    if (url === null) return;
    bookmarks.update(item.id, { title, url });
    setMenu(null);
  };

  const showMenu = (event, item) => {
    event.preventDefault();
    setMenu({ id: item.id, x: Math.min(event.clientX, window.innerWidth - 205), y: Math.min(event.clientY, window.innerHeight - 150) });
  };

  return (
    <nav className="bookmarks-bar" aria-label="Bookmarks bar">
      <div className="bookmarks-scroll">
        {items.map((item, index) => {
          let hostname = '';
          try { hostname = new URL(item.url).hostname; } catch { /* persisted malformed item */ }
          return (
            <button
              key={item.id}
              type="button"
              className={`bookmark-item ${draggedId === item.id ? 'bookmark-item-dragging' : ''}`}
              title={`${item.title || hostname}\n${item.url}`}
              onClick={() => onOpen(item.url)}
              onContextMenu={(event) => showMenu(event, item)}
              onKeyDown={(event) => {
                if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
                  event.preventDefault();
                  const rect = event.currentTarget.getBoundingClientRect();
                  setMenu({ id: item.id, x: rect.left, y: Math.min(rect.bottom, window.innerHeight - 150) });
                }
              }}
              draggable
              onDragStart={(event) => { setDraggedId(item.id); event.dataTransfer.setData('text/plain', item.id); event.dataTransfer.effectAllowed = 'move'; }}
              onDragEnd={() => setDraggedId(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const sourceId = event.dataTransfer.getData('text/plain') || draggedId;
                const sourceIndex = items.findIndex((entry) => entry.id === sourceId);
                if (sourceIndex >= 0 && sourceIndex !== index) bookmarks.move(sourceId, index - sourceIndex);
                setDraggedId(null);
              }}
            >
              {hostname ? <img src={new URL('/favicon.ico', item.url).href} alt="" onError={(event) => { event.currentTarget.style.display = 'none'; }} /> : <Globe size={14} />}
              <span>{item.title || hostname || item.url}</span>
            </button>
          );
        })}
        {items.length === 0 && <span className="bookmarks-empty">Save a site here for quick access</span>}
      </div>
      <button type="button" className="bookmark-add" onClick={add} title="Add bookmark" aria-label="Add bookmark"><Plus size={15} /><Bookmark size={13} /></button>
      {menu && (() => {
        const item = items.find((entry) => entry.id === menu.id);
        if (!item) return null;
        return (
          <div ref={menuRef} className="bookmark-context-menu glass-panel" role="menu" style={{ left: menu.x, top: menu.y }}>
            <button className="chrome-menu-item" role="menuitem" onClick={() => { bookmarks.move(item.id, -1); setMenu(null); }}><ChevronLeft size={15} /><span>Move left</span></button>
            <button className="chrome-menu-item" role="menuitem" onClick={() => { bookmarks.move(item.id, 1); setMenu(null); }}><ChevronRight size={15} /><span>Move right</span></button>
            <button className="chrome-menu-item" role="menuitem" onClick={() => edit(item)}><Pencil size={15} /><span>Edit bookmark</span></button>
            <button className="chrome-menu-item bookmark-delete" role="menuitem" onClick={() => { bookmarks.remove(item.id); setMenu(null); }}><Trash2 size={15} /><span>Remove bookmark</span></button>
          </div>
        );
      })()}
    </nav>
  );
}
