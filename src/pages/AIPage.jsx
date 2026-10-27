import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import MathMarkdown from '@/components/MathMarkdown';
import { aiChatStore } from '@/lib/aiChatStore';
import { base44 } from '@/api/base44Client';
import { streamReply } from '@/lib/streamReply';
import { requestError } from '@/lib/requestError';
import { Sparkles, ArrowUp, Plus, X, FileText, FileImage, Film, ChevronDown, Mic, Star, Image as ImageIcon, Download, Pencil, LoaderCircle } from 'lucide-react';
import { getUsage, addTokens, estimateTokens, getMsUntilReset, TOKEN_LIMIT } from '@/lib/tokenBudget';
import { uploadPrivateFile } from '@/lib/uploadPrivateFile';

// matcha://ai — Onyx-style AI assistant: model selector, centered greeting,
// suggestion pills, and a bottom input bar with +files, mic, and auto model routing.

const MODELS = [
  { id: 'auto', label: 'Auto (by task)' },
  { id: 'gemini_3_flash', label: 'Gemini 3 Flash' },
  { id: 'gpt_5_mini', label: 'GPT-5 Mini' },
  { id: 'gpt_5_4', label: 'GPT-5.4' },
  { id: 'gpt_5_6_luna', label: 'GPT-5.6 Luna' },
  { id: 'gpt_5_6_sol', label: 'GPT-5.6 Sol' },
  { id: 'gemini_3_1_pro', label: 'Gemini 3.1 Pro' },
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
  { id: 'claude_opus_5', label: 'Claude Opus 5' },
];

const SUGGESTIONS = ['Create an image', 'Write an essay', 'Summarize this', 'Help me code', 'Plan my day'];

const modelLabel = (id) => MODELS.find((m) => m.id === id)?.label || id;

function readableSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return 'size unknown';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function readableDuration(seconds) {
  const value = Math.max(0, Math.round(seconds || 0));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}

async function readMediaMetadata(file) {
  const mime = file.type || '';
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  const isVideo = mime.startsWith('video/') || ['mp4', 'mov', 'webm', 'm4v', 'avi', 'mkv'].includes(extension);
  const isImage = mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(extension);
  const isAudio = mime.startsWith('audio/') || ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'].includes(extension);
  const kind = isVideo ? 'video' : isImage ? 'image' : isAudio ? 'audio' : 'file';
  let details = `${mime || extension.toUpperCase() || 'File'} · ${readableSize(file.size)}`;
  let frameEstimate = null;

  try {
    if (isImage && typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(file);
      details = `Photo · ${bitmap.width} × ${bitmap.height} px · ${readableSize(file.size)}`;
      bitmap.close();
    } else if (isVideo || isAudio) {
      const url = URL.createObjectURL(file);
      const media = document.createElement(isVideo ? 'video' : 'audio');
      media.preload = 'metadata';
      const metadata = await new Promise((resolve) => {
        const timeout = setTimeout(() => resolve(null), 8000);
        media.onloadedmetadata = () => { clearTimeout(timeout); resolve(media); };
        media.onerror = () => { clearTimeout(timeout); resolve(null); };
        media.src = url;
      });
      if (metadata) {
        if (isVideo) {
          frameEstimate = Number.isFinite(metadata.duration) ? Math.max(1, Math.round(metadata.duration * 30)) : null;
          const duration = Number.isFinite(metadata.duration) ? readableDuration(metadata.duration) : 'duration unknown';
          details = `Video · ${duration} · ${metadata.videoWidth} × ${metadata.videoHeight} px${frameEstimate ? ` · about ${frameEstimate.toLocaleString()} frames at 30 fps (estimate)` : ''} · ${readableSize(file.size)}`;
        } else details = `Audio · ${Number.isFinite(metadata.duration) ? readableDuration(metadata.duration) : 'duration unknown'} · ${readableSize(file.size)}`;
      } else details = `${isVideo ? 'Video' : 'Audio'} · metadata unavailable · ${readableSize(file.size)}`;
      media.removeAttribute('src');
      media.load();
      URL.revokeObjectURL(url);
    } else if (extension === 'pdf' || mime === 'application/pdf') {
      details = `PDF document · ${readableSize(file.size)}`;
    } else if (file.type) details = `${file.type} · ${readableSize(file.size)}`;
  } catch {
    details = `${isVideo ? 'Video' : isImage ? 'Photo' : isAudio ? 'Audio' : 'File'} · metadata unavailable · ${readableSize(file.size)}`;
  }
  return { kind, mimeType: mime, details, frameEstimate };
}

