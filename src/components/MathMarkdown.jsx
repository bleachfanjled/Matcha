import React from 'react';
import ReactMarkdown from 'react-markdown';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// Renders markdown with embedded LaTeX math ($...$ inline, $$...$$ block).
// KaTeX is called directly to avoid CommonJS plugin bundling issues.
export default function MathMarkdown({ children }) {
  const text = String(children || '');

  // Split into segments: block math ($$...$$), inline math ($...$), and plain text.
  const segments = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Block math $$...$$
    const blockMatch = remaining.match(/^\$\$([\s\S]*?)\$\$/);
    if (blockMatch) {
      segments.push({ type: 'block', math: blockMatch[1], key: key++ });
      remaining = remaining.slice(blockMatch[0].length);
      continue;
    }
    // Inline math $...$
    const inlineMatch = remaining.match(/^\$([^\$\n]+?)\$/);
    if (inlineMatch) {
      segments.push({ type: 'inline', math: inlineMatch[1], key: key++ });
      remaining = remaining.slice(inlineMatch[0].length);
      continue;
    }
    // Plain text up to the next $ delimiter
    const nextDollar = remaining.indexOf('$');
    if (nextDollar === -1) {
      segments.push({ type: 'text', text: remaining, key: key++ });
      break;
    }
    // Streaming replies and currency can contain an unmatched dollar sign.
    // Always consume a character so an incomplete equation cannot freeze the UI.
    const consumed = nextDollar === 0 ? 1 : nextDollar;
    segments.push({ type: 'text', text: remaining.slice(0, consumed), key: key++ });
    remaining = remaining.slice(consumed);
  }

  return (
    <>
      {segments.map((seg) => {
        if (seg.type === 'text') {
          return <ReactMarkdown key={seg.key}>{seg.text}</ReactMarkdown>;
        }
        let html = '';
        try {
          html = katex.renderToString(seg.math, {
            displayMode: seg.type === 'block',
            throwOnError: false,
            errorColor: '#ff6b6b',
          });
        } catch {
          return <span key={seg.key}>{seg.type === 'block' ? `$$${seg.math}$$` : `$${seg.math}$`}</span>;
        }
        return (
          <span
            key={seg.key}
            className={seg.type === 'block' ? 'math-block' : 'math-inline'}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      })}
    </>
  );
}