import { falTextCompletion, isFalConfigured } from '../lib/fal.js';
import { applyCors } from '../lib/cors.js';

const MAX_HISTORY = 8;
const MAX_MESSAGE_LEN = 1000;

/**
 * POST /api/chat — real AI-answering chat for client-site widgets (e.g.
 * mirrorball-epoxy's js/chat-widget.js), not just a lead-capture form. The
 * caller supplies its own businessContext (name, facts, phone) rather than
 * this hardcoding one contractor's details — same "caller supplies its own
 * real data, this stays generic" pattern as the regionalRates pricing
 * override in lib/build-estimate.js. Locked to the same CORS allowlist as
 * every other client-site endpoint, so this is only ever reachable from
 * sites we've actually approved, not the open internet.
 */
export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!isFalConfigured()) {
    return res.status(503).json({ error: 'Chat is not configured.' });
  }

  const body = req.body || {};
  const message = String(body.message || '').trim().slice(0, MAX_MESSAGE_LEN);
  if (!message) {
    return res.status(400).json({ error: 'A message is required.' });
  }

  const history = Array.isArray(body.history) ? body.history.slice(-MAX_HISTORY) : [];
  const ctx = body.businessContext && typeof body.businessContext === 'object' ? body.businessContext : {};

  const businessName = String(ctx.name || 'this business').slice(0, 120);
  const facts = Array.isArray(ctx.facts) ? ctx.facts.map(String).slice(0, 20).join('\n- ') : '';
  const phone = String(ctx.phone || '').slice(0, 40);

  const systemPrompt = [
    `You are a helpful, concise chat assistant embedded on ${businessName}'s website.`,
    facts ? `Real facts about the business you can use:\n- ${facts}` : '',
    'Answer only from the facts given above. If you do not know something (pricing specifics, scheduling, availability), say so honestly and suggest they call or leave their number — never invent a fact, price, license number, review, or promise that was not given to you.',
    phone ? `If someone wants a quote, wants to book something, or asks something you can't answer, suggest they call ${phone}.` : '',
    'Keep replies short: 1-3 sentences, plain conversational text, no markdown formatting, no bullet lists.',
  ].filter(Boolean).join('\n\n');

  const transcript = history
    .filter((m) => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'))
    .map((m) => `${m.role === 'user' ? 'Visitor' : 'Assistant'}: ${String(m.content).slice(0, MAX_MESSAGE_LEN)}`)
    .join('\n');

  const prompt = [
    transcript,
    `Visitor: ${message}`,
    'Assistant:',
  ].filter(Boolean).join('\n');

  try {
    const data = await falTextCompletion(
      { prompt, system_prompt: systemPrompt, max_tokens: 220 },
      20_000,
    );
    const reply = String(data.output || '').trim();
    if (!reply) throw new Error('No reply generated.');
    return res.status(200).json({ reply });
  } catch (err) {
    console.error('Chat completion failed:', err.message);
    return res.status(502).json({ error: "Couldn't get a response — please try again or call instead." });
  }
}
