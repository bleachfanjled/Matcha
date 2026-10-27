import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { browserPrefs } from '@/lib/browserPrefs';
import { Download, Trash2, ShieldAlert, FileText, FolderOpen, X } from 'lucide-react';

export default function DownloadsPopup({ onClose, anchorRef }) {
  const popupRef = useRef(null);
  const [downloads, setDownloads] = useState(browserPrefs.getDownloads());
  const [error, setError] = useState('');
  const [position, setPosition] = useState({ top: 70, right: 16 });

  useLayoutEffect(() => {
    const place = () => {
      const anchor = anchorRef?.current?.getBoundingClientRect();
      if (!anchor) return;
      setPosition({
        top: Math.min(anchor.bottom + 8, window.innerHeight - 280),
        right: Math.max(12, window.innerWidth - anchor.right),
      });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchorRef]);

  useEffect(() => browserPrefs.subscribe(() => setDownloads([...browserPrefs.getDownloads()])), []);
  useEffect(() => {
    const dismiss = (event) => {
      if (popupRef.current?.contains(event.target) || anchorRef?.current?.contains(event.target)) return;
      onClose();
    };
    const escape = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('mousedown', dismiss);
    window.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('mousedown', dismiss);
      window.removeEventListener('keydown', escape);
    };
  }, [onClose]);

  const openFile = async (download) => {
    setError('');
    try { await invoke('open_download', { path: download.path || download.name }); }
    catch (failure) { setError(failure?.message || 'Could not open the downloaded file.'); }
  };
  const revealFile = async (download) => {
    setError('');
    try { await invoke('reveal_download', { path: download.path || download.name }); }
    catch (failure) { setError(failure?.message || 'Could not show the download in your file manager.'); }
  };
  const fileManagerLabel = /mac/i.test(navigator.platform) ? 'Finder' : /win/i.test(navigator.platform) ? 'Explorer' : 'Files';
  const revealLabel = `Show in ${fileManagerLabel}`;

  return (
    <div className="downloads-popup-shell" style={position}>
      <section ref={popupRef} className="glass-panel downloads-popover" aria-label="Downloads">
        <header className="downloads-popover-head">
          <div><Download size={16} /><strong>Downloads</strong></div>
          <div className="downloads-popover-actions">
            {downloads.length > 0 && <button className="chrome-menu-close" onClick={() => browserPrefs.clearDownloads()} title="Clear download history" aria-label="Clear download history"><Trash2 size={14} /></button>}
            <button className="chrome-menu-close" onClick={onClose} title="Close downloads" aria-label="Close downloads"><X size={14} /></button>
          </div>
        </header>
        {error && <p className="downloads-popover-error" role="alert">{error}</p>}
        {downloads.length === 0 ? (
          <div className="downloads-popover-empty"><FolderOpen size={22} /><span>No downloads yet</span></div>
        ) : (
          <div className="downloads-popover-list">
            {downloads.map((download, index) => (
              <div key={`${download.url}-${index}`} className="downloads-popover-item">
                <span
                  className={`downloads-file-icon ${download.status === 'failed' || download.status === 'blocked' ? 'downloads-file-error' : ''} ${download.status === 'downloading' ? 'downloads-file-icon-progress' : ''}`}
                  style={download.status === 'downloading' && Number.isFinite(Number(download.progress)) ? { '--download-progress': `${Math.max(0, Math.min(100, Number(download.progress)))}%` } : undefined}
                  role={download.status === 'downloading' ? 'progressbar' : undefined}
                  aria-valuemin={download.status === 'downloading' ? 0 : undefined}
                  aria-valuemax={download.status === 'downloading' ? 100 : undefined}
                  aria-valuenow={download.status === 'downloading' && Number.isFinite(Number(download.progress)) ? Math.max(0, Math.min(100, Number(download.progress))) : undefined}
                  aria-label={download.status === 'downloading' ? `Download progress ${Math.round(Number(download.progress) || 0)} percent` : undefined}
                >
                  <span className="downloads-file-icon-inner">{download.status === 'failed' || download.status === 'blocked' ? <ShieldAlert size={16} /> : <FileText size={16} />}</span>
                </span>
                <div className="downloads-file-info">
                  <strong title={download.name}>{download.name}</strong>
                  <span>{download.status === 'downloading' ? `Downloading${Number.isFinite(Number(download.progress)) ? ` · ${Math.round(Math.max(0, Math.min(100, Number(download.progress))))}%` : '…'}` : download.status === 'completed' ? 'Downloaded' : download.status === 'failed' ? 'Download failed' : download.status === 'blocked' ? 'Blocked' : download.status}</span>
                </div>
                {download.status === 'completed' && (
                  <div className="downloads-file-actions">
                    <button className="tool-btn downloads-open-file" onClick={() => openFile(download)} title={`Open ${download.name}`} aria-label={`Open ${download.name}`}><FolderOpen size={14} /><span>Open</span></button>
                    <button className="tool-btn downloads-reveal-file" onClick={() => revealFile(download)} title={`${revealLabel}: ${download.name}`} aria-label={`${revealLabel}: ${download.name}`}><FolderOpen size={14} /><span>{revealLabel}</span></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}