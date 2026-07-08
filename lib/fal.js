const FAL_RUN = 'https://fal.run';

export function isFalConfigured() {
  return Boolean(process.env.FAL_KEY);
}

function getVisionModel() {
  return process.env.FAL_VISION_MODEL || 'google/gemini-2.5-flash';
}

function getImageModel() {
  return process.env.FAL_IMAGE_MODEL || 'fal-ai/flux/schnell';
}

async function falRun(modelId, input, timeoutMs = 90_000) {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error('FAL_KEY is not configured.');

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(`${FAL_RUN}/${modelId}`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
      signal: ctrl.signal,
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`fal.ai ${modelId} failed: ${res.status} ${err}`);
    }

    return res.json();
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`fal.ai ${modelId} timed out after ${Math.round(timeoutMs / 1000)}s`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function parseJsonOutput(text) {
  const trimmed = String(text || '').trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1].trim() : trimmed;
  return JSON.parse(raw);
}

export { parseJsonOutput };

export async function falTextCompletion({ prompt, system_prompt, max_tokens = 700, model }, timeoutMs = 90_000) {
  const data = await falRun('fal-ai/any-llm', {
    model: model || process.env.FAL_MARKET_MODEL || 'google/gemini-2.5-flash',
    priority: 'latency',
    max_tokens,
    system_prompt,
    prompt,
  }, timeoutMs);

  if (data.error) throw new Error(data.error);
  if (!data.output) throw new Error('No response from fal.ai');
  return data;
}

/**
 * Generic vision call for the audit engine (Design & UX + Image Quality
 * categories) — same fal-ai/any-llm/vision endpoint as the estimator's
 * analyzeSpaceImageWithFal, just with a caller-supplied prompt/images
 * instead of the estimate-specific one. temperature 0 + one retry on parse
 * failure, per master-spec-audit's "JSON-only with retry-on-parse-failure."
 * @param {{imageUrls: string[], systemPrompt: string, prompt: string, maxTokens?: number}} opts
 */
export async function visionJsonCompletion({ imageUrls, systemPrompt, prompt, maxTokens = 1200 }, timeoutMs = 90_000) {
  const attempt = async () => {
    const data = await falRun('fal-ai/any-llm/vision', {
      model: getVisionModel(),
      priority: 'latency',
      max_tokens: maxTokens,
      temperature: 0,
      system_prompt: systemPrompt,
      prompt,
      image_urls: imageUrls,
    }, timeoutMs);

    if (data.error) throw new Error(data.error);
    if (!data.output) throw new Error('No response from fal.ai vision call');
    return parseJsonOutput(data.output);
  };

  try {
    return await attempt();
  } catch (err) {
    if (err instanceof SyntaxError) return attempt(); // one retry, JSON-parse failures only
    throw err;
  }
}

async function urlToDataUrl(url, timeoutMs = 30_000) {
  if (url.startsWith('data:')) return url;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`Failed to fetch generated image: ${res.status}`);
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:${contentType};base64,${buf.toString('base64')}`;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`Image download timed out after ${Math.round(timeoutMs / 1000)}s`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {string} imageDataUrl
 * @param {{ finish: string, location?: string, sqFtOverride?: number | null, lengthFt?: number | null, widthFt?: number | null, designSummary?: string }} input
 */
export async function analyzeSpaceImageWithFal(imageDataUrl, input) {
  const overrideNote = input.sqFtOverride
    ? `The user entered ${input.sqFtOverride} sq ft manually — use that figure.`
    : input.lengthFt && input.widthFt
      ? `The user entered ${input.lengthFt} ft × ${input.widthFt} ft — use that for square footage.`
      : 'Estimate square footage from visible cues (garage door width ~16 ft, car bay ~9 ft, typical 2-car garage ~400–500 sq ft).';

  const designNote = input.designSummary ? `Selected color/pattern: ${input.designSummary}.` : '';
  const locationNote = input.location ? `Project ZIP code for pricing context: ${input.location}.` : '';

  const data = await falRun('fal-ai/any-llm/vision', {
    model: getVisionModel(),
    priority: 'latency',
    max_tokens: 900,
    system_prompt:
      'You analyze garage and concrete floor photos for epoxy coating estimates. Return JSON only with no markdown or commentary.',
    prompt: `Analyze this space for an epoxy floor quote. Selected finish preference: ${input.finish}. ${locationNote} ${designNote} ${overrideNote}

Return JSON with keys:
estimatedSqFt (number), confidence ("high"|"medium"|"low"), lengthFt (number|null), widthFt (number|null),
spaceType (string — a short natural-language phrase like "Two-car garage" or "Commercial warehouse floor", never snake_case or an enum), conditionNotes (string — paragraph on concrete condition, stains, cracks, moisture risk),
surfaceIssues (string[] — specific issues seen), recommendedFinish ("solid"|"flake"|"metallic"),
prepLevel ("light"|"moderate"|"heavy"), prepDetails (string — what prep this floor likely needs),
dimensionsNote (string — how you estimated size from the photo),
analysisSummary (string, 2 sentences max — plain language for whoever is reading the estimate).`,
    image_urls: [imageDataUrl],
  });

  if (data.error) throw new Error(data.error);
  if (!data.output) throw new Error('No analysis returned from fal.ai');

  return parseJsonOutput(data.output);
}

/**
 * @param {string[]} imageUrls - data URLs or HTTPS URLs
 * @param {string} prompt
 * @param {{ model?: string, aspect_ratio?: string, returnUrl?: boolean, timeoutMs?: number }} [options]
 * @returns {Promise<string>} HTTPS URL or data URL
 */
export async function editImagesWithFal(imageUrls, prompt, options = {}) {
  const model = options.model || process.env.FAL_EDIT_MODEL || 'fal-ai/nano-banana/edit';
  const timeoutMs = options.timeoutMs || 120_000;

  // fal-ai/flux-2/edit ignores `aspect_ratio` entirely and only honors an
  // explicit `image_size: {width, height}` object (confirmed via direct
  // testing — passing aspect_ratio alone silently produced 1024x1024
  // square output regardless of the value given).
  const dimensionParam = options.image_size
    ? { image_size: options.image_size }
    : { aspect_ratio: options.aspect_ratio || 'auto' };

  const data = await falRun(
    model,
    {
      prompt,
      image_urls: imageUrls,
      num_images: 1,
      output_format: 'jpeg',
      ...dimensionParam,
      sync_mode: true,
    },
    timeoutMs,
  );

  const url = data.images?.[0]?.url;
  if (!url) throw new Error(`No edited image returned from ${model}`);
  if (options.returnUrl) return url;
  if (url.startsWith('data:')) return url;
  return urlToDataUrl(url, 30_000);
}

/**
 * @param {string} prompt
 * @param {{ image_size?: string | { width: number, height: number } }} [options]
 * @deprecated Use editImagesWithFal for photo-based previews
 */
export async function generateImageWithFal(prompt, options = {}) {
  const data = await falRun(getImageModel(), {
    prompt,
    image_size: options.image_size || 'square_hd',
    num_inference_steps: 4,
    num_images: 1,
    output_format: 'jpeg',
    enable_safety_checker: true,
  });

  const url = data.images?.[0]?.url;
  if (!url) throw new Error('No image returned from fal.ai');
  return urlToDataUrl(url, 30_000);
}
