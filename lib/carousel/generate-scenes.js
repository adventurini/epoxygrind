import { getApiKey } from '../openai.js';

const OPENAI_BASE = 'https://api.openai.com/v1';

/**
 * Per-slide visual scene descriptions for Grinder Dad (spec §2.3: "one
 * image of Grinder Dad doing something visually related to that slide's
 * point"). Grounded in the topic's own hook/points/closer — NOT the final
 * punchy overlay captions, which are often too compressed to describe a
 * literal scene (e.g. "Fix it or keep blaming the algorithm." isn't a
 * scene). A separate call from generate-captions.js on purpose, so
 * retuning image prompts never risks the already-verified caption pipeline.
 */
export async function generateSlideScenes({ audience, topic }) {
  const key = getApiKey();
  if (!key) throw new Error('OPENAI_API_KEY is not configured.');

  const audienceNote = audience === 'consumer'
    ? 'Consumer/DIY failure topic — Grinder Dad is often shown mid-mistake or reacting to a mistake.'
    : 'Contractor marketing/ops topic — Grinder Dad is often shown at a job site, a laptop/phone, or gesturing at a problem.';

  // Consumer posts end on a second, distinct character: "the Pro" — a
  // competent professional (collared work shirt, company logo) who shows
  // up specifically at the "hire someone who knows what they're doing"
  // payoff. Only slide 6, only for consumer posts (Anthony: "The last
  // photo has a pro in it always in the DIY section").
  //
  // Contractor posts end on Grinder Dad again, but reframed: not doing
  // marketing/ops work, but as a HAPPY CUSTOMER admiring his own finished
  // floor — the payoff of the contractor fixing what the post is about
  // (Anthony: "add the dad as a happy customer when it's done... captions
  // for the contractors should finish and tie back to a happy customer").
  const closerNote = audience === 'consumer'
    ? '6. Closer slide — this one does NOT feature Grinder Dad. It features "the Pro": a separate, competent, professional-looking character in a work uniform, doing the job correctly/confidently — the payoff of hiring an expert instead of DIYing it.'
    : '6. Closer slide — this one is NOT about marketing/ops anymore. It features Grinder Dad as a delighted HOMEOWNER/CUSTOMER — arms crossed admiring a gleaming finished floor, giving a thumbs up, or relaxing on it — the payoff of a contractor who fixed the problem this post is about and made a customer genuinely happy.';

  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You write short visual scene descriptions for an illustrated recurring mascot named Grinder Dad (a goofy dad character who does floor grinding/epoxy work). Each description is one sentence, describing a concrete pose/action/prop/expression — never abstract, never describing text or writing. ${audienceNote}

Return JSON only: {"scenes": [string, string, string, string, string, string]} — exactly 6, one per carousel slide in order:
1. Hook slide — an attention-grabbing pose matching the hook's energy.
2-5. One scene per failure point/reason, visually depicting that specific point.
${closerNote}`,
        },
        {
          role: 'user',
          content: `Topic: "${topic.title}"
Hook: ${topic.hook}
Points:
1. ${topic.points[0]}
2. ${topic.points[1]}
3. ${topic.points[2]}
4. ${topic.points[3]}
Closer: ${topic.closer}`,
        },
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
