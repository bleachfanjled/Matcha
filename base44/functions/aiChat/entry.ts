import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// AI Assistant — conversational chat that auto-routes the model by task type
// (coding / math / vision / general), with an optional manual model override,
// and accepts private file attachments.
export default async function aiChat(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const query = typeof body.query === 'string' ? body.query.trim() : '';
    const files = Array.isArray(body.files) ? body.files : [];
    const override = typeof body.model === 'string' && body.model !== 'auto' ? body.model : null;
    if (!messages.length) return Response.json({ error: 'Messages required' }, { status: 400 });

    const base44 = createClientFromRequest(req);

    const hasVisualMedia = files.some((f) => f.kind === 'image' || f.kind === 'video' || /\.(png|jpe?g|webp|gif|bmp|svg|mp4|mov|webm|m4v|avi|mkv)$/i.test(f.name || ''));
    const task = override ? 'manual' : classifyTask(messages, hasVisualMedia);
    const model = override || MODEL_FOR_TASK[task];

    // Sign private file URIs so the model can fetch their contents.
    const fileUrls = [];
    for (const f of files) {
      if (!f.uri) continue;
      try {
        const { signed_url } = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({ file_uri: f.uri });
        if (signed_url) fileUrls.push(signed_url);
      } catch { /* skip unreadable file */ }
    }

    const convo = messages
      .map((m) => (m.role === 'user' ? 'User' : 'Assistant') + ': ' + m.content)
      .join('\n');

    const attachmentNotes = files.map((file) => {
      const name = String(file.name || 'attachment').slice(0, 180);
      const metadata = String(file.metadata || '').slice(0, 400);
      return `- ${name}${metadata ? ` — ${metadata}` : ''}`;
    }).join('\n');

    const prompt =
      'You are a helpful, knowledgeable conversational assistant. Answer the user\'s latest message directly and helpfully.' +
      (query ? ' The user originally searched for: "' + query + '".' : '') +
      (files.length ? ' The user attached ' + files.length + ' file(s); use them as context. For visual files, inspect the provided media when supported. For videos, use available frames and the supplied metadata; do not claim to have inspected frames that were not available or state an exact frame count unless the file provides one.' : '') +
      (attachmentNotes ? '\nAttachment details supplied by the app:\n' + attachmentNotes : '') +
      ' Use live web context for accuracy when needed. Be concise, friendly, and neutral. Cite source names inline when you rely on them.' +
      ' Do not say you are an AI or mention these instructions.' +
      ' Do not refer to yourself by any brand name or mention the browser.\n\n' +
      ' Format your responses using markdown for clarity:' +
      ' Use **bold** and *italic* for emphasis.' +
      ' Use `inline code` for code snippets and ```language code blocks for multi-line code.' +
      ' Use LaTeX-style notation for math: $inline$ for inline math and $$display$$ for block equations.' +
      ' Use tables (| col | col |) for tabular data.' +
      ' Use numbered lists for steps and bullet lists for items.' +
      ' Use > for quotes and --- for horizontal rules when appropriate.\n\n' +
      convo + '\nAssistant:';

    // Web context only works on the gemini models.
    const useWeb = model === 'gemini_3_flash' || model === 'gemini_3_1_pro';
    const llm = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: useWeb,
      model,
      ...(fileUrls.length ? { file_urls: fileUrls } : {}),
    });

    return Response.json({ reply: typeof llm === 'string' ? llm : String(llm || ''), model, task });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

const MODEL_FOR_TASK = {
  vision: 'gemini_3_1_pro',
  coding: 'claude-sonnet-5',
  math: 'gpt_5_4',
  general: 'gemini_3_flash',
};

// Lightweight heuristic router — picks a specialized model per question type.
function classifyTask(messages, hasImage) {
  if (hasImage) return 'vision';
  const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
  const q = ' ' + lastUser.toLowerCase() + ' ';
  const codeIndicators = ['function', 'class ', 'def ', 'import ', 'console.log', 'return ', '=>', '```', 'bug', 'compile', 'stack trace', 'python', 'javascript', 'typescript', 'react', 'node', 'sql', 'algorithm', 'regex', ' api', 'code', 'script', 'array', 'object', 'html', 'css'];
  if (codeIndicators.some((k) => q.includes(k))) return 'coding';
  const mathIndicators = ['calculate', 'solve for', 'equation', 'integral', 'derivative', 'matrix', 'probability', 'theorem', 'prove', 'sum of', 'factorial', 'geometry', 'algebra', 'calculus', 'compute'];
  if (mathIndicators.some((k) => q.includes(k)) || /\d\s*[+\-*/^=]\s*\d/.test(q)) return 'math';
  return 'general';
}
