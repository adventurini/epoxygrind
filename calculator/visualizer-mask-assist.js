/**
 * Manual mask-assist UI (epoxygrind-visualizer-build-spec.md Part 3.1's
 * deferred-to-v2 fallback, now built). Shown when /api/segment comes back
 * with `needsManualAssist: true` (confidence too low, or mask too small a
 * fraction of the frame). The user taps 2-3 points on their own floor in
 * the uploaded photo; those points are sent back to /api/segment as
 * normalized [0,1] coordinates and re-prompt fal.ai SAM 3.
 *
 * Note the taps still resolve to a box_prompts call server-side, not
 * point_prompts — verified live against the fal.ai API (see
 * lib/segment-fal.js's top-of-file comment) that point_prompts are silently
 * ignored by the hosted model entirely, unlike box_prompts which measurably
 * change the output. That's an implementation detail of api/segment.js /
 * lib/segment-fal.js; this module only collects and submits normalized taps.
 */

const MIN_POINTS = 2;
const MAX_POINTS = 3;

const DEFAULT_MESSAGE = "We couldn't clearly find the floor in this photo. Tap 2-3 points on your floor below, then confirm.";

/**
 * @param {HTMLElement} container - emptied and filled with the assist UI
 * @param {string} photoSrc - the uploaded photo (data URL or storage URL)
 * @param {{onSubmit:(points:Array<{x:number,y:number}>)=>Promise<void>, message?:string}} callbacks
 */
export function renderMaskAssist(container, photoSrc, callbacks) {
  const { onSubmit, message } = callbacks;

  container.innerHTML = `
    <div class="viz-assist-inner">
      <p class="viz-assist-msg">${message || DEFAULT_MESSAGE}</p>
      <div class="viz-assist-photo-wrap" data-role="assistPhotoWrap">
        <img class="viz-assist-photo" src="${photoSrc}" alt="Tap your floor" draggable="false">
        <div class="viz-assist-marks" data-role="assistMarks"></div>
      </div>
      <p class="viz-assist-hint" data-role="assistHint"></p>
      <div class="viz-assist-actions">
        <button type="button" class="btn btn-o btn-sm" data-role="assistClear">Clear points</button>
        <button type="button" class="btn btn-p btn-sm" data-role="assistSubmit" disabled>Use these points</button>
      </div>
    </div>`;

  const wrap = container.querySelector('[data-role="assistPhotoWrap"]');
  const marksEl = container.querySelector('[data-role="assistMarks"]');
  const hintEl = container.querySelector('[data-role="assistHint"]');
  const submitBtn = container.querySelector('[data-role="assistSubmit"]');
  const clearBtn = container.querySelector('[data-role="assistClear"]');

  let points = [];

  function renderMarks() {
    marksEl.innerHTML = points
      .map((p, i) => `<span class="viz-assist-mark" style="left:${(p.x * 100).toFixed(2)}%;top:${(p.y * 100).toFixed(2)}%">${i + 1}</span>`)
      .join('');
    submitBtn.disabled = points.length < MIN_POINTS;
    hintEl.textContent =
      points.length >= MAX_POINTS
        ? `${MAX_POINTS} points placed — tap "Use these points," or clear and try again.`
        : `${points.length}/${MIN_POINTS}-${MAX_POINTS} points placed.`;
  }

  wrap.addEventListener('click', (e) => {
    if (points.length >= MAX_POINTS) return;
    const rect = wrap.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    points.push({ x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) });
    renderMarks();
  });

  clearBtn.addEventListener('click', () => {
    points = [];
    renderMarks();
  });

  submitBtn.addEventListener('click', async () => {
    if (points.length < MIN_POINTS) return;
    submitBtn.disabled = true;
    clearBtn.disabled = true;
    submitBtn.textContent = 'Finding your floor…';
    try {
      await onSubmit(points.map((p) => ({ ...p })));
    } finally {
      submitBtn.textContent = 'Use these points';
      clearBtn.disabled = false;
      submitBtn.disabled = points.length < MIN_POINTS;
    }
  });

  renderMarks();
}
