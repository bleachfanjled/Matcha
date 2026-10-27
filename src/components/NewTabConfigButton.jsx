import React, { useRef, useState, useEffect } from 'react';
import SnowCapped from '@/components/SnowCapped';
import { base44 } from '@/api/base44Client';
import { Pencil, X, ImagePlus, Trash2, Wand2, Sparkles } from 'lucide-react';

// Curated gradient quick-colors (no external dependency).
const PRESETS = [
  { name: 'Frost', value: 'linear-gradient(135deg,#0a0a12,#1e1e2e 60%,#050507)' },
  { name: 'Aurora', value: 'linear-gradient(135deg,#0f2027,#203a43 50%,#2c5364)' },
  { name: 'Matcha Air', value: 'linear-gradient(135deg,#1f3d2b,#142a1e 60%,#0b1a12)' },
  { name: 'Blush', value: 'linear-gradient(135deg,#3a1f2e,#2a1422 60%,#1a0c16)' },
  { name: 'Sunset', value: 'linear-gradient(135deg,#2a0a0e,#140406 60%,#070202)' },
  { name: 'Ocean', value: 'linear-gradient(135deg,#0b1a2e,#102a43 60%,#05101e)' },
  { name: 'Lilac', value: 'linear-gradient(135deg,#1a1430,#241a46 60%,#0e0a1f)' },
  { name: 'Mono', value: 'linear-gradient(135deg,#1a1a1a,#0a0a0a 60%,#000000)' },
];

const GALLERY_KEY = 'matcha_newtab_gallery';
const SEED_PROMPTS = [
  'a serene snowy mountain landscape at dawn, cinematic wide shot',
  'a frozen lake under aurora borealis, night sky, wide shot',
  'a misty pine forest in winter, soft morning light',
];

const isGradient = (v) => typeof v === 'string' && (v.startsWith('linear-gradient') || v.startsWith('radial-gradient'));
function loadGallery() { try { return JSON.parse(localStorage.getItem(GALLERY_KEY) || '[]'); } catch { return []; } }
function saveGallery(g) { try { localStorage.setItem(GALLERY_KEY, JSON.stringify(g)); } catch {} }

