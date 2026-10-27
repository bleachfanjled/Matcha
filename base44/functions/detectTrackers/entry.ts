import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Identifies the third-party trackers / ad / analytics services a website
// contacts when loaded, using live web context. Feeds the matcha://trackers
// page so users can see which sites contacted which trackers.
export default async function detectTrackers(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const url = (typeof body.url === 'string' ? body.url.trim() : '').slice(0, 500);
    if (!url) return Response.json({ error: 'URL is required' }, { status: 400 });
    let domain;
    try { domain = new URL(url).hostname.replace(/^www\./, ''); }
    catch { domain = url.replace(/^https?:\/\//, '').split('/')[0]; }
    if (!domain) return Response.json({ error: 'Invalid URL' }, { status: 400 });

    const base44 = createClientFromRequest(req);

    const prompt =
      'You are a privacy analysis engine for Matcha, a privacy-focused browser. ' +
      'Analyze the website "' + domain + '" and identify the third-party trackers, advertising networks, and analytics services it contacts when a user loads the page. ' +
      'Use live web context. Return JSON {trackers: [{domain, name, category}]}. ' +
      'category must be one of: Analytics, Advertising, Social, Content Delivery, Fingerprinting, Other. ' +
      'domain is the tracker service domain (e.g. "google.com", "doubleclick.net", "facebook.com", "google-analytics.com", "scorecardresearch.com", "googletagmanager.com"). ' +
      'name is the service name (e.g. "Google Analytics", "DoubleClick/Google Ads", "Facebook Pixel", "Google Tag Manager"). ' +
      'Only include real, well-known trackers that this site is known to contact. If none are known, return an empty array. ' +
      'List up to 10 trackers, most prominent first. Do not invent trackers.';

    const schema = {
      type: 'object',
      properties: {
        trackers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              domain: { type: 'string' },
              name: { type: 'string' },
              category: { type: 'string' },
            },
            required: ['domain', 'name', 'category'],
          },
        },
      },
      required: ['trackers'],
    };

    const llm = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
      model: 'gemini_3_flash',
      response_json_schema: schema,
    });

    return Response.json({ site: domain, trackers: Array.isArray(llm.trackers) ? llm.trackers.slice(0, 10) : [] });
  } catch (error) {
    return Response.json({ trackers: [] });
  }
}