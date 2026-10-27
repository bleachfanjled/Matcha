import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Sparkles, ArrowUp, ArrowLeft } from 'lucide-react';

// AI Mode — a conversational chat view that follows up on the original search.
// Replies stream in live; messages render as plain text (no bubbles).
export default function AIMode({ query, chat, chatLoading, streaming, onSend, onBack }) {
  const [text, setText] = useState('');
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [chat, chatLoading, streaming]);

  const submit = (e) => {
    e.preventDefault();
    if (!text.trim() || chatLoading || streaming) return;
    onSend(text);
    setText('');
  };

  return (
    <div className="aimode">
      <div className="aimode-head">
        <button className="aimode-back" onClick={onBack}><ArrowLeft size={15} /> Back to results</button>
        <span className="aimode-title"><Sparkles size={14} /> AI Mode</span>
      </div>

      <div className="aimode-thread frost-scroll" ref={scrollRef}>
        {chat.length === 0 && (
          <div className="aimode-greet">
            <div className="aimode-greet-icon"><Sparkles size={22} /></div>
            <p>Ask anything about <strong>{query}</strong></p>
            <p className="aimode-hint">Follow-ups, explanations, examples — I can use the web.</p>
          </div>
        )}
        {chat.map((m, i) => {
          const isLast = i === chat.length - 1;
          const showCursor = streaming && isLast && m.role === 'assistant';
          return (
            <div key={i} className={`chat-msg ${m.role}`}>
              <div className="chat-role">{m.role === 'user' ? 'You' : 'Matcha Air'}</div>
              <div className="chat-text">
                {m.role === 'assistant'
                  ? <><ReactMarkdown>{m.content}</ReactMarkdown>{showCursor && <span className="chat-cursor" />}</>
                  : m.content}
              </div>
            </div>
          );
        })}
        {chatLoading && (
          <div className="chat-msg assistant">
            <div className="chat-role">Matcha Air</div>
            <div className="aimode-typing"><span /><span /><span /></div>
          </div>
        )}
      </div>

      <form className="aimode-input" onSubmit={submit}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask anything" spellCheck={false} />
        <button type="submit" disabled={!text.trim() || chatLoading || streaming} aria-label="Send"><ArrowUp size={16} /></button>
      </form>
    </div>
  );
}