// Pencil FAB on the new-tab page. Opens a right sidebar with an AI photo
// gallery, upload, and on-the-spot generation.
export default function NewTabConfigButton({ bg, setBg, scrim, setScrim, blur, setBlur, fit, setFit }) {
  const [open, setOpen] = useState(false);
  const [gallery, setGallery] = useState(loadGallery);
  const [prompt, setPrompt] = useState('');
  const [pending, setPending] = useState(0);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const seededRef = useRef(false);

  const addUrls = (urls) => setGallery((g) => { const ng = [...urls, ...g].slice(0, 18); saveGallery(ng); return ng; });

  const generateOne = async (p) => {
    setBusy(true); setPending((n) => n + 1);
    try {
      const res = await base44.functions.invoke('generateImage', { prompt: p + ', desktop wallpaper, atmospheric, no text' });
      if (res.data?.url) { addUrls([res.data.url]); setBg(res.data.url); }
    } catch { /* ignore */ }
    setPending((n) => n - 1); setBusy(false);
  };

  const seed = async () => {
    setPending((n) => n + SEED_PROMPTS.length);
    const results = await Promise.allSettled(
      SEED_PROMPTS.map((p) => base44.functions.invoke('generateImage', { prompt: p + ', desktop wallpaper, no text' }))
    );
    const urls = results.filter((r) => r.status === 'fulfilled' && r.value?.data?.url).map((r) => r.value.data.url);
    if (urls.length) addUrls(urls);
    setPending((n) => n - SEED_PROMPTS.length);
  };

  // On first open, if there are no photos yet, auto-generate a few to fill the gallery.
  useEffect(() => {
    if (open && !seededRef.current && gallery.filter((v) => !isGradient(v)).length === 0) {
      seededRef.current = true;
      seed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pickFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { addUrls([reader.result]); setBg(reader.result); };
    reader.readAsDataURL(file);
  };

  const onGen = (e) => { e.preventDefault(); const p = prompt.trim(); if (!p || busy) return; setPrompt(''); generateOne(p); };

  return (
    <>
      <button className="newtab-fab" onClick={() => setOpen((o) => !o)} title="Personalize new tab" aria-label="Personalize new tab">
        <Pencil size={18} />
      </button>

      {open && (
        <aside className="newtab-sidebar glass-panel">
          <SnowCapped capHeight={6} className="rounded-2xl">
            <div className="newtab-sidebar-head">
              <div className="newtab-sidebar-title"><Sparkles size={16} /> Personalize</div>
              <button className="ai-sidebar-close" onClick={() => setOpen(false)} aria-label="Close"><X size={16} /></button>
            </div>
          </SnowCapped>

          <div className="newtab-sidebar-body frost-scroll">
            <div className="newtab-sidebar-section">
              <div className="newtab-sidebar-label">Generate with AI</div>
              <form className="newtab-gen-row" onSubmit={onGen}>
                <input className="frost-input px-3 py-2 text-sm flex-1 min-w-0" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe a background…" spellCheck={false} />
                <button type="submit" className="tool-btn px-3 py-2 rounded-lg text-sm flex items-center gap-1.5" disabled={busy}><Wand2 size={15} /> Make</button>
              </form>
              {busy && <div className="ai-gen" style={{ marginTop: 8 }}><div className="ai-gen-shimmer" /><span>Generating…</span></div>}
            </div>

            <div className="newtab-sidebar-section">
              <div className="newtab-sidebar-label">Upload your own</div>
              <button className="tool-btn newtab-upload" onClick={() => fileRef.current?.click()}><ImagePlus size={16} /> Choose image from device</button>
              <input ref={fileRef} type="file" accept="image/*,image/gif" hidden onChange={(e) => pickFile(e.target.files?.[0])} />
            </div>

            <div className="newtab-sidebar-section">
              <div className="newtab-sidebar-label">Photos</div>
              <div className="newtab-gallery">
                {Array.from({ length: pending }).map((_, i) => <div key={'p' + i} className="newtab-thumb-skel" />)}
                {gallery.map((item, i) => (
                  <button key={i} className={`newtab-thumb ${item === bg ? 'newtab-thumb-active' : ''}`} onClick={() => setBg(item)} title="Use this background">
                    {isGradient(item) ? <span style={{ display: 'block', width: '100%', height: '100%', backgroundImage: item }} /> : <img src={item} alt="" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="newtab-sidebar-section">
              <div className="newtab-sidebar-label">Quick colors</div>
              <div className="newtab-presets">
                {PRESETS.map((p) => (
                  <button key={p.name} className={`newtab-preset ${p.value === bg ? 'newtab-thumb-active' : ''}`} style={{ backgroundImage: p.value }} title={p.name} aria-label={p.name} onClick={() => setBg(p.value)} />
                ))}
              </div>
            </div>

            <div className="newtab-sidebar-section">
              <div className="newtab-sidebar-label">Overlay darkness — {scrim}%</div>
              <input type="range" min="0" max="100" value={scrim} onChange={(e) => setScrim(Number(e.target.value))} className="newtab-range" />
            </div>
            <div className="newtab-sidebar-section">
              <div className="newtab-sidebar-label">Background blur — {blur}px</div>
              <input type="range" min="0" max="20" value={blur} onChange={(e) => setBlur(Number(e.target.value))} className="newtab-range" />
            </div>
            <div className="newtab-sidebar-section">
              <div className="newtab-sidebar-label">Image fit</div>
              <div className="newtab-fit-row">
                {['cover', 'contain', 'center'].map((f) => (
                  <button key={f} className={`mode-btn py-1.5 rounded-lg text-xs capitalize ${fit === f ? 'mode-btn-active' : ''}`} onClick={() => setFit(f)}>{f}</button>
                ))}
              </div>
            </div>

            {bg && (
              <button className="tool-btn px-3 py-2 rounded-lg text-sm w-full flex items-center justify-center gap-1.5" onClick={() => setBg('')}><Trash2 size={15} /> Remove background</button>
            )}
          </div>
        </aside>
      )}
    </>
  );
}
