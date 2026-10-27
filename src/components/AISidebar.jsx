import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import SnowCapped from '@/components/SnowCapped';
import { base44 } from '@/api/base44Client';
import { streamReply } from '@/lib/streamReply';
import { Aperture, Send, Sparkles, X } from 'lucide-react';

export default function AISidebar({ result, onClose }) {
  const [messages, setMessages] = useState([]);
  const [follow, setFollow] = useState('');
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef(null);
  const streamCancel = useRef(null);
  const imageUrl = result?.image_url;
  const analyzing = !!result?.analyzing;
  const lensStyle = { '--lens-accent': 'var(--accent)', '--lens-accent-alt': 'var(--matcha-glow, var(--accent))' };

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading, streaming]);

  useEffect(() => () => streamCancel.current?.(), []);

  useEffect(() => {
    if (result?.error) {
      setMessages((current) => current.length ? current : [{ role: 'assistant', content: `I couldn't analyze that selection: ${result.error}` }]);
      return;
    }
    if (!result?.reply) return;
    const thread = [
      { role: 'user', content: 'Analyze this capture.' },
      { role: 'assistant', content: '' },
    ];
    setMessages(thread);
    setStreaming(true);
    streamCancel.current?.();
    streamCancel.current = streamReply(result.reply, (partial) => {
      setMessages((current) => {
        const next = current.slice();
        if (next.at(-1)?.role === 'assistant') next[next.length - 1] = { ...next.at(-1), content: partial };
        return next;
      });
    }, () => setStreaming(false));
  }, [result?.reply, result?.error]);

  const sendFollow = async (event) => {
    event.preventDefault();
    const content = follow.trim();
    if (!content || loading || streaming || analyzing) return;
    setFollow('');
    setLoading(true);
    setMessages((current) => [...current, { role: 'user', content }]);
    try {
      const response = await base44.functions.invoke('visionSolve', {
        image_url: imageUrl,
        prompt: content,
        conversation: messages.map(({ role, content: message }) => ({ role, content: message })),
      });
      if (response.data?.error) throw new Error(response.data.error);
      const text = String(response.data?.reply || '').trim();
      if (!text) throw new Error('The Lens response was empty.');
      setLoading(false);
      setStreaming(true);
      setMessages((current) => [...current, { role: 'assistant', content: '' }]);
      streamCancel.current?.();
      streamCancel.current = streamReply(text, (partial) => {
        setMessages((current) => {
          const next = current.slice();
          if (next.at(-1)?.role === 'assistant') next[next.length - 1] = { ...next.at(-1), content: partial };
          return next;
        });
      }, () => setStreaming(false));
    } catch (failure) {
      const message = failure?.message || 'Failed to respond.';
      setLoading(false);
      setMessages((current) => [...current, { role: 'assistant', content: `I couldn't answer that follow-up: ${message}` }]);
    }
  };

  return (
    <aside className="ai-sidebar glass-panel" style={lensStyle}>
      <SnowCapped capHeight={6} className="rounded-2xl" style={{}}>
        <div className="ai-sidebar-head">
          <div className="ai-sidebar-title"><span className="lens-title-icon"><Aperture size={16} /></span> Matcha Lens</div>
          <div className="lens-head-actions">
            <button className="ai-sidebar-close" onClick={onClose} aria-label="Close Matcha Lens"><X size={16} /></button>
          </div>
        </div>
      </SnowCapped>

      {imageUrl && (
        <div className="ai-sidebar-image"><img src={imageUrl} alt="Selected screen area" /></div>
      )}
      {result?.size && <div className="lens-capture-meta">Captured area · {result.size} px</div>}

      <div className="ai-sidebar-body frost-scroll" ref={scrollRef} aria-live="polite">
        {analyzing && messages.length === 0 ? (
          <div className="ai-sidebar-analyzing"><div className="ai-gen-shimmer" /><span>Reading your selected area…</span></div>
        ) : messages.length === 0 ? (
          <div className="lens-empty"><Sparkles size={20} /><span>Select a screen area to start a Lens conversation.</span></div>
        ) : messages.map((message, index) => (
          <div className={`lens-message lens-message-${message.role}`} key={`${index}:${message.role}`}>
            <div className="lens-message-role">{message.role === 'user' ? 'You' : 'Matcha Lens'}</div>
            {message.role === 'assistant' && !message.content && (loading || streaming) ? (
              <div className="aimode-typing"><span /><span /><span /></div>
            ) : message.role === 'user' ? (
              <div className="lens-message-user">{message.content}</div>
            ) : (
              <div className="chat-text"><ReactMarkdown>{message.content}</ReactMarkdown>{streaming && index === messages.length - 1 && <span className="chat-cursor" />}</div>
            )}
          </div>
        ))}
        {analyzing && messages.length > 0 && <div className="ai-sidebar-analyzing"><div className="ai-gen-shimmer" /><span>Analyzing capture…</span></div>}
      </div>

      <form className="ai-sidebar-input" onSubmit={sendFollow}>
        <input value={follow} onChange={(event) => setFollow(event.target.value)} placeholder={analyzing ? 'Analyzing…' : 'Ask a follow-up about this image'} spellCheck={false} disabled={analyzing || loading || streaming} />
        <button type="submit" disabled={analyzing || !follow.trim() || loading || streaming} aria-label="Send follow-up"><Send size={15} /></button>
      </form>
    </aside>
  );
}
