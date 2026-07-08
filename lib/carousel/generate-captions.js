import { getApiKey } from '../openai.js';

const OPENAI_BASE = 'https://api.openai.com/v1';

/**
 * Slide structure per spec §1, rewritten for narrative flow (Anthony:
 * "the captions don't flow with each other... it all needs to flow
 * properly"). The 6 slides are ONE connected story, not 6 independent
 * one-liners — slide 1 sets up the goal/problem, 2-5 are the escalating,
 * specific consequences of chasing that goal badly, and 6 is the actual
 * narrative payoff, not a bolted-on website plug.
 */
const SLIDE_STRUCTURE = `Every carousel is exactly 6 slides, telling ONE connected story — not 6 unrelated one-liners:
1. Hook — sets up the underlying goal/problem in a snarky, witty voice (what the reader actually wants, before anything went wrong). Max 8 words.
2-5. Four consequences that follow FROM that opening, escalating in specificity and severity — each should read like the next beat of the same story, not a fresh unrelated fact. Max 14 words each.
6. The payoff/resolution of the story. Max 16 words.`;

const CONSUMER_CLOSER_REQUIREMENT = 'Slide 6 resolves the story with "next time, hire a pro" as a natural narrative beat — e.g. what the reader wishes they\'d done from the start. Do NOT end with a generic "check out epoxygrind.com" tag bolted onto the sentence — if the site gets mentioned at all, it must read as part of the story\'s punchline, not an ad.';

// The closer idea already says "happy customer" (or a clear equivalent),
// but compression toward brevity/snark kept dropping that specific
// framing entirely (confirmed real — a contractor closer compressed down
// to "stop turning leads into bounces" with no customer mentioned at
// all). Force it to survive, and same rule against a bolted-on CTA.
const CONTRACTOR_CLOSER_REQUIREMENT = 'Slide 6 resolves the story with a happy/satisfied customer as the payoff (e.g. "happy customer", "customer smiling", "5-star review") — this must survive compression. Do NOT end with a generic "check out epoxygrind.com" tag bolted onto the sentence — if the site gets mentioned at all, it must read as part of the story\'s punchline, not an ad.';

/** Real exemplar closers/hooks pulled straight from this project's own
 * authored topic pool (lib/carousel/topic-seed-data.js) — reusing the
 * actual established voice rather than inventing a parallel one. */
const SNARK_STYLE_GUIDE = [
  'Fix it or keep blaming the algorithm.',
  'A slow site is a closed sign you never noticed you hung.',
  'The exit is easier to find than the button. That’s the problem.',
  'Or hire someone who tests before they coat.',
  'The chemistry is the product. The bucket is not.',
  'Two seconds. That’s the whole pitch.',
  'Read the pot life. Then set a timer you actually respect.',
  'Neglect is visible even when you’re not looking for it.',
].map((line) => `- "${line}"`).join('\n');

/**
 * @param {{ audience: 'consumer'|'contractor', topic: { title: string, hook: string, points: string[], closer: string }, recentTopicTitles?: string[] }} opts
 * @returns {Promise<string[]>} exactly 6 final on-image slide captions, in order
 */
export async function generateSlideCaptions({ audience, topic, recentTopicTitles = [] }) {
  const key = getApiKey();
  if (!key) throw new Error('OPENAI_API_KEY is not configured.');

  const audienceNote = audience === 'consumer'
    ? `Audience: homeowners considering a DIY epoxy floor job. Tone: ostensibly educational, actually "here's everything that goes wrong when you DIY." ${CONSUMER_CLOSER_REQUIREMENT}`
    : `Audience: epoxy/concrete-coating contractors. Tone: marketing/ops tips drawn from real website-audit findings. ${CONTRACTOR_CLOSER_REQUIREMENT}`;

  const dedupeNote = recentTopicTitles.length
    ? `Topics used in the last 60 days (vary the phrasing/angle if this topic overlaps): ${recentTopicTitles.join(', ')}`
    : '';

  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You write on-image captions for a daily Instagram carousel. Confident, a little mean, never corporate — snarky for both audiences.

${audienceNote}

${SLIDE_STRUCTURE}

Style guide — match this exact register (real examples from this project, not generic marketing copy):
${SNARK_STYLE_GUIDE}

Return JSON only: {"slides": [string, string, string, string, string, string]} — exactly 6 strings, in slide order, respecting the word limits above, reading as one continuous story front to back. No markdown, no quotes-within-quotes, no hashtags, no emoji.`,
        },
        {
          role: 'user',
          content: `Topic: "${topic.title}"
Hook idea: ${topic.hook}
Failure points (source material, not final copy — weave each into the ongoing story, escalating, not a fresh disconnected fact):
1. ${topic.points[0]}
2. ${topic.points[1]}
3. ${topic.points[2]}
4. ${topic.points[3]}
Closer idea: ${topic.closer}
${dedupeNote}`,
        },
      ],
      max_tokens: 500,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Caption generation failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) throw new Error('No caption content returned.');

  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.slides) || parsed.slides.length !== 6) {
    throw new Error(`Expected exactly 6 slides, got ${JSON.stringify(parsed.slides)}`);
  }
  return parsed.slides;
}
