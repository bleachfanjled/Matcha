import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import SnowCapped from '@/components/SnowCapped';
import { browserPrefs } from '@/lib/browserPrefs';
import { Download, Trash2, ExternalLink, FileText, ShieldAlert, ScanSearch } from 'lucide-react';
import { scanDownloadSource } from '@/lib/downloadScan';

// matcha://downloads — session download history with open / clear actions.
export default function DownloadsPage({ onOpenUrl }) {
  const [downloads, setDownloads] = useState(browserPrefs.getDownloads());
  const [openError, setOpenError] = useState('');
  const [scanning, setScanning] = useState(() => new Set());
  const [scanAllProgress, setScanAllProgress] = useState(null);
  useEffect(() => browserPrefs.subscribe(() => setDownloads([...browserPrefs.getDownloads()])), []);

  const open = (d) => { if (d.url && onOpenUrl) onOpenUrl(d.url); };
  const openFile = async (download) => {
    setOpenError('');
    try { await invoke('open_download', { path: download.path || download.name }); }
    catch (error) { setOpenError(error?.message || 'Could not open this downloaded file.'); }
  };
  const revealFile = async (download) => {
    setOpenError('');
    try { await invoke('reveal_download', { path: download.path || download.name }); }
    catch (error) { setOpenError(error?.message || 'Could not show the download in your file manager.'); }
  };
  const fileManagerLabel = /mac/i.test(navigator.platform) ? 'Finder' : /win/i.test(navigator.platform) ? 'Explorer' : 'Files';
  const clear = () => browserPrefs.clearDownloads();
  const scanOne = async (download) => {
    if (!download?.id || !download.url || scanning.has(download.id)) return;
    setScanning((current) => new Set(current).add(download.id));
    browserPrefs.updateDownload(download.id, { scanStatus: 'scanning', scanReason: 'Checking the source…' });
    try {
      browserPrefs.updateDownload(download.id, await scanDownloadSource(download));
    } catch (error) {
      browserPrefs.updateDownload(download.id, {
        scanStatus: 'error',
        scanReason: String(error?.message || 'Could not scan this source.').slice(0, 500),
        scannedAt: new Date().toISOString(),
      });
    } finally {
      setScanning((current) => { const next = new Set(current); next.delete(download.id); return next; });
    }
  };
  const scanAll = async () => {
    const targets = browserPrefs.getDownloads().filter((download) => download.url && download.status !== 'downloading');
    if (!targets.length || scanAllProgress) return;
    setScanAllProgress({ done: 0, total: targets.length });
    for (let index = 0; index < targets.length; index += 1) {
      await scanOne(targets[index]);
      setScanAllProgress({ done: index + 1, total: targets.length });
    }
    setScanAllProgress(null);
  };

  return (
    <div className="local-page">
      <div className="local-page-head">
        <div className="local-page-url"><Download size={14} /> matcha://downloads</div>
        <div className="downloads-history-actions">
          {downloads.some((download) => download.url && download.status !== 'downloading') && (
            <button className="tool-btn" onClick={scanAll} disabled={!!scanAllProgress} style={{ padding: '7px 12px', fontSize: 13, borderRadius: 'calc(var(--app-roundness) * 0.7)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <ScanSearch size={14} /> {scanAllProgress ? `Scanning ${scanAllProgress.done}/${scanAllProgress.total}` : 'AI scan all'}
            </button>
          )}
          {downloads.length > 0 && (
            <button className="tool-btn" onClick={clear} style={{ padding: '7px 14px', fontSize: 13, borderRadius: 'calc(var(--app-roundness) * 0.7)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Trash2 size={14} /> Clear all
            </button>
          )}
        </div>
      </div>
      <p className="local-page-sub">Downloads are saved to your device's Downloads folder. AI scans recheck the source address; they do not inspect local file contents.</p>

      <SnowCapped capHeight={6} className="rounded-2xl">
        <section className="glass-panel local-section">
          <div className="local-section-head">Download history</div>
          {openError && <p className="downloads-popover-error" role="alert">{openError}</p>}
          {downloads.length === 0 ? (
            <p className="chrome-menu-empty">No downloads yet.</p>
          ) : (
            <div className="local-page-list">
              {downloads.map((d, i) => (
                <div key={i} className="history-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 'calc(var(--app-roundness) * 0.7)' }}>
                  <div style={{ display: 'grid', placeItems: 'center', width: 34, height: 34, borderRadius: 'calc(var(--app-roundness) * 0.7)', background: d.status === 'blocked' ? 'rgba(255,80,80,0.15)' : 'var(--accent-soft)', color: d.status === 'blocked' ? '#ff6b6b' : 'var(--accent)', flex: '0 0 34px' }}>
                    {d.status === 'blocked' || d.status === 'failed' ? <ShieldAlert size={16} /> : <FileText size={16} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: d.status === 'blocked' || d.status === 'failed' ? '#ff6b6b' : 'var(--accent)', padding: '2px 8px', borderRadius: 999, background: d.status === 'blocked' || d.status === 'failed' ? 'rgba(255,80,80,0.15)' : 'var(--accent-soft)', flex: '0 0 auto' }}>{d.status === 'downloading' ? 'Downloading' : d.status === 'completed' ? 'Downloaded' : d.status === 'failed' ? 'Failed' : d.status === 'blocked' ? 'Blocked' : d.status}</span>
                    </div>
                    {d.reason && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{d.reason}</div>}
                    {d.scanStatus && <div className={`download-scan-result download-scan-${d.scanStatus}`} role="status">
                      {d.scanStatus === 'scanning' ? 'AI source scan in progress…' : d.scanStatus === 'safe' ? 'AI source scan: passed' : d.scanStatus === 'unsafe' ? 'AI source scan: flagged' : 'AI source scan failed'}
                      {d.scannedAt && d.scanStatus !== 'scanning' && <span> · {new Date(d.scannedAt).toLocaleString()}</span>}
                    </div>}
                    {d.scanReason && <div className="download-scan-reason">{d.scanReason}</div>}
                    {d.url && <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{d.url}</div>}
                  </div>
                  {d.url && d.status !== 'blocked' && d.status !== 'failed' && (
                    d.status === 'completed' ? (
                      <div className="downloads-file-actions">
                        <button className="tool-btn webview-btn" onClick={() => openFile(d)} title={`Open ${d.name}`}><FileText size={14} /> Open</button>
                        <button className="tool-btn webview-btn" onClick={() => revealFile(d)} title={`Show ${d.name} in ${fileManagerLabel}`}><ExternalLink size={14} /> {fileManagerLabel}</button>
                      </div>
                    ) : <button className="tool-btn webview-btn" onClick={() => open(d)} title="Open source page"><ExternalLink size={15} /> Source</button>
                  )}
                  {d.url && d.status !== 'downloading' && <button className="tool-btn download-scan-button" onClick={() => scanOne(d)} disabled={scanning.has(d.id) || !!scanAllProgress} title={`AI scan source for ${d.name}`}>
                    <ScanSearch size={14} /> {scanning.has(d.id) ? 'Scanning…' : d.scanStatus ? 'Rescan' : 'AI scan'}
                  </button>}
                </div>
              ))}
            </div>
          )}
        </section>
      </SnowCapped>
    </div>
  );
}
