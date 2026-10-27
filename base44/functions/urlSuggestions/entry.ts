import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// AI-powered address bar suggestions. Given what the user is typing, returns
// a short list of search query completions and real URL guesses. Runs without
// web context for low latency.
export default async function urlSuggestions(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const input = (typeof body.input === 'string' ? body.input.trim() : '').slice(0, 200);
    if (!input) return Response.json({ suggestions: [] });

    const base44 = createClientFromRequest(req);

    const prompt =
      'You are the address-bar suggestion engine for Matcha, a privacy-first web browser. ' +
      'A user is typing in the URL/address bar: "' + input + '". ' +
      'Generate up to 6 helpful suggestions as JSON. Each suggestion is either a search query completion (type "search") or a real website URL (type "url"). ' +
      'For "url" suggestions, use real, well-known, reputable websites that match the intent; include the full https URL in "url". ' +
      'For "search" suggestions, omit "url" and put the full query in "label". ' +
      'Keep labels short (max 60 chars). Put the most likely intent first. ' +
      'NEVER suggest game executors, aimbots, cheats, piracy, malware, or low-trust download sites. ' +
      'Return {suggestions: [{type, label, url?}]}';

    const schema = {
      type: 'object',
      properties: {
        suggestions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['search', 'url'] },
              label: { type: 'string' },
              url: { type: 'string' },
            },
            required: ['type', 'label'],
          },
        },
      },
      required: ['suggestions'],
    };

    const llm = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      model: 'gpt_5_mini',
      response_json_schema: schema,
    });

    return Response.json({ suggestions: Array.isArray(llm.suggestions) ? llm.suggestions.slice(0, 6) : [] });
  } catch (error) {
    return Response.json({ suggestions: [] });
  }
}