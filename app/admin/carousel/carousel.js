import { initDashboard } from '/app/shell.js';
import { authFetch, getAuthClient } from '/auth/client.js';

const deniedEl = document.getElementById('carouselDenied');
const bodyEl = document.getElementById('carouselBody');
const toastEl = document.getElementById('toast');

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { toastEl.hidden = true; }, 3200);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const STATUS_LABELS = {
  empty: 'Empty', drafted: 'Drafted', generated: 'Generated', edited: 'Edited',
  downloaded: 'Downloaded', archived: 'Archived', needs_attention: 'Needs attention',
};
const SLIDE_WORD_LIMITS = [8, 14, 14, 14, 14, 16];

let currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
let currentDate = null;

function monthLabel(month) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function addMonths(month, delta) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function loadMonth() {
  const loading = document.getElementById('calLoading');
  const grid = document.getElementById('calGrid');
  loading.hidden = false;
  grid.hidden = true;
  document.getElementById('calMonthLabel').textContent = monthLabel(currentMonth);

  try {
    const res = await authFetch(`/api/admin/carousel/month?month=${currentMonth}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not load calendar.');
    renderGrid(data.days);
    loading.hidden = true;
    grid.hidden = false;
  } catch (err) {
    loading.textContent = err.message || 'Could not load calendar.';
  }
}

function renderGrid(days) {
  const grid = document.getElementById('calGrid');
  const today = new Date().toISOString().slice(0, 10);
  const firstDow = new Date(`${days[0].date}T00:00:00Z`).getUTCDay();

  const blanks = Array.from({ length: firstDow }, () => '<div class="cal-cell is-blank"></div>').join('');
  const dow = DOW_LABELS.map((l) => `<div class="cal-dow">${l}</div>`).join('');

  const cells = days.map((d) => {
    const dayNum = Number(d.date.slice(-2));
    const audienceChip = d.audience ? `<span class="cal-audience-chip ${d.audience}">${d.audience}</span>` : '';
    const topicHtml = d.topicTitle ? `<div class="cal-topic">${escapeHtml(d.topicTitle)}</div>` : '';
    return `<div class="cal-cell ${d.date === today ? 'is-today' : ''}" data-date="${d.date}">
      <span class="cal-date">${dayNum}</span>
      ${audienceChip}
      ${topicHtml}
      <span class="cal-status-chip ${d.status}">${STATUS_LABELS[d.status] || d.status}</span>
    </div>`;
  }).join('');

  grid.innerHTML = dow + blanks + cells;
}

document.getElementById('calPrevBtn').addEventListener('click', () => { currentMonth = addMonths(currentMonth, -1); loadMonth(); });
document.getElementById('calNextBtn').addEventListener('click', () => { currentMonth = addMonths(currentMonth, 1); loadMonth(); });

document.getElementById('calFillBtn').addEventListener('click', async () => {
  const btn = document.getElementById('calFillBtn');
  btn.disabled = true;
  const original = btn.textContent;
  btn.textContent = 'Filling…';
  try {
    const res = await authFetch('/api/admin/carousel/fill', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ days: 30 }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Fill failed.');
    toast(`Filled ${data.filled.length} day(s)${data.failed.length ? `, ${data.failed.length} needs attention` : ''}.`);
    await loadMonth();
  } catch (err) {
    toast(err.message || 'Fill failed.');
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
});

document.getElementById('calGrid').addEventListener('click', (ev) => {
  const cell = ev.target.closest('.cal-cell[data-date]');
  if (cell) openDayPanel(cell.dataset.date);
});

function wordCount(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

function renderSlides(day) {
  const el = document.getElementById('calSlides');
  el.innerHTML = day.slides.map((s) => {
    const limit = SLIDE_WORD_LIMITS[s.position - 1];
    const wc = wordCount(s.caption);
    const roleLabel = s.position === 1 ? 'Hook' : s.position === 6 ? 'Closer' : `Point ${s.position - 1}`;
    const image = s.finalUrl || s.imageUrl;
    const imageHtml = image
      ? `<img class="cal-slide-img" src="${escapeHtml(image)}" alt="Slide ${s.position} preview">`
      : `<div class="cal-slide-img cal-slide-img-empty">No image yet</div>`;
    return `<div class="cal-slide" data-position="${s.position}">
      ${imageHtml}
      <div class="cal-slide-label"><span>Slide ${s.position} — ${roleLabel}</span><span class="cal-slide-wordcount ${wc > limit ? 'over' : ''}">${wc}/${limit} words</span></div>
      <textarea rows="2" ${day.readOnly ? 'readonly' : ''} data-position="${s.position}" data-caption-input>${escapeHtml(s.caption || '')}</textarea>
      ${day.readOnly ? '' : `
      <div class="cal-slide-apply">
        <button type="button" class="btn btn-p btn-sm cal-slide-apply-btn" data-position="${s.position}">Apply caption to image</button>
        <button type="button" class="btn btn-o btn-sm cal-slide-regen-caption-btn" data-position="${s.position}">Regenerate this caption</button>
      </div>
      <div class="cal-slide-regen">
        <input type="text" class="cal-slide-delta" data-position="${s.position}" placeholder="Optional: describe a change (e.g. &quot;more panic&quot;)">
        <button type="button" class="btn btn-o btn-sm cal-slide-regen-btn" data-position="${s.position}">Regenerate this image</button>
      </div>`}
    </div>`;
  }).join('');
}

async function openDayPanel(date) {
  currentDate = date;
  document.getElementById('dayBackdrop').hidden = false;
  document.getElementById('dayPanel').hidden = false;
  document.getElementById('dayPanelDate').textContent = new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  document.getElementById('dayPanelMeta').textContent = '';
  document.getElementById('dayPanelEmpty').hidden = true;
  document.getElementById('dayPanelContent').hidden = true;
  document.getElementById('dayPanelReadOnlyBanner').hidden = true;

  try {
    const res = await authFetch(`/api/admin/carousel/day?date=${date}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not load day.');

    if (!data.day) {
      document.getElementById('dayPanelEmpty').hidden = false;
      return;
    }

    const day = data.day;
    document.getElementById('dayPanelMeta').textContent = `${day.audience} — ${day.topic.title}`;
    document.getElementById('dayPanelReadOnlyBanner').hidden = !day.readOnly;
    document.getElementById('daySwapTopicBtn').disabled = day.readOnly;
    document.getElementById('dayRegenBtn').disabled = day.readOnly;
    document.getElementById('dayGenImagesBtn').disabled = day.readOnly;
    document.getElementById('dayRegenPostCaptionBtn').disabled = day.readOnly;
    document.getElementById('dayPublishBtn').disabled = day.readOnly;
    const igCaptionEl = document.getElementById('dayIgCaption');
    igCaptionEl.value = day.igCaption || '';
    igCaptionEl.readOnly = day.readOnly;
    document.getElementById('dayIgCaptionCount').textContent = `${(day.igCaption || '').length}/2200 chars`;
    document.getElementById('dayPublishStatus').textContent = day.approvedAt ? `Published ${new Date(day.approvedAt).toLocaleString()}` : '';
    renderSlides(day);
    document.getElementById('dayPanelContent').hidden = false;
  } catch (err) {
    toast(err.message || 'Could not load day.');
  }
}

function closeDayPanel() {
  document.getElementById('dayBackdrop').hidden = true;
  document.getElementById('dayPanel').hidden = true;
  currentDate = null;
}

document.getElementById('dayPanelCloseBtn').addEventListener('click', closeDayPanel);
document.getElementById('dayBackdrop').addEventListener('click', closeDayPanel);

// Explicit "Apply" button rather than a silent save-on-blur (Anthony: "If
// we change it, there should be an apply button, to retrigger") — editing
// a caption doesn't touch the image until this fires, so the on-image
// text and the textarea can never silently drift apart.
document.getElementById('calSlides').addEventListener('click', async (ev) => {
  const btn = ev.target.closest('.cal-slide-apply-btn');
  if (!btn || !currentDate) return;
  const position = Number(btn.dataset.position);
  const textarea = document.querySelector(`.cal-slide[data-position="${position}"] textarea[data-caption-input]`);
  if (!textarea) return;

  btn.disabled = true;
  const original = btn.textContent;
  btn.textContent = 'Applying…';
  try {
    const res = await authFetch('/api/admin/carousel/slide', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: currentDate, position, caption: textarea.value }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not save.');
    if (data.finalUrl) {
      const img = document.querySelector(`.cal-slide[data-position="${position}"] .cal-slide-img`);
      if (img && img.tagName === 'IMG') img.src = data.finalUrl;
    }
    const wc = wordCount(textarea.value);
    const limit = SLIDE_WORD_LIMITS[position - 1];
    const wcEl = document.querySelector(`.cal-slide[data-position="${position}"] .cal-slide-wordcount`);
    if (wcEl) { wcEl.textContent = `${wc}/${limit} words`; wcEl.classList.toggle('over', wc > limit); }
    toast(data.finalUrl ? 'Caption applied to image.' : 'Caption saved.');
  } catch (err) {
    toast(err.message || 'Could not save.');
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
});

// Per-slide caption regeneration (Anthony: "a way to do it individually
// (captions and images)") — complements the per-slide image regen button
// and the day-level "Regenerate all captions".
document.getElementById('calSlides').addEventListener('click', async (ev) => {
  const btn = ev.target.closest('.cal-slide-regen-caption-btn');
  if (!btn || !currentDate) return;
  const position = Number(btn.dataset.position);

  btn.disabled = true;
  const original = btn.textContent;
  btn.textContent = 'Regenerating…';
  try {
    const res = await authFetch('/api/admin/carousel/regenerate-slide-caption', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: currentDate, position }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Regenerate failed.');

    const textarea = document.querySelector(`.cal-slide[data-position="${position}"] textarea[data-caption-input]`);
    if (textarea) textarea.value = data.caption;
    if (data.finalUrl) {
      const img = document.querySelector(`.cal-slide[data-position="${position}"] .cal-slide-img`);
      if (img && img.tagName === 'IMG') img.src = data.finalUrl;
    }
    const wc = wordCount(data.caption);
    const limit = SLIDE_WORD_LIMITS[position - 1];
    const wcEl = document.querySelector(`.cal-slide[data-position="${position}"] .cal-slide-wordcount`);
    if (wcEl) { wcEl.textContent = `${wc}/${limit} words`; wcEl.classList.toggle('over', wc > limit); }
    toast('Caption regenerated.');
  } catch (err) {
    toast(err.message || 'Regenerate failed.');
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
});

document.getElementById('dayRegenBtn').addEventListener('click', async () => {
  if (!currentDate) return;
  const btn = document.getElementById('dayRegenBtn');
  btn.disabled = true;
  try {
    const res = await authFetch('/api/admin/carousel/regenerate-captions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: currentDate }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Regenerate failed.');
    await openDayPanel(currentDate);
    toast('Captions regenerated.');
  } catch (err) {
    toast(err.message || 'Regenerate failed.');
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('dayGenImagesBtn').addEventListener('click', async () => {
  if (!currentDate) return;
  const btn = document.getElementById('dayGenImagesBtn');
  btn.disabled = true;
  const original = btn.textContent;
  btn.textContent = 'Generating… (~1 min)';
  try {
    const res = await authFetch('/api/admin/carousel/generate-images', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: currentDate }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Image generation failed.');
    await openDayPanel(currentDate);
    await loadMonth();
    toast('Images generated.');
  } catch (err) {
    toast(err.message || 'Image generation failed.');
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
});

document.getElementById('calSlides').addEventListener('click', async (ev) => {
  const btn = ev.target.closest('.cal-slide-regen-btn');
  if (!btn || !currentDate) return;
  const position = Number(btn.dataset.position);
  const deltaInput = document.querySelector(`.cal-slide-delta[data-position="${position}"]`);
  const deltaPrompt = deltaInput ? deltaInput.value.trim() : '';

  btn.disabled = true;
  const original = btn.textContent;
  btn.textContent = 'Regenerating…';
  try {
    const res = await authFetch('/api/admin/carousel/regenerate-slide-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: currentDate, position, deltaPrompt }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Regenerate failed.');
    await openDayPanel(currentDate);
    await loadMonth();
    toast('Slide image regenerated.');
  } catch (err) {
    toast(err.message || 'Regenerate failed.');
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
});

document.getElementById('daySwapTopicBtn').addEventListener('click', async () => {
  if (!currentDate) return;
  const btn = document.getElementById('daySwapTopicBtn');
  btn.disabled = true;
  try {
    const res = await authFetch('/api/admin/carousel/swap-topic', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: currentDate }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Swap failed.');
    await openDayPanel(currentDate);
    await loadMonth();
    toast(`Swapped to "${data.topicTitle}".`);
  } catch (err) {
    toast(err.message || 'Swap failed.');
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('dayIgCaption').addEventListener('input', (ev) => {
  document.getElementById('dayIgCaptionCount').textContent = `${ev.target.value.length}/2200 chars`;
});

document.getElementById('dayIgCaption').addEventListener('blur', async (ev) => {
  if (!currentDate) return;
  try {
    const res = await authFetch('/api/admin/carousel/day-fields', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: currentDate, igCaption: ev.target.value }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not save.');
  } catch (err) {
    toast(err.message || 'Could not save.');
  }
});

document.getElementById('dayRegenPostCaptionBtn').addEventListener('click', async () => {
  if (!currentDate) return;
  const btn = document.getElementById('dayRegenPostCaptionBtn');
  btn.disabled = true;
  try {
    const res = await authFetch('/api/admin/carousel/regenerate-post-caption', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: currentDate }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Regenerate failed.');
    document.getElementById('dayIgCaption').value = data.igCaption;
    document.getElementById('dayIgCaptionCount').textContent = `${data.igCaption.length}/2200 chars`;
    toast('Post caption regenerated.');
  } catch (err) {
    toast(err.message || 'Regenerate failed.');
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('dayPublishBtn').addEventListener('click', async () => {
  if (!currentDate) return;
  const platforms = [];
  if (document.getElementById('publishIg').checked) platforms.push('ig');
  if (document.getElementById('publishFb').checked) platforms.push('fb');
  if (!platforms.length) { toast('Pick at least one platform.'); return; }
  if (!confirm(`Publish ${currentDate} to ${platforms.join(', ').toUpperCase()} right now? This posts publicly and cannot be undone from here.`)) return;

  const btn = document.getElementById('dayPublishBtn');
  btn.disabled = true;
  const original = btn.textContent;
  btn.textContent = 'Publishing…';
  try {
    const res = await authFetch('/api/admin/carousel/publish', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: currentDate, platforms }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Publish failed.');
    const summary = data.results.map((r) => `${r.platform.toUpperCase()}: ${r.ok ? 'published' : 'FAILED — ' + r.error}`).join(' / ');
    document.getElementById('dayPublishStatus').textContent = summary;
    await loadMonth();
    toast(summary);
  } catch (err) {
    toast(err.message || 'Publish failed.');
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
});

async function openMetaSettings() {
  document.getElementById('metaSettingsBackdrop').hidden = false;
  document.getElementById('metaSettingsPanel').hidden = false;
  document.getElementById('metaPageAccessToken').value = '';
  try {
    const res = await authFetch('/api/admin/carousel/meta-config');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not load Meta settings.');
    document.getElementById('metaIgUserId').value = data.igUserId || '';
    document.getElementById('metaPageId').value = data.pageId || '';
    document.getElementById('metaTokenStatus').textContent = data.pageAccessTokenMasked ? `current: ${data.pageAccessTokenMasked}` : 'not set';
  } catch (err) {
    toast(err.message || 'Could not load Meta settings.');
  }
}

function closeMetaSettings() {
  document.getElementById('metaSettingsBackdrop').hidden = true;
  document.getElementById('metaSettingsPanel').hidden = true;
}

document.getElementById('calMetaSettingsBtn').addEventListener('click', openMetaSettings);
document.getElementById('metaSettingsCloseBtn').addEventListener('click', closeMetaSettings);
document.getElementById('metaSettingsBackdrop').addEventListener('click', closeMetaSettings);

document.getElementById('metaSettingsSaveBtn').addEventListener('click', async () => {
  const btn = document.getElementById('metaSettingsSaveBtn');
  btn.disabled = true;
  try {
    const res = await authFetch('/api/admin/carousel/meta-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        igUserId: document.getElementById('metaIgUserId').value,
        pageId: document.getElementById('metaPageId').value,
        pageAccessToken: document.getElementById('metaPageAccessToken').value,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not save.');
    toast('Meta settings saved.');
    await openMetaSettings();
  } catch (err) {
    toast(err.message || 'Could not save.');
  } finally {
    btn.disabled = false;
  }
});

async function boot() {
  const user = await initDashboard({ activeNav: 'admin' });
  if (!user) return;

  let isAdmin = false;
  try {
    const supabase = await getAuthClient();
    const { data } = await supabase.from('profiles').select('is_admin').eq('user_id', user.id).maybeSingle();
    isAdmin = data?.is_admin === true;
  } catch {
    isAdmin = false;
  }

  if (!isAdmin) {
    deniedEl.hidden = false;
    return;
  }

  bodyEl.hidden = false;
  await loadMonth();
}

boot().catch((err) => toast(err.message || 'Failed to load carousel admin page.'));
