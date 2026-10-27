import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// AI background generator for the new-tab personalizer. Returns a public image URL.
export default async function generateImage(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    if (!prompt) return Response.json({ error: 'Prompt required' }, { status: 400 });
    const base44 = createClientFromRequest(req);
    const res = await base44.asServiceRole.integrations.Core.GenerateImage({ prompt });
    return Response.json({ url: res?.url || '' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}