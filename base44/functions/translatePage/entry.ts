import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// AI page translation: fetches the page server-side, extracts its text, and
// asks the LLM to translate it into the chosen language. Returns the translated
// text plus an estimated token usage so the client can debit the daily budget.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { url, langCode, langLabel } = await req.json();
    if (!url || !langLabel) return Response.json({ error: 'url and langLabel are required' }, { status: 400 });

    let html = '';
    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MatchaBrowser/1.0; +https://matcha-browser.base44.app)' },
        signal: AbortSignal.timeout(10000)
      });
      html = await r.text();
    } catch {
      return Response.json({ error: 'Could not fetch this page' }, { status: 502 });
    }

    let text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
    text = text.slice(0, 6000);

    if (!text) return Response.json({ error: 'No translatable content found on this page' }, { status: 422 });

    const prompt =
      `First, identify the source language of the following text.\n` +
      `Then translate ALL of it into ${langLabel}. Replace every single translatable word — ` +
      `do NOT leave any original-language words mixed in. Translate common words, phrases, ` +
      `headings, buttons, labels, and navigation text. Keep only proper nouns (people, brands, ` +
      `place names), URLs, email addresses, and code snippets in their original form. ` +
      `Preserve paragraph structure with a blank line between paragraphs.\n\n` +
      `Return JSON: { "detectedLang": "the source language name in English", "translated": "the complete translation with no original-language text remaining" }.\n\n---\n${text}`;

    const schema = {
      type: 'object',
      properties: {
        detectedLang: { type: 'string' },
        translated: { type: 'string' },
      },
      required: ['detectedLang', 'translated'],
    };

    const llm = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt, response_json_schema: schema });
    const detectedLang = (llm && llm.detectedLang) || 'Unknown';
    const translated = (llm && llm.translated) || (typeof llm === 'string' ? llm : '');

    const tokensUsed = Math.ceil(text.length / 4) + Math.ceil(String(translated).length / 4);
    return Response.json({ translated, lang: langLabel, detectedLang, tokensUsed });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}