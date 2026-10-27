import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Blocks, Plus, Upload, Trash2, ShieldCheck, Puzzle, Palette, ExternalLink, Power, Sparkles, Search, X, Code2, AlertTriangle, CheckCircle2, Network } from 'lucide-react';

const ADDONS_KEY = 'matcha.addons.v1';
const PAGES_KEY = 'matcha.customPages.v1';
const CAPABILITIES = [
  { id: 'content-filter', label: 'Content filtering', detail: 'Request-blocking rules for supported pages' },
  { id: 'proxy', label: 'Network proxy', detail: 'Use a configured proxy; this is not automatically a full VPN' },
  { id: 'audio', label: 'Audio processing', detail: 'Microphone/audio effects through a supported pipeline' },
  { id: 'page-ui', label: 'Browser page UI', detail: 'Add buttons and panels to Matcha pages' },
];
const read = (key, fallback) => { try { const value = JSON.parse(localStorage.getItem(key) || 'null'); return value ?? fallback; } catch { return fallback; } };
const slugify = (value) => String(value || '').toLowerCase().trim().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 36) || 'my-page';
const idFor = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export function getMatchaCustomPages() { return read(PAGES_KEY, []); }
export function getMatchaAddons() { return read(ADDONS_KEY, []); }

export default function AddonsPage({ onOpenPage }) {
  const [tab, setTab] = useState('discover');
  const [addons, setAddons] = useState(getMatchaAddons);
  const [pages, setPages] = useState(getMatchaCustomPages);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [pageName, setPageName] = useState('My Matcha Page');
  const [pageSubtitle, setPageSubtitle] = useState('A little corner of the browser, made yours.');
  const [pageColor, setPageColor] = useState('#8ed9b1');
  const [pageContent, setPageContent] = useState('Welcome to my page!');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const fileRef = useRef(null);
  useEffect(() => { localStorage.setItem(ADDONS_KEY, JSON.stringify(addons)); }, [addons]);
  useEffect(() => { localStorage.setItem(PAGES_KEY, JSON.stringify(pages)); }, [pages]);

  const installManifest = (manifest, filename = 'Local addon') => {
    if (!manifest || typeof manifest !== 'object' || typeof manifest.name !== 'string') throw new Error('Addon file needs a manifest with a name.');
    if (!Array.isArray(manifest.capabilities || [])) throw new Error('The capabilities field must be a list.');
    const requested = [...new Set((manifest.capabilities || []).filter((c) => CAPABILITIES.some((cap) => cap.id === c)))];
    const addon = { id: idFor(), name: manifest.name.slice(0, 64), description: String(manifest.description || 'User-installed Matcha addon').slice(0, 240), version: String(manifest.version || '1.0.0').slice(0, 24), source: filename, requestedCapabilities: requested, grantedCapabilities: [], enabled: false, installedAt: new Date().toISOString(), kind: 'manifest' };
    setAddons((current) => [addon, ...current]);
    setNotice(`Added ${addon.name}. Review its permissions before enabling it.`);
    setError(''); setTab('installed');
  };
  const uploadFile = async (file) => {
    if (!file) return;
    try {
      if (file.size > 256 * 1024) throw new Error('Addon manifest must be smaller than 256 KB.');
      const text = await file.text();
      if (!file.name.toLowerCase().endsWith('.json')) throw new Error('For now, upload a .json addon manifest. Executable code packages are not run directly.');
      installManifest(JSON.parse(text), file.name);
    } catch (e) { setError(e.message || 'Could not read this addon file.'); }
    if (fileRef.current) fileRef.current.value = '';
  };
  const createPage = () => {
    const name = pageName.trim();
    if (!name) { setError('Give your page a name first.'); return; }
    let slug = slugify(name); let suffix = 2;
    while (pages.some((p) => p.slug === slug)) slug = `${slugify(name)}-${suffix++}`;
    const page = { id: idFor(), name: name.slice(0, 60), slug, subtitle: pageSubtitle.slice(0, 160), color: /^#[0-9a-f]{6}$/i.test(pageColor) ? pageColor : '#8ed9b1', content: pageContent.slice(0, 5000), createdAt: new Date().toISOString() };
    setPages((current) => [page, ...current]); setShowCreate(false); setError(''); setNotice(`Created matcha://${slug}`); setTab('pages');
    setPageName('My Matcha Page'); setPageSubtitle('A little corner of the browser, made yours.'); setPageContent('Welcome to my page!');
  };
  const toggleAddon = (addon) => {
    if (addon.enabled) { setAddons((current) => current.map((a) => a.id === addon.id ? { ...a, enabled: false } : a)); return; }
    if (addon.requestedCapabilities.length && !addon.grantedCapabilities?.length) {
      const approved = window.confirm(`${addon.name} requests: ${addon.requestedCapabilities.map((id) => CAPABILITIES.find((c) => c.id === id)?.label || id).join(', ')}.\n\nOnly approve capabilities you trust. This manifest is metadata only; executable addon APIs are not active in this build. Grant these requested capabilities?`);
      if (!approved) return;
      setAddons((current) => current.map((a) => a.id === addon.id ? { ...a, grantedCapabilities: [...a.requestedCapabilities], enabled: true } : a));
    } else setAddons((current) => current.map((a) => a.id === addon.id ? { ...a, enabled: true } : a));
  };
  const filtered = useMemo(() => addons.filter((a) => `${a.name} ${a.description}`.toLowerCase().includes(search.toLowerCase())), [addons, search]);
  const Card = ({ children, className = '' }) => <div className={`rounded-2xl border border-white/10 bg-white/[0.045] backdrop-blur-xl ${className}`}>{children}</div>;

  return <div className="mx-auto w-full max-w-6xl px-5 py-8 md:px-8 md:py-10" style={{ color: "var(--text)" }}>
    <div className="relative overflow-hidden rounded-[28px] border border-emerald-300/20 bg-gradient-to-br from-emerald-400/15 via-white/[0.035] to-pink-400/10 p-6 md:p-9 mb-7">
      <div className="absolute -right-8 -top-14 h-52 w-52 rounded-full bg-emerald-300/10 blur-3xl pointer-events-none" />
      <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div><div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/20 bg-emerald-300/10 px-3 py-1 text-xs text-emerald-100 mb-4"><Sparkles size={13}/> THE MATCHA ECOSYSTEM</div><h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Addons, made yours.</h1><p className="mt-2 max-w-xl text-sm md:text-base opacity-70">Build your own Matcha pages, organize extensions, and shape the browser around the way you work.</p></div>
        <button onClick={() => { setShowCreate(true); setError(''); }} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-300 px-4 py-3 font-semibold text-emerald-950 hover:bg-emerald-200 transition"><Plus size={17}/> Create a page</button>
      </div>
      <div className="relative grid grid-cols-3 gap-3 mt-7 max-w-xl"><div className="rounded-xl bg-black/10 border border-white/10 p-3"><div className="text-2xl font-semibold">{addons.length}</div><div className="text-xs opacity-65">Installed addons</div></div><div className="rounded-xl bg-black/10 border border-white/10 p-3"><div className="text-2xl font-semibold">{addons.filter(a => a.enabled).length}</div><div className="text-xs opacity-65">Enabled</div></div><div className="rounded-xl bg-black/10 border border-white/10 p-3"><div className="text-2xl font-semibold">{pages.length}</div><div className="text-xs opacity-65">Your pages</div></div></div>
    </div>
    <div className="flex flex-wrap gap-2 mb-5">{[['discover','Discover'],['installed','Installed'],['pages','My pages']].map(([id,label]) => <button key={id} onClick={() => setTab(id)} className={`rounded-xl px-4 py-2.5 text-sm transition ${tab===id?'bg-emerald-300 text-emerald-950 font-semibold':'bg-white/[0.045] border border-white/10 hover:bg-white/10'}`}>{label}</button>)}<div className="flex-1"/><button onClick={() => fileRef.current?.click()} className="rounded-xl border border-white/10 bg-white/[0.045] px-4 py-2.5 text-sm inline-flex items-center gap-2 hover:bg-white/10"><Upload size={15}/> Upload addon</button><input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => uploadFile(e.target.files?.[0])}/></div>
    {notice && <div className="mb-4 rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-300"/>{notice}<button className="ml-auto opacity-60 hover:opacity-100" onClick={() => setNotice('')} aria-label="Dismiss"><X size={15}/></button></div>}
    {error && <div className="mb-4 rounded-xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm flex items-center gap-2"><AlertTriangle size={16}/>{error}</div>}
    {tab === 'discover' && <div className="grid md:grid-cols-2 gap-4">
      {[{icon:Palette,title:'Custom Matcha Pages',tag:'PERSONALIZATION',desc:'Create your own matcha:// pages with your own colors, title, and content.',action:()=>{setShowCreate(true);setError('');}},{icon:ShieldCheck,title:'Privacy & content filters',tag:'CAPABILITY API · PREVIEW',desc:'A planned permission-based API for request filtering. This build stores addon manifests but does not execute blocking rules.',action:()=>setTab('installed')},{icon:Network,title:'Proxy integrations',tag:'CAPABILITY API · PREVIEW',desc:'A safe integration point for supported proxy configurations. A proxy is not automatically a full VPN.',action:()=>setTab('installed')},{icon:Code2,title:'Developer manifests',tag:'DEVELOPER TOOLS',desc:'Upload a small JSON manifest to register addon metadata and request explicit capabilities.',action:()=>fileRef.current?.click()}].map((item) => <Card key={item.title} className="p-5 md:p-6"><div className="flex gap-4"><div className="h-11 w-11 rounded-xl bg-emerald-300/10 border border-emerald-200/10 flex items-center justify-center text-emerald-200 shrink-0"><item.icon size={20}/></div><div className="min-w-0 flex-1"><div className="text-[10px] tracking-[.15em] opacity-50 font-semibold">{item.tag}</div><h3 className="mt-1 text-lg font-semibold">{item.title}</h3><p className="mt-2 text-sm opacity-65 leading-relaxed">{item.desc}</p><button onClick={item.action} className="mt-4 text-sm font-medium text-emerald-200 inline-flex items-center gap-1.5 hover:text-emerald-100">Explore <ExternalLink size={13}/></button></div></div></Card>)}
      <Card className="md:col-span-2 p-5 flex gap-3 items-start"><ShieldCheck size={19} className="text-emerald-200 mt-0.5 shrink-0"/><div><div className="font-medium">Designed with permissions, not blind trust.</div><p className="mt-1 text-sm opacity-65">Uploaded manifests are treated as data. This build does not run arbitrary JavaScript or native binaries from uploaded addons. Real network filtering, proxy control, and audio processing require dedicated browser/native APIs before they can safely become functional.</p></div></Card>
    </div>}
    {tab === 'installed' && <div><div className="relative mb-4"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-45"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search installed addons..." className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-3 pl-10 pr-4 outline-none focus:border-emerald-300/40"/></div>{filtered.length===0 ? <Card className="p-9 text-center"><Puzzle size={28} className="mx-auto opacity-45"/><h3 className="mt-3 font-semibold">No addons here yet</h3><p className="mt-1 text-sm opacity-60">Upload a JSON manifest to add one to your library.</p></Card> : <div className="space-y-3">{filtered.map(a=><Card key={a.id} className="p-4 md:p-5"><div className="flex flex-col gap-4 md:flex-row md:items-center"><div className="h-11 w-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0"><Puzzle size={19}/></div><div className="flex-1 min-w-0"><div className="flex flex-wrap gap-2 items-center"><h3 className="font-semibold">{a.name}</h3><span className="text-[10px] rounded-full px-2 py-1 bg-white/5 opacity-65">v{a.version}</span><span className={`text-[10px] rounded-full px-2 py-1 ${a.enabled?'bg-emerald-300/15 text-emerald-200':'bg-white/5 opacity-60'}`}>{a.enabled?'Enabled':'Disabled'}</span></div><p className="text-sm opacity-60 mt-1">{a.description}</p><div className="text-xs opacity-45 mt-2">Requests: {a.requestedCapabilities.length ? a.requestedCapabilities.map(id=>CAPABILITIES.find(c=>c.id===id)?.label||id).join(', ') : 'No special capabilities'} · Source: {a.source}</div></div><div className="flex gap-2"><button onClick={()=>toggleAddon(a)} className="rounded-lg border border-white/10 px-3 py-2 text-sm inline-flex items-center gap-2 hover:bg-white/10"><Power size={14}/>{a.enabled?'Disable':'Enable'}</button><button onClick={()=>{if(window.confirm(`Remove ${a.name} from Matcha?`))setAddons(current=>current.filter(x=>x.id!==a.id));}} className="rounded-lg border border-red-300/15 px-3 py-2 text-sm text-red-200 hover:bg-red-400/10" aria-label={`Remove ${a.name}`}><Trash2 size={15}/></button></div></div>{a.grantedCapabilities?.length>0&&<div className="mt-3 border-t border-white/10 pt-3 text-xs opacity-60 flex items-center gap-2"><ShieldCheck size={14}/> Granted: {a.grantedCapabilities.map(id=>CAPABILITIES.find(c=>c.id===id)?.label||id).join(', ')}</div>}</Card>)}</div>}</div>}
    {tab === 'pages' && <div>{pages.length===0?<Card className="p-9 text-center"><Palette size={28} className="mx-auto opacity-45"/><h3 className="mt-3 font-semibold">Your canvas is empty</h3><p className="mt-1 text-sm opacity-60">Create a custom page and give it its own matcha:// address.</p><button onClick={()=>setShowCreate(true)} className="mt-4 rounded-xl bg-emerald-300 px-4 py-2.5 text-sm font-semibold text-emerald-950">Create your first page</button></Card>:<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{pages.map(p=><Card key={p.id} className="overflow-hidden"><div style={{background:`linear-gradient(135deg, ${p.color}35, transparent)`}} className="p-5"><div style={{background:p.color}} className="h-2 w-12 rounded-full mb-4"/><h3 className="font-semibold text-lg">{p.name}</h3><p className="text-sm opacity-60 mt-1 line-clamp-2">{p.subtitle}</p></div><div className="px-5 py-4 border-t border-white/10"><code className="text-xs opacity-65">matcha://{p.slug}</code><div className="mt-4 flex gap-2"><button onClick={()=>onOpenPage?.(p.slug)} className="flex-1 rounded-lg bg-emerald-300 px-3 py-2 text-sm font-semibold text-emerald-950">Open page</button><button onClick={()=>{if(window.confirm(`Delete matcha://${p.slug}?`))setPages(current=>current.filter(x=>x.id!==p.id));}} className="rounded-lg border border-white/10 px-3 py-2 hover:bg-white/10" aria-label={`Delete ${p.name}`}><Trash2 size={15}/></button></div></div></Card>)}</div>}</div>}
    {showCreate && <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md p-4" onMouseDown={e=>{if(e.target===e.currentTarget)setShowCreate(false)}}><div className="w-full max-w-lg rounded-3xl border border-white/15 bg-[#15221d] p-6 shadow-2xl"><div className="flex items-center justify-between"><div><div className="text-xs tracking-widest text-emerald-200/70">PAGE BUILDER</div><h2 className="text-2xl font-semibold mt-1">Create a Matcha page</h2></div><button onClick={()=>setShowCreate(false)} className="rounded-lg p-2 hover:bg-white/10" aria-label="Close"><X size={18}/></button></div><p className="text-sm opacity-60 mt-2">Your page uses Matcha's shell and can be opened by its custom address.</p><div className="mt-5 space-y-4"><label className="block text-sm">Page name<input value={pageName} onChange={e=>setPageName(e.target.value)} maxLength={60} className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 outline-none focus:border-emerald-300/50"/></label><div className="text-xs opacity-55 -mt-2">Address preview: <code>matcha://{slugify(pageName)}</code></div><label className="block text-sm">Subtitle<input value={pageSubtitle} onChange={e=>setPageSubtitle(e.target.value)} maxLength={160} className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 outline-none focus:border-emerald-300/50"/></label><label className="block text-sm">Accent color<div className="mt-1.5 flex gap-3 items-center"><input type="color" value={pageColor} onChange={e=>setPageColor(e.target.value)} className="h-10 w-14 rounded-lg bg-transparent border-0"/><span className="text-xs opacity-60">{pageColor}</span></div></label><label className="block text-sm">Page content<textarea value={pageContent} onChange={e=>setPageContent(e.target.value)} maxLength={5000} rows={4} className="mt-1.5 w-full resize-y rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 outline-none focus:border-emerald-300/50"/></label></div><div className="flex justify-end gap-2 mt-6"><button onClick={()=>setShowCreate(false)} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm">Cancel</button><button onClick={createPage} className="rounded-xl bg-emerald-300 px-4 py-2.5 text-sm font-semibold text-emerald-950">Create page</button></div></div></div>}
  </div>;
}

export function CustomMatchaPage({ slug }) {
  const page = getMatchaCustomPages().find((p) => p.slug === slug);
  if (!page) return <div className="mx-auto max-w-3xl p-10"><h1 className="text-3xl font-semibold">Page not found</h1><p className="mt-2 opacity-65">No custom page exists at matcha://{slug}.</p></div>;
  return <div className="mx-auto max-w-4xl p-6 md:p-10"><div className="rounded-[28px] border border-white/10 bg-white/[0.04] backdrop-blur-2xl overflow-hidden"><div style={{background:`linear-gradient(135deg, ${page.color}30, transparent)`}} className="p-7 md:p-10"><div style={{background:page.color}} className="h-1.5 w-16 rounded-full mb-6"/><div className="text-xs uppercase tracking-[.18em] opacity-50">YOUR MATCHA SPACE</div><h1 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight">{page.name}</h1><p className="mt-3 text-base opacity-65">{page.subtitle}</p></div><div className="px-7 py-8 md:px-10 md:py-10"><p className="whitespace-pre-wrap break-words leading-7">{page.content}</p><div className="mt-8 border-t border-white/10 pt-4 text-xs opacity-40">Created in Matcha Addons · matcha://{page.slug}</div></div></div></div>;
}
