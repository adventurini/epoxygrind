import { generateSlideCaptions } from './generate-captions.js';
import { generatePostCaption } from './generate-post-caption.js';

const DEDUPE_WINDOW_DAYS = 60;

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return isoDate(d);
}

/**
 * Audience alternates relative to the most recent day that actually has a
 * topic assigned — not raw calendar-date parity — so a gap (a day nobody
 * ever filled) or a month boundary can't accidentally produce two
 * same-audience days in a row (spec §6 item 1: "alternating audience
 * correctly across gaps and month boundaries").
 */
async function determineAudience(supabase, beforeDate) {
  const { data, error } = await supabase
    .from('carousel_days')
    .select('date, audience')
    .lt('date', beforeDate)
    .not('topic_id', 'is', null)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return 'consumer'; // spec §1: "Odd days -> CONSUMER" — the very first day ever is the "odd" starting point
  return data.audience === 'consumer' ? 'contractor' : 'consumer';
}

async function pickLeastRecentlyUsedTopic(supabase, audience) {
  const { data, error } = await supabase
    .from('carousel_topics')
    .select('id, title, hook, points, closer')
    .eq('audience', audience)
    .order('used_at', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`No ${audience} topics in the pool.`);
  return data;
}

async function getRecentTopicTitles(supabase, beforeDate) {
  const windowStart = addDays(beforeDate, -DEDUPE_WINDOW_DAYS);
  const { data, error } = await supabase
    .from('carousel_days')
    .select('carousel_topics(title)')
    .gte('date', windowStart)
    .lt('date', beforeDate);
  if (error) throw error;
  return (data || []).map((r) => r.carousel_topics?.title).filter(Boolean);
}

/**
 * One day: pick audience + least-recently-used topic, generate 6 captions,
 * insert the day + slide rows, mark the topic used. Shared by both the
 * manual "Fill next 30 days" admin action and the nightly cron so they
 * can't drift apart (spec §6: "Manual buttons remain as overrides").
 */
async function fillOneDay(supabase, dateStr) {
  const audience = await determineAudience(supabase, dateStr);
  const topic = await pickLeastRecentlyUsedTopic(supabase, audience);
  const recentTopicTitles = await getRecentTopicTitles(supabase, dateStr);

  const [captions, igCaption] = await Promise.all([
    generateSlideCaptions({ audience, topic, recentTopicTitles }),
    generatePostCaption({ audience, topic }),
  ]);

  const { data: day, error: dayErr } = await supabase
    .from('carousel_days')
    .insert({ date: dateStr, audience, topic_id: topic.id, status: 'drafted', ig_caption: igCaption })
    .select('id')
    .single();
  if (dayErr) throw dayErr;

  const slideRows = captions.map((caption, i) => ({ day_id: day.id, position: i + 1, caption }));
  const { error: slidesErr } = await supabase.from('carousel_slides').insert(slideRows);
  if (slidesErr) throw slidesErr;

  await supabase.from('carousel_topics').update({ used_at: dateStr }).eq('id', topic.id);

  return { date: dateStr, audience, topicTitle: topic.title };
}

/**
 * Maintains the 30-day horizon (spec §6 item 1): for every empty day in
 * the next `horizonDays`, assign a topic and generate captions. A day that
 * fails is flagged needs_attention rather than left silently empty (item
 * 3) — retried up to `maxRetries` times with a short backoff first.
 */
export async function fillHorizon(supabase, { horizonDays = 30, maxRetries = 3 } = {}) {
  const today = isoDate(new Date());
  const dates = Array.from({ length: horizonDays }, (_, i) => addDays(today, i));

  const { data: existingRows, error } = await supabase
    .from('carousel_days')
    .select('date')
    .gte('date', today)
    .lte('date', dates[dates.length - 1]);
  if (error) throw error;
  const existing = new Set((existingRows || []).map((r) => r.date));

  const filled = [];
  const failed = [];
  for (const dateStr of dates) {
    if (existing.has(dateStr)) continue;

    let lastErr = null;
    let ok = false;
    for (let attempt = 1; attempt <= maxRetries && !ok; attempt++) {
      try {
        filled.push(await fillOneDay(supabase, dateStr));
        ok = true;
      } catch (err) {
        lastErr = err;
        if (attempt < maxRetries) await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
    if (!ok) {
      failed.push({ date: dateStr, error: lastErr?.message || 'unknown error' });
      // Insert a placeholder row so the day is visibly flagged rather than
      // silently staying empty forever (spec §6 item 3).
      await supabase.from('carousel_days').upsert(
        { date: dateStr, audience: await determineAudience(supabase, dateStr).catch(() => 'consumer'), status: 'needs_attention' },
        { onConflict: 'date' },
      );
    }
  }

  return { filled, failed };
}
