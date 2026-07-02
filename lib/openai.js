import { generateWithOpenArt, isOpenArtConfigured } from './openart.js';
import { analyzeSpaceImageWithFal, generateImageWithFal, isFalConfigured } from './fal.js';

const OPENAI_BASE = 'https://api.openai.com/v1';

export function getApiKey() {
  return process.env.OPENAI_API_KEY || '';
}

export function isDemoMode() {
  return !isFalConfigured() && !getApiKey();
}

export function demoAnalysis(input) {
  const sqFt =
    input.sqFtOverride ||
    (input.lengthFt && input.widthFt ? input.lengthFt * input.widthFt : 440);

  const designBit = input.designSummary ? ` Selected finish look: ${input.designSummary}.` : '';

  return {
    estimatedSqFt: sqFt,
    confidence: input.sqFtOverride || (input.lengthFt && input.widthFt) ? 'high' : 'medium',
    lengthFt: input.lengthFt || 22,
    widthFt: input.widthFt || 20,
    spaceType: 'Two-car garage',
    conditionNotes: 'Standard concrete wear — live photo analysis was unavailable, using typical assumptions.',
    surfaceIssues: ['Minor tire marks', 'Typical wear near door'],
    recommendedFinish: input.finish || 'flake',
    prepLevel: 'moderate',
    prepDetails: 'Standard grind and clean typical for a residential garage floor.',
    dimensionsNote: 'Square footage estimated from typical two-car garage dimensions.',
    analysisSummary:
      `Concrete floor space suitable for epoxy coating after standard prep.${designBit}`,
  };
}

/**
 * @param {string} imageDataUrl
 * @param {{ finish: string, location?: string, sqFtOverride?: number | null, lengthFt?: number | null, widthFt?: number | null, designSummary?: string }} input
 */
export async function analyzeSpaceImage(imageDataUrl, input) {
  if (isFalConfigured()) {
    try {
      return await analyzeSpaceImageWithFal(imageDataUrl, input);
    } catch (err) {
      if (!getApiKey()) {
        console.error('fal.ai analysis failed, using fallback estimate:', err.message);
        return demoAnalysis(input);
      }
      console.error('fal.ai analysis failed, falling back to OpenAI:', err.message);
    }
  }

  const key = getApiKey();
  if (!key) return demoAnalysis(input);

  const overrideNote = input.sqFtOverride
    ? `The user entered ${input.sqFtOverride} sq ft manually — use that figure.`
    : input.lengthFt && input.widthFt
      ? `The user entered ${input.lengthFt} ft × ${input.widthFt} ft — use that for square footage.`
      : 'Estimate square footage from visible cues (garage door width ~16 ft, car bay ~9 ft, typical 2-car garage ~400–500 sq ft).';

  const designNote = input.designSummary ? `Selected color/pattern: ${input.designSummary}.` : '';
  const locationNote = input.location ? `Project ZIP code: ${input.location}.` : '';

  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You analyze garage and concrete floor photos for epoxy coating estimates. Return JSON only with keys:
estimatedSqFt (number), confidence ("high"|"medium"|"low"), lengthFt (number|null), widthFt (number|null),
spaceType (string), conditionNotes (string), surfaceIssues (string[]), recommendedFinish ("solid"|"flake"|"metallic"),
prepLevel ("light"|"moderate"|"heavy"), prepDetails (string), dimensionsNote (string),
analysisSummary (string, 2 sentences max — plain language for whoever is reading the estimate).`,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyze this space for an epoxy floor quote. Selected finish preference: ${input.finish}. ${locationNote} ${designNote} ${overrideNote}`,
            },
            { type: 'image_url', image_url: { url: imageDataUrl, detail: 'high' } },
          ],
        },
      ],
      max_tokens: 700,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Vision analysis failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) throw new Error('No analysis returned');

  return JSON.parse(raw);
}

/**
 * @param {{ spaceDescription: string, finishLabel: string, finish: string, designPrompt?: string, angle: { id: string, label: string, prompt: string }, baseColorHex?: string }} opts
 */
export async function generateAnglePreview(opts) {
  const prompt = [
    'Photorealistic professional architectural photo of a residential garage interior after epoxy floor coating installation.',
    `Floor finish: ${opts.finishLabel}.`,
    opts.designPrompt || '',
    `Space: ${opts.spaceDescription}.`,
    opts.angle.prompt,
    'Clean walls, bright even lighting, no people, no text, no watermarks, ultra realistic.',
  ].filter(Boolean).join(' ');

  if (isFalConfigured()) {
    try {
      return await generateImageWithFal(prompt);
    } catch (err) {
      console.error('fal.ai image failed, trying fallbacks:', err.message);
    }
  }

  const fromOpenArt = await generateWithOpenArt(prompt);
  if (fromOpenArt) return fromOpenArt;

  const key = getApiKey();
  if (!key) return demoPreview(opts.angle.id, opts.baseColorHex);

  const res = await fetch(`${OPENAI_BASE}/images/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
      response_format: 'b64_json',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Image generation failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error('No image returned');
  return `data:image/png;base64,${b64}`;
}

export const ANGLE_VIEWS = [
  {
    id: 'door',
    label: 'From garage door',
    prompt: 'Camera at garage door looking inward, wide angle showing full floor depth.',
  },
  {
    id: 'corner',
    label: 'Corner view',
    prompt: 'Camera in front corner at standing height, showing two walls and floor plane.',
  },
  {
    id: 'center',
    label: 'Center low angle',
    prompt: 'Low camera near floor center emphasizing epoxy sheen and flake depth.',
  },
  {
    id: 'back',
    label: 'Toward back wall',
    prompt: 'Camera from center aisle looking toward rear wall and workbench area.',
  },
];

function demoPreview(angleId, baseColorHex) {
  const fallback = { door: '1A5CD6', corner: '0F2C5C', center: '42506B', back: '647189' };
  const color = (baseColorHex || `#${fallback[angleId] || '1A5CD6'}`).replace('#', '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    <defs><linearGradient id="f" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#${color}"/><stop offset="100%" stop-color="#E9F0FE"/></linearGradient></defs>
    <rect width="1024" height="1024" fill="#11213B"/>
    <polygon points="0,520 1024,420 1024,1024 0,1024" fill="url(#f)" opacity="0.95"/>
    <rect x="0" y="0" width="1024" height="380" fill="#42506B" opacity="0.35"/>
    <text x="512" y="500" text-anchor="middle" fill="#fff" font-family="Arial,sans-serif" font-size="28" font-weight="700">Preview unavailable — demo mode</text>
    <text x="512" y="540" text-anchor="middle" fill="#C5D2E8" font-family="Arial,sans-serif" font-size="18">Add FAL_KEY on Vercel</text>
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}
