import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// AI "About this page" summary: fetches the page server-side and asks the LLM
// for a one-or-two-sentence description of what the site/page is. Returns the
// summary plus an estimated token usage so the client can debit the budget.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { url } = await req.json();
    if (!url) return Response.json({ error: 'url is required' }, { status: 400 });

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
      .trim()
      .slice(0, 4000);

    if (!text) return Response.json({ error: 'No content found on this page' }, { status: 422 });

    let host = '';
    try { host = new URL(url).hostname.replace(/^www\./, ''); } catch {}

    const prompt = `In one or two plain sentences, describe what "${host}" / this page is, based only on the content below. Be concise and factual.\n\n---\n${text}`;
    const llm = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt });
    const about = typeof llm === 'string' ? llm : (llm && llm.text) ? llm.text : JSON.stringify(llm);

    const tokensUsed = Math.ceil(text.length / 4) + Math.ceil(String(about).length / 4);
    return Response.json({ about, tokensUsed });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}