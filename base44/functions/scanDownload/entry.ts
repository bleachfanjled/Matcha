import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Matcha Guard — AI download scanner. Assesses a file URL/filename for safety
// before the file reaches the user's device. Returns a verdict the client acts on.
export default async function scanDownload(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const url = typeof body.url === 'string' ? body.url.trim() : '';
    const filename = typeof body.filename === 'string' ? body.filename.trim() : '';
    if (!url && !filename) return Response.json({ error: 'url or filename required' }, { status: 400 });

    const base44 = createClientFromRequest(req);
    const prompt =
      'You are Matcha Guard, a download safety scanner. Decide whether a file download is safe.' +
      ' Consider the URL domain, file extension, and filename for signs of malware, phishing, executables from untrusted sources, or suspicious patterns.' +
      ' Respond as JSON only: {"safe": true|false, "risk": "low"|"medium"|"high", "reason": "one short sentence"}.' +
      ' When in doubt, lean cautious. Do not invent facts about the file contents.' +
      `\nURL: ${url || '(none)'}\nFilename: ${filename || '(unknown)'}`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          safe: { type: 'boolean' },
          risk: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['safe', 'risk', 'reason'],
      },
    });

    return Response.json({
      safe: !!result.safe,
      risk: result.risk || 'unknown',
      reason: result.reason || 'No details',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}