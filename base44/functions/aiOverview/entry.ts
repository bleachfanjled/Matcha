import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Generates only the AI overview (summary + expandable details + cited links)
// for a search query, using live web context. Runs separately from `webSearch`
// so the results list can render instantly while this loads in parallel.
export default async function aiOverview(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const query = (typeof body.query === 'string' ? body.query.trim() : '').slice(0, 200);
    if (!query) return Response.json({ error: 'Query is required' }, { status: 400 });

    const base44 = createClientFromRequest(req);

    const prompt =
      'You are Matcha, a privacy-first web search engine. A user searched for: "' + query + '".\n' +
      'Using live web context, produce a JSON object with:\n' +
      '1. "summary": a concise 2-3 sentence AI overview that directly answers the query.\n' +
      '2. "details": a longer explanation that elaborates on the answer. Format as plain text: an optional short ALL-CAPS section heading on its own line, then 2-4 bullet points each prefixed with "* " and separated by "\\n".\n' +
      '3. "links": up to 4 inline source references you used, each {title, url}, reputable pages only.\n' +
      'Prioritise well-known, reputable, safe sources such as official sites, major publishers, and established references. ' +
      'NEVER include game executors, aimbots, ESP tools, cheat software, script injectors, key generators, cracks, piracy, ' +
      'malware, scam, phishing, or low-trust download sites. Do not invent URLs. Only include real pages found via web context.';

    const schema = {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        details: { type: 'string' },
        links: {
          type: 'array',
          items: {
            type: 'object',
            properties: { title: { type: 'string' }, url: { type: 'string' } },
            required: ['title', 'url'],
          },
        },
      },
      required: ['summary', 'details', 'links'],
    };

    const llm = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
      model: 'gemini_3_flash',
      response_json_schema: schema,
    });

    return Response.json({
      summary: llm.summary || '',
      details: llm.details || '',
      links: Array.isArray(llm.links) ? llm.links.slice(0, 4) : [],
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}