export default function AIPage() {
  const messages = useSyncExternalStore(aiChatStore.subscribe, aiChatStore.getMessages);
  const setMessages = aiChatStore.setMessages;
  const saveChats = useSyncExternalStore(aiChatStore.subscribe, aiChatStore.getSaveChats);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [files, setFiles] = useState([]);
  const [selectedModel, setSelectedModel] = useState('auto');
  const [lastUsedModel, setLastUsedModel] = useState('');
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [used, setUsed] = useState(() => getUsage());
  const [genStatus, setGenStatus] = useState('');
  const [resetIn, setResetIn] = useState(0);
  const overLimit = used >= TOKEN_LIMIT;
  const uploadsPending = files.some((file) => file.uploading);
  const uploadsFailed = files.some((file) => file.error);
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const streamCancel = useRef(null);
  const recRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading, streaming, files]);

  useEffect(() => () => { if (streamCancel.current) streamCancel.current(); }, []);

  useEffect(() => {
    if (!overLimit) { setResetIn(0); return; }
    const tick = () => setResetIn(getMsUntilReset());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [overLimit, used]);

  const fmtMs = (ms) => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    if (h) return `${h}h ${m}m`;
    if (m) return `${m}m ${sec}s`;
    return `${sec}s`;
  };

  const pickFiles = async (list) => {
    if (fileInputRef.current) fileInputRef.current.value = '';
    const selected = Array.from(list || []);
    const staged = selected.map((file, index) => {
      const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
      return { id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`, uri: null, name: file.name, preview, isImage: !!preview, kind: 'file', metadata: 'Reading file details…', progress: 0, stage: 'inspecting', uploading: true, error: '' };
    });
    if (!staged.length) return;
    setFiles((current) => [...current, ...staged]);
    await Promise.all(staged.map(async (item, index) => {
      const file = selected[index];
      try {
        const media = await readMediaMetadata(file);
        setFiles((current) => current.map((entry) => entry.id === item.id ? { ...entry, ...media, stage: 'uploading' } : entry));
        const { file_uri } = await uploadPrivateFile(file, (progress) => {
          setFiles((current) => current.map((entry) => entry.id === item.id ? { ...entry, progress } : entry));
        });
        if (!file_uri) throw new Error('The upload did not return a file.');
        setFiles((current) => current.map((entry) => entry.id === item.id ? { ...entry, uri: file_uri, progress: 100, stage: 'ready', uploading: false } : entry));
      } catch (failure) {
        setFiles((current) => current.map((entry) => entry.id === item.id ? { ...entry, uploading: false, stage: 'error', error: failure?.message || 'Upload failed — remove and try again' } : entry));
      }
    }));
  };

  const removeFile = (idx) => {
    setFiles((f) => {
      const item = f[idx];
      if (item?.preview) URL.revokeObjectURL(item.preview);
      return f.filter((_, i) => i !== idx);
    });
  };

  const toggleMic = () => {
    if (listening) { recRef.current?.stop(); setListening(false); return; }
    const speechWindow = /** @type {any} */ (window);
    const SR = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = 'en-US'; rec.interimResults = true; rec.continuous = false;
    rec.onresult = (e) => { setInput(Array.from(e.results).map((r) => r[0].transcript).join('')); };
    rec.onend = () => setListening(false);
    rec.start();
    setListening(true);
    recRef.current = rec;
  };

  const isImageRequest = (text) => /\b(create|generate|draw|make|design|render)\b[\s\S]{0,40}\b(image|picture|pic|drawing|illustration|logo|wallpaper|art)\b/i.test(text || '');

  const send = async (text) => {
    const t = text.trim();
    if ((!t && files.length === 0) || loading || streaming || overLimit || uploadsPending || uploadsFailed) return;
    const attachments = files.map(({ name, kind, metadata }) => ({ name, kind, metadata }));
    const user = { role: 'user', content: t || '(attached file)', attachments };
    const base = [...messages, user];
    setMessages(base);
    setInput('');
    setLoading(true);
    const containsVideo = files.some((file) => file.kind === 'video');
    const containsPhoto = files.some((file) => file.kind === 'image');
    const containsOther = files.some((file) => !['video', 'image'].includes(file.kind));
    setGenStatus(files.length
      ? containsVideo ? 'Reviewing video and its estimated frame count…'
        : containsPhoto && containsOther ? 'Analyzing photos and reading attachment details…'
          : containsPhoto ? 'Analyzing photo dimensions and image content…'
            : 'Reading attachment details and analyzing your files…'
      : '');

    // Image generation: silently switch to the image model and show a
    // generating state while the picture renders.
    if (isImageRequest(t) && files.length === 0) {
      setGenStatus('Generating image…');
      try {
        const res = await base44.functions.invoke('generateImage', { prompt: t });
        const url = res.data?.url;
        addTokens(2000); setUsed(getUsage());
        setMessages([...base, { role: 'assistant', content: '', image: url, model: 'Image Gen', task: 'image', prompt: t }]);
      } catch {
        setMessages([...base, { role: 'assistant', content: 'I could not generate that image right now.' }]);
      }
      setLoading(false); setGenStatus('');
      return;
    }

    const payload = { messages: base, query: '', files: files.map((f) => ({ uri: f.uri, name: f.name, kind: f.kind, metadata: f.metadata, frameEstimate: f.frameEstimate })), model: selectedModel };
    try {
      const res = await base44.functions.invoke('aiChat', payload);
      const full = res.data?.reply;
      if (typeof full !== 'string' || !full.trim()) throw new Error(res.data?.error || 'The assistant returned an empty reply.');
      const model = res.data.model;
      const task = res.data.task;
      setLastUsedModel(model);
      addTokens(estimateTokens(JSON.stringify(base)) + estimateTokens(full)); setUsed(getUsage());
      setMessages([...base, { role: 'assistant', content: '', model, task }]);
      setLoading(false);
      setGenStatus('');
      setStreaming(true);
      if (streamCancel.current) streamCancel.current();
      streamCancel.current = streamReply(full, (partial) => {
        setMessages((prev) => {
          const copy = prev.slice();
          copy[copy.length - 1] = { ...copy[copy.length - 1], content: partial };
          return copy;
        });
      }, () => setStreaming(false));
    } catch (error) {
      setMessages([...base, { role: 'assistant', content: requestError(error) }]);
      setLoading(false);
      setGenStatus('');
    }
    files.forEach((f) => f.preview && URL.revokeObjectURL(f.preview));
    setFiles([]);
  };

  const pillLabel = selectedModel === 'auto' ? 'Auto' : modelLabel(selectedModel);
  const statusText = selectedModel === 'auto'
    ? (lastUsedModel ? 'Auto → ' + modelLabel(lastUsedModel) : 'Auto')
    : modelLabel(selectedModel);

  return (
    <div className="onyx-ai">
      <div className="onyx-topbar">
        <div className={`onyx-token-badge ${overLimit ? 'onyx-token-over' : ''}`} title="AI token usage today">
          <ImageIcon size={12} /> {used.toLocaleString()}/25,000
        </div>
        <div className="onyx-model-wrap">
          <button className="onyx-model-pill" onClick={() => setModelMenuOpen((v) => !v)}>
            {pillLabel} <ChevronDown size={15} />
          </button>
          {modelMenuOpen && (
            <>
              <div className="ctx-backdrop" onClick={() => setModelMenuOpen(false)} />
              <div className="onyx-model-menu glass-panel">
                <div className="ctx-head">Model</div>
                {MODELS.map((m) => (
                  <button key={m.id} className={`translate-item ${selectedModel === m.id ? 'translate-item-active' : ''}`} onClick={() => { setSelectedModel(m.id); setModelMenuOpen(false); }}>
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="ai-save-row">
          <button type="button" className="onyx-suggestion" onClick={() => aiChatStore.clear()} disabled={messages.length === 0 && !loading && !streaming} title="Start a new chat">
            <Plus size={13} /> New chat
          </button>
          <span className="ai-save-label" title={saveChats ? 'Chats are saved on this device' : 'Chats are not saved — cleared when Matcha Air closes'}>Save chats</span>
          <div
            className={`toggle-switch ${saveChats ? 'toggle-on' : ''}`}
            role="switch"
            aria-checked={saveChats}
            tabIndex={0}
            onClick={() => aiChatStore.setSaveChats(!saveChats)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); aiChatStore.setSaveChats(!saveChats); } }}
            title={saveChats ? 'Chats are saved on this device' : 'Chats are not saved — cleared when Matcha Air closes'}
          >
            <span className="toggle-knob" />
          </div>
        </div>
      </div>

      <div className="onyx-center">
        {messages.length === 0 && !loading ? (
          <div className="onyx-greet">
            <div className="onyx-logo"><Sparkles size={30} /></div>
            <h1 className="onyx-heading">What are we doing today?</h1>
            <p className="onyx-sub">Ask me anything — I'm here to assist.</p>
            <div className="onyx-suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="onyx-suggestion" onClick={() => setInput(s)}>{s}</button>
              ))}
            </div>
          </div>
        ) : (
          <div className="onyx-thread frost-scroll" ref={scrollRef}>
            {messages.map((m, i) => {
              const isLast = i === messages.length - 1;
              const showCursor = streaming && isLast && m.role === 'assistant';
              if (m.role === 'user') {
                return (
                  <div key={i} className="chat-msg user">
                  <div className="chat-bubble-user">
                    {m.content}
                    {!!m.attachments?.length && <div className="chat-message-attachments">{m.attachments.map((attachment, attachmentIndex) => (
                      <div className="chat-message-attachment" key={`${attachment.name}:${attachmentIndex}`}>
                        {attachment.kind === 'video' ? <Film size={15} /> : attachment.kind === 'image' ? <FileImage size={15} /> : <FileText size={15} />}
                        <span><strong>{attachment.name}</strong><small>{attachment.metadata}</small></span>
                      </div>
                    ))}</div>}
                  </div>
                  </div>
                );
              }
              return (
                <div key={i} className="chat-msg assistant">
                  <div className="chat-role">
                    Matcha Air
                    {m.model && <span className="ai-model-badge">{m.task || 'auto'} · {m.model}</span>}
                  </div>
                  <div className="chat-text">
                    {m.image ? (
                      <div className="chat-image-wrap">
                        <img src={m.image} alt="Generated" className="chat-image" />
                        <div className="chat-image-actions">
                          <a href={m.image} download="matcha-air-image.png" className="chat-img-btn"><Download size={14} /> Download</a>
                          <button className="chat-img-btn" onClick={() => setInput(m.prompt || '')}><Pencil size={14} /> Edit</button>
                        </div>
                      </div>
                    ) : <><MathMarkdown>{m.content}</MathMarkdown>{showCursor && <span className="chat-cursor" />}</>}
                  </div>
                </div>
              );
            })}
            {loading && (
              <div className="chat-msg assistant">
                <div className="chat-role">Matcha Air</div>
                {genStatus ? <div className="ai-analysis-note" role="status"><LoaderCircle size={15} className="ai-analysis-spinner" /><span>{genStatus}</span></div> : <div className="aimode-typing"><span /><span /><span /></div>}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="onyx-input-area">
        <div className="onyx-status">
          {overLimit ? (
            <span style={{ color: '#ff6b6b' }}>Daily limit reached — try again in {fmtMs(resetIn)}</span>
          ) : uploadsPending ? (
            <span role="status" aria-live="polite">Uploading attachments…</span>
          ) : uploadsFailed ? (
            <span role="alert" style={{ color: '#ff8c9c' }}>Remove failed attachments before sending.</span>
          ) : genStatus ? (
            <>
              <div className="ai-gen-shimmer" />
              <span style={{ color: 'var(--accent)' }}>{genStatus}</span>
            </>
          ) : (
            <>
              <Star size={12} style={{ color: 'var(--accent)' }} />
              <span>{statusText}</span>
              <span>· auto-checking may add a moment</span>
            </>
          )}
        </div>
        <form className="onyx-input" onSubmit={(e) => { e.preventDefault(); send(input); }}>
          <input ref={fileInputRef} type="file" multiple hidden onChange={(e) => pickFiles(e.target.files)} />
          {files.length > 0 && <div className="ai-files-row onyx-input-files">
            {files.map((f, i) => {
              const Icon = f.kind === 'video' ? Film : f.kind === 'image' ? FileImage : FileText;
              return <div key={f.id || i} className={`ai-file-chip ${f.error ? 'ai-file-chip-error' : ''}`} title={f.error || f.metadata || f.name}>
                {f.isImage ? <img src={f.preview} alt="" /> : <Icon size={15} />}
                <span className="ai-file-copy"><strong>{f.name}</strong><small>{f.error || f.metadata}</small></span>
                {f.uploading ? <span className="ai-file-progress" role="status" aria-label={`Upload ${f.progress}%`}><span>{f.stage === 'inspecting' ? 'Reading' : `${f.progress}%`}</span><i><b style={{ width: `${f.stage === 'inspecting' ? 12 : f.progress}%` }} /></i></span> : f.error ? <span className="ai-file-error" role="status">Failed</span> : <span className="ai-file-ready">Ready</span>}
                <button type="button" onClick={() => removeFile(i)} aria-label={`Remove ${f.name}`}><X size={12} /></button>
              </div>;
            })}
          </div>}
          <button type="button" className="ai-attach-btn" onClick={() => fileInputRef.current?.click()} title="Attach files" aria-label="Attach files"><Plus size={16} /></button>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask Anything" />
          <button type="button" className={`onyx-mic ${listening ? 'onyx-mic-on' : ''}`} onClick={toggleMic} title="Voice input" aria-label="Voice input"><Mic size={17} /></button>
          <button type="submit" disabled={(!input.trim() && files.length === 0) || loading || streaming || overLimit || uploadsPending || uploadsFailed} aria-label="Send"><ArrowUp size={16} /></button>
        </form>
      </div>
    </div>
  );
}
