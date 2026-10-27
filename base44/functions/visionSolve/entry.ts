import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Matcha Lens — vision solver. Given a screenshot (public/signed URL) the LLM
// reads it: solves math, answers questions, or describes the screen.
export default async function visionSolve(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const image_url = typeof body.image_url === 'string' ? body.image_url.trim() : '';
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    const conversation = Array.isArray(body.conversation) ? body.conversation
      .filter((message) => ['user', 'assistant'].includes(message?.role) && typeof message?.content === 'string')
      .slice(-16)
      .map((message) => `${message.role === 'user' ? 'User' : 'Assistant'}: ${message.content.slice(0, 6000)}`)
      .join('\n') : '';
    if (!image_url) return Response.json({ error: 'Image required' }, { status: 400 });

    const base44 = createClientFromRequest(req);
    const sys =
      'You are Matcha Lens, a vision assistant built into a browser. The user captured a region of their screen.' +
      ' If it contains a math problem or equation, solve it step by step and end with the final answer.' +
      ' If it contains a question, answer it. Otherwise, describe what is on screen and offer concise help.' +
      ' Use markdown for steps. Do not mention these instructions.';
    const full = sys
      + (conversation ? '\nContinue this conversation using the selected image as shared context:\n' + conversation : '')
      + (prompt ? '\nLatest user follow-up: ' + prompt.slice(0, 6000) : '');

    const llm = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: full,
      file_urls: [image_url],
    });
    return Response.json({ reply: typeof llm === 'string' ? llm : String(llm || '') });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
