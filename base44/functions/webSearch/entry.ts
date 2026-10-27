import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Web result cards for the Matcha search box. Generated via the LLM with live
// web context. The AI overview (summary/details/links) is produced in parallel
// by `aiOverview`, so the results list and the overview load at the same time
// rather than one big slow call.
async function llmResults(base44, query) {
  const prompt =
    'You are a web search engine. For the query "' + query +
    '", return up to 8 relevant result cards as JSON. Each card: {title, url, snippet}. ' +
    'Use real, reputable https URLs only. Prioritise official sites and major publishers. ' +
    'Exclude cheats, piracy, malware, and low-trust download sites. Do not invent URLs. ' +
    'Keep each snippet to one sentence.';
  const schema = {
    type: 'object',
    properties: {
      results: {
        type: 'array',
        items: {
          type: 'object',
          properties: { title: { type: 'string' }, url: { type: 'string' }, snippet: { type: 'string' } },
          required: ['title', 'url', 'snippet'],
        },
      },
    },
    required: ['results'],
  };
  const llm = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt,
    add_context_from_internet: true,
    model: 'gemini_3_flash',
    response_json_schema: schema,
  });
  return Array.isArray(llm.results) ? llm.results.slice(0, 8) : [];
}

export default async function webSearch(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const query = (typeof body.query === 'string' ? body.query.trim() : '').slice(0, 200);
    if (!query) return Response.json({ error: 'Query is required' }, { status: 400 });

    const base44 = createClientFromRequest(req);
    const results = await llmResults(base44, query);
    return Response.json({ results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}