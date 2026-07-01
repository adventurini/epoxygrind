/**
 * Optional OpenArt image generation (Pro plan credits via API when available).
 * Set OPENART_API_KEY and optionally OPENART_API_BASE in Vercel.
 */

export function isOpenArtConfigured() {
  return Boolean(process.env.OPENART_API_KEY);
}

/**
 * @param {string} prompt
 * @returns {Promise<string|null>} data URL or image URL, or null to fall back
 */
export async function generateWithOpenArt(prompt) {
  const key = process.env.OPENART_API_KEY;
  if (!key) return null;

  const base = (process.env.OPENART_API_BASE || 'https://api.openart.ai/v1').replace(/\/$/, '');

  const endpoints = [`${base}/generate`, `${base}/images/generations`];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          'X-API-Key': key,
        },
        body: JSON.stringify({
          prompt,
          width: 1024,
          height: 1024,
          size: '1024x1024',
          n: 1,
        }),
      });

      if (!res.ok) continue;

      const data = await res.json();
      const b64 = data?.data?.[0]?.b64_json || data?.b64_json || data?.image_base64;
      if (b64) return `data:image/png;base64,${b64}`;

      const imageUrl = data?.data?.[0]?.url || data?.url || data?.image_url || data?.output?.[0];
      if (imageUrl && typeof imageUrl === 'string') {
        if (imageUrl.startsWith('data:')) return imageUrl;
        const imgRes = await fetch(imageUrl);
        if (!imgRes.ok) return imageUrl;
        const buf = Buffer.from(await imgRes.arrayBuffer());
        return `data:image/png;base64,${buf.toString('base64')}`;
      }

      const jobId = data?.id || data?.job_id;
      if (jobId) {
        const polled = await pollOpenArtJob(base, key, jobId);
        if (polled) return polled;
      }
    } catch {
      /* try next endpoint */
    }
  }

  return null;
}

async function pollOpenArtJob(base, key, jobId) {
  for (let i = 0; i < 20; i += 1) {
    await sleep(2000);
    try {
      const res = await fetch(`${base}/status/${jobId}`, {
        headers: { Authorization: `Bearer ${key}`, 'X-API-Key': key },
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data.status === 'failed') return null;
      const url = data?.result?.url || data?.url || data?.output?.[0];
      if (url) return url.startsWith('data:') ? url : url;
      if (data.status === 'completed' && data.b64_json) {
        return `data:image/png;base64,${data.b64_json}`;
      }
    } catch {
      /* retry */
    }
  }
  return null;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
