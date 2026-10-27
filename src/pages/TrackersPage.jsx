import React, { useEffect, useState } from 'react';
import SnowCapped from '@/components/SnowCapped';
import { trackerLog } from '@/lib/trackerLog';
import { Search, Shield, Trash2, Globe } from 'lucide-react';

// matcha://trackers — shows each site you visited and the trackers it
// contacted (analytics, ads, social, fingerprinting), color-coded by category.
const CAT_COLORS = {
  Analytics: '#8a93ff',
  Advertising: '#ff6b6b',
  Social: '#49E286',
  'Content Delivery': '#ffc371',
  Fingerprinting: '#c471ed',
  Other: '#9a9ab5',
};

export default function TrackersPage() {
  const [entries, setEntries] = useState(() => trackerLog.list());
  useEffect(() => trackerLog.subscribe(() => setEntries(trackerLog.list())), []);
  const totalTrackers = entries.reduce((n, e) => n + e.trackers.length, 0);

  return (
    <div className="local-page">
      <div className="local-page-head">
        <div className="local-page-url"><Search size={14} /> matcha://trackers</div>
        {entries.length > 0 && (
          <button className="action-btn-ghost" style={{ padding: '7px 14px', borderRadius: 999, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => trackerLog.clear()}>
            <Trash2 size={14} /> Clear
          </button>
        )}
      </div>
      <p className="local-page-sub">
        Sites you visited and the trackers they contacted.
        {entries.length > 0 && ` ${entries.length} sites · ${totalTrackers} trackers`}
      </p>

      {entries.length === 0 ? (
        <SnowCapped capHeight={6} className="rounded-2xl">
          <div className="glass-panel local-section" style={{ textAlign: 'center', padding: '44px 20px' }}>
            <div style={{ display: 'grid', placeItems: 'center', width: 54, height: 54, margin: '0 auto 14px', borderRadius: 'calc(var(--app-roundness) * 1.15)', background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--glass-border)' }}>
              <Shield size={24} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>No trackers logged yet</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, maxWidth: 420, margin: '4px auto 0' }}>
              Open a website in a Matcha Air tab and it will be analyzed here, listing every tracker the page contacted.
            </div>
          </div>
        </SnowCapped>
      ) : (
        <div className="local-page-list">
          {entries.map((e) => (
            <SnowCapped key={e.site} capHeight={6} className="rounded-2xl">
              <section className="glass-panel local-section">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <Globe size={16} style={{ color: 'var(--accent)' }} />
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{e.site}</span>
                  {e.blocked && (
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent)', padding: '3px 9px', borderRadius: 999, background: 'var(--accent-soft)', border: '1px solid var(--glass-border)' }}>Blocked</span>
                  )}
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{new Date(e.date).toLocaleString()}</span>
                </div>
                {e.trackers.length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No trackers detected.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {e.trackers.map((t, i) => {
                      const color = CAT_COLORS[t.category] || CAT_COLORS.Other;
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 'calc(var(--app-roundness) * 0.7)', background: 'var(--accent-soft)', border: '1px solid var(--glass-border)' }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flex: '0 0 8px', boxShadow: `0 0 8px ${color}` }} />
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{t.name}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{t.domain}</span>
                          <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: color, padding: '3px 9px', borderRadius: 999, background: color + '22', whiteSpace: 'nowrap' }}>{t.category}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </SnowCapped>
          ))}
        </div>
      )}
    </div>
  );
}
