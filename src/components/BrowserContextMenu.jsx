import React, { useEffect, useRef } from 'react';
import {
  ArrowLeft, ArrowRight, Copy, Download, ExternalLink, Globe, Image, Play, Pause,
  RotateCw, Scissors, Search, Volume2, VolumeX, X, ClipboardPaste,
} from 'lucide-react';

export default function BrowserContextMenu({
  menu, onClose, onBack, onForward, onReload, onReloadTab, onOpen, onOpenCurrent,
  onCopy, onSearch, onDownload, onDuplicate, onCloseTab, onCloseOtherTabs,
  onTranslate, onEdit, onMediaAction, onSelectAll, canBack, canForward,
  canCloseOtherTabs,
}) {
  const menuRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const menuElement = menuRef.current;
    menuElement?.querySelector('button')?.focus();
    const dismiss = (event) => { if (!menuElement?.contains(event.target)) onCloseRef.current(); };
    const keydown = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); onCloseRef.current(); return; }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      const items = [...(menuElement?.querySelectorAll('[role="menuitem"]') || [])];
      if (!items.length) return;
      event.preventDefault();
      const current = items.indexOf(document.activeElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
        : (current + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length;
      items[next]?.focus();
    };
    window.addEventListener('mousedown', dismiss);
    window.addEventListener('keydown', keydown);
    return () => {
      window.removeEventListener('mousedown', dismiss);
      window.removeEventListener('keydown', keydown);
    };
  }, [menu.kind, menu.tabId, menu.x, menu.y]);

  const editActions = menu.editable ? [
    ...(!menu.readOnly ? [{ icon: Scissors, label: 'Cut', run: () => onEdit('cut', menu) }] : []),
    ...(menu.selection ? [{ icon: Copy, label: 'Copy', run: () => onCopy(menu.selection) }] : []),
    ...(!menu.readOnly ? [{ icon: ClipboardPaste, label: 'Paste', run: () => onEdit('paste', menu) }] : []),
    { icon: Search, label: 'Select all', run: () => onEdit('select_all', menu) },
  ] : [];
  const targetActions = [
    ...(menu.link ? [
      { icon: ExternalLink, label: 'Open link', run: () => onOpenCurrent(menu.link) },
      { icon: ExternalLink, label: 'Open link in new tab', run: () => onOpen(menu.link) },
      { icon: Copy, label: 'Copy link address', run: () => onCopy(menu.link) },
      { icon: Download, label: 'Download linked file', run: () => onDownload(menu.link) },
    ] : []),
    ...(menu.selection && !menu.editable ? [
      { icon: Search, label: 'Search selected text', run: () => onSearch(menu.selection) },
      { icon: Copy, label: 'Copy selected text', run: () => onCopy(menu.selection) },
    ] : []),
    ...(menu.image ? [
      { icon: Image, label: 'Open image in new tab', run: () => onOpen(menu.image) },
      { icon: Copy, label: 'Copy image address', run: () => onCopy(menu.image) },
      { icon: Download, label: 'Save image', run: () => onDownload(menu.image) },
    ] : []),
    ...(menu.media ? [
      { icon: menu.mediaPlaying ? Pause : Play, label: menu.mediaPlaying ? 'Pause media' : 'Play media', run: () => onMediaAction(menu, menu.mediaPlaying ? 'pause' : 'play') },
      { icon: menu.mediaMuted ? Volume2 : VolumeX, label: menu.mediaMuted ? 'Unmute media' : 'Mute media', run: () => onMediaAction(menu, menu.mediaMuted ? 'unmute' : 'mute') },
      ...(menu.mediaUrl ? [
        { icon: ExternalLink, label: 'Open media in new tab', run: () => onOpen(menu.mediaUrl) },
        { icon: Download, label: 'Download media', run: () => onDownload(menu.mediaUrl) },
      ] : []),
    ] : []),
  ];
  const hasTarget = !!(menu.link || menu.selection || menu.image || menu.media);
  const pageActions = [
    ...(!hasTarget && !menu.editable ? [
      ...(canBack ? [{ icon: ArrowLeft, label: 'Back', run: onBack }] : []),
      ...(canForward ? [{ icon: ArrowRight, label: 'Forward', run: onForward }] : []),
      { icon: RotateCw, label: 'Reload page', run: onReload },
      { icon: Globe, label: 'Copy page address', run: () => onCopy(menu.page) },
      { icon: Search, label: 'Select all', run: () => onSelectAll(menu) },
      { icon: Globe, label: 'Translate page', run: onTranslate },
    ] : (hasTarget ? targetActions : [])),
  ];
  const tabActions = [
    { icon: RotateCw, label: 'Reload tab', run: () => onReloadTab(menu.tabId) },
    ...(menu.page ? [{ icon: Copy, label: 'Copy tab address', run: () => onCopy(menu.page) }] : []),
    { icon: Copy, label: 'Duplicate tab', run: () => onDuplicate(menu.tabId) },
    ...(canCloseOtherTabs ? [{ icon: X, label: 'Close other tabs', run: () => onCloseOtherTabs(menu.tabId) }] : []),
    { icon: X, label: 'Close tab', run: () => onCloseTab(menu.tabId) },
  ];
  const actions = menu.kind === 'tab' ? tabActions : [...editActions, ...(editActions.length && targetActions.length ? [{ separator: true }] : []), ...pageActions];
  const menuHeight = Math.min(actions.length * 38 + 18, 560);
  const left = Math.max(8, Math.min(menu.x, window.innerWidth - 288));
  const top = Math.max(8, Math.min(menu.y, window.innerHeight - menuHeight - 8));

  return (
    <div
      ref={menuRef}
      className="browser-context-menu chrome-menu glass-panel"
      role="menu"
      aria-label={menu.kind === 'tab' ? 'Tab actions' : 'Page actions'}
      style={{ left, top }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {actions.map((action, index) => {
        if (action.separator) return <div key={`separator-${index}`} className="browser-context-separator" />;
        const Icon = action.icon;
        return (
          <button
            key={`${action.label}-${index}`}
            className="chrome-menu-item"
            role="menuitem"
            onClick={async () => { try { await action.run(); } finally { onClose(); } }}
          >
            <Icon size={15} /> <span>{action.label}</span>
          </button>
        );
      })}
    </div>
  );
}
