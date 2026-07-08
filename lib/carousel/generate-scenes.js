import { getApiKey } from '../openai.js';

const OPENAI_BASE = 'https://api.openai.com/v1';

/**
 * Per-slide visual scene descriptions (spec §2.3: "one image doing
 * something visually related to that slide's point"). Grounded in the
 * topic's own hook/points/closer — NOT the final punchy overlay captions,
 * which are often too compressed to describe a literal scene (e.g. "Fix
 * it or keep blaming the algorithm." isn't a scene). A separate call from
 * generate-captions.js on purpose, so retuning image prompts never risks
 * the already-verified caption pipeline.
 *
 * Three recurring characters, per Anthony's direction across several
 * messages:
 * - Grinder Dad (grey hair, glasses, striped tee) — the CONSUMER carousel's
 *   protagonist (the DIYer making mistakes), slides 1-5.
 * - "The Pro" (dark hair, purple collared shirt+logo) — appears only in
 *   the CONSUMER closer (slide 6), paired with Grinder Dad: the DIYer
 *   finally meeting the pro he should have hired from the start.
 * - The contractor protagonist (brown hair, safety glasses, yellow work
 *   shirt) — the CONTRACTOR carousel's protagonist, "featured in all of
 *   the epoxy contractor posts," slides 1-5. Slide 6 pairs him with
 *   Grinder Dad reframed as HIS happy customer ("add the dad as a happy
 *   customer when it's done... at the end with the contractor").
 */
export async function generateSlideScenes({ audience, topic }) {
  const key = getApiKey();
  if (!key) throw new Error('OPENAI_API_KEY is not configured.');

  const protagonistNote = audience === 'consumer'
    ? 'The recurring protagonist is "Grinder Dad" — a goofy, accident-prone homeowner character. He is often shown mid-mistake or reacting to a mistake.'
    : 'The recurring protagonist is "the contractor" — a professional running his own epoxy/concrete-coating business. He is often shown at a job site, a laptop/phone, or gesturing at a marketing/ops problem — competent, but frustrated by his own website/business issues, not making a DIY mistake.';

  const closerNote = audience === 'consumer'
    ? '6. Closer slide — this one features BOTH Grinder Dad (the DIYer, tired/resigned/impressed, holding no tools) AND "the Pro" (a separate, confident professional in a work uniform) together in the same shot — the moment the DIYer realizes he should have just hired the Pro from the start.'
    : '6. Closer slide — this one is NOT about marketing/ops anymore. It features BOTH "the contractor" (the protagonist from slides 1-5) AND Grinder Dad — but here Grinder Dad is reframed as a delighted HOMEOWNER/CUSTOMER (relaxed, not working, no tools, not the protagonist in this slide) standing with the contractor on the gleaming finished floor — a high five, handshake, or big grins together. The payoff of the contractor fixing the problem this post is about and making a customer genuinely happy.';

  const systemPrompt = `You write short visual scene descriptions for an illustrated Instagram carousel mascot. Each description is one sentence, describing a concrete pose/action/prop/expression — never abstract, never describing text or writing. ${protagonistNote}

Return JSON only: {"scenes": [string, string, string, string, string, string]} — exactly 6, one per carousel slide in order, no more, no fewer:
1. Hook slide — an attention-grabbing pose matching the hook's energy.
2-5. One scene per failure point/reason, visually depicting that specific point.
${closerNote}`;

  const userPrompt = `Topic: "${topic.title}"
Hook: ${topic.hook}
Points:
1. ${topic.points[0]}
2. ${topic.points[1]}
3. ${topic.points[2]}
4. ${topic.points[3]}
Closer: ${topic.closer}`;

  async function attempt() {
    const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 500,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Scene generation failed: ${res.status} ${err}`);
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) throw new Error('No scene content returned.');

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.scenes) || parsed.scenes.length !== 6) {
      throw new Error(`Expected exactly 6 scenes, got ${JSON.stringify(parsed.scenes)}`);
    }
    return parsed.scenes;
  }

  // The model occasionally drops a scene or merges two into one (confirmed
  // real: came back with 5 instead of 6). One retry rather than failing
  // the whole image-generation run over a single flaky call.
  try {
    return await attempt();
  } catch (err) {
    if (err instanceof SyntaxError || /Expected exactly 6 scenes/.test(err.message)) return attempt();
    throw err;
  }
}